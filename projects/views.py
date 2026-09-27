from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from .models import Project, Membership
from .serializers import ProjectSerializer, MembershipSerializer
from .permissions import IsProjectMember
from activity.models import ActivityLog

User = get_user_model()

class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [IsProjectMember]

    def get_queryset(self):
        # Requirement 4: A user can only see data for projects they are a member of
        return Project.objects.filter(members=self.request.user)

    @action(detail=True, methods=['post'], url_path='invite')
    def invite_member(self, request, pk=None):
        project = self.get_object()
        
        # Requirement 8: Only the owner can invite or manage members
        membership = ProjectMembership.objects.get(user=request.user, project=project)
        if membership.role != 'OWNER':
            return Response({"error": "Only the project owner can invite members."}, status=status.HTTP_403_FORBIDDEN)
            
        email = request.data.get('email')
        if not email:
            return Response({"email": "This field is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            target_user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({"error": "No registered user found with this email."}, status=status.HTTP_404_NOT_FOUND)
            
        if project.members.filter(id=target_user.id).exists():
            return Response({"error": "User is already a member of this project."}, status=status.HTTP_400_BAD_REQUEST)
            
        ProjectMembership.objects.create(user=target_user, project=project, role='MEMBER')
        
        # Log Audit Requirement 21
        ActivityLog.objects.create(
            project=project, actor=request.user, event_type='MEMBER_INVITED',
            description=f"Invited user {target_user.email} to project."
        )
        return Response({"message": "User successfully invited."}, status=status.HTTP_201_CREATED)
