from django.shortcuts import render

# Create your views here.
from rest_framework import viewsets, status
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from projects.models import Project, Membership
from projects.permissions import IsProjectMember
from .models import Task, Comment
from .serializers import TaskSerializer, CommentSerializer
from activity.models import ActivityLog

class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [IsProjectMember]

    def get_queryset(self):
        project_id = self.kwargs.get('project_pk')
        queryset = Task.objects.filter(project_id=project_id)
        
        # Requirement 13 & 14: Server side filtering, search, and sorting
        assignee = self.request.query_params.get('assignee')
        priority = self.request.query_params.get('priority')
        search = self.request.query_params.get('search')
        ordering = self.request.query_params.get('ordering')

        if assignee:
            queryset = queryset.filter(assignee_id=assignee)
        if priority:
            queryset = queryset.filter(priority=priority)
        if search:
            queryset = queryset.filter(title__icontains=search)
        if ordering:
            queryset = queryset.order_by(ordering)
            
        return queryset

    def perform_create(self, serializer):
        project_id = self.kwargs.get('project_pk')
        project = get_object_or_404(Project, pk=project_id)
        task = serializer.save(project=project, creator=self.request.user)
        
        ActivityLog.objects.create(
            project=project, actor=self.request.user, event_type='TASK_CREATED',
            description=f"Created task '{task.title}'"
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        # Requirement 20: Only the task's assignee or the project owner can mark a task Done
        target_status = request.data.get('status')
        if target_status == 'DONE' and instance.status != 'DONE':
            is_owner = ProjectMembership.objects.filter(user=request.user, project=instance.project, role='OWNER').exists()
            is_assignee = instance.assignee == request.user
            if not (is_owner or is_assignee):
                return Response({"error": "Only the assignee or project owner can mark this task as Done."}, status=status.HTTP_403_FORBIDDEN)
        
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        updated_task = serializer.save()
        
        ActivityLog.objects.create(
            project=instance.project, actor=request.user, event_type='TASK_MOVED',
            description=f"Updated status/details of task '{updated_task.title}'"
        )
        return Response(serializer.data)
