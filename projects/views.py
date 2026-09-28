from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from activity import broadcast

from activity.serializers import ActivityLogSerializer
from activity.utils import log_activity
from tasks.models import Task
from .models import Project, Membership
from .permissions import IsProjectOwner
from .serializers import ProjectSerializer, MembershipSerializer, InviteMemberSerializer

User = get_user_model()
OWNER_ONLY = ('update', 'partial_update', 'destroy', 'invite', 'remove_member')


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer

    def get_queryset(self):
        # Non-members get 404: the project's existence isn't leaked to them.
        return (Project.objects.filter(memberships__user=self.request.user)
                .select_related('owner').prefetch_related('memberships__user'))

    def get_permissions(self):
        if self.action in OWNER_ONLY:
            return [IsAuthenticated(), IsProjectOwner()]
        return [IsAuthenticated()]

    @transaction.atomic
    def perform_create(self, serializer):
        project = serializer.save(owner=self.request.user)
        Membership.objects.create(user=self.request.user, project=project, role=Membership.OWNER)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def invite(self, request, pk=None):
        project = self.get_object()
        s = InviteMemberSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        user = User.objects.get(email__iexact=s.validated_data['email'])
        membership, created = Membership.objects.get_or_create(
            user=user, project=project, defaults={'role': Membership.MEMBER}
        )
        if not created:
            return Response({'email': ['This user is already a member.']}, status=400)
        log_activity(project, request.user, 'invited member', f'invited {user.email}')
        # invite(): after log_activity
        broadcast.membership(user.id, project.id, granted=True)
        broadcast.to_project(project.id, 'member.added', {'user_id': user.id})
        broadcast.to_user(user.id, 'project.invited', {'id': project.id, 'name': project.title}, project.id)
        return Response(MembershipSerializer(membership).data, status=201)

    @action(detail=True, methods=['delete'], url_path=r'members/(?P<user_id>\d+)')
    def remove_member(self, request, pk=None, user_id=None):
        project = self.get_object()
        if int(user_id) == project.owner_id:
            return Response({'detail': 'The project owner cannot be removed.'}, status=400)
        membership = get_object_or_404(Membership, project=project, user_id=user_id)
        with transaction.atomic():
            # auto-unassign: tasks stay, assignee cleared; tasks they created are untouched
            Task.objects.filter(project=project, assignee_id=user_id).update(assignee=None)
            email = membership.user.email
            membership.delete()
            log_activity(project, request.user, 'removed member', f'removed {email}')
        broadcast.to_project(project.id, 'member.removed', {'user_id': int(user_id)})
        broadcast.membership(int(user_id), project.id, granted=False)
        return Response(status=204)

    @action(detail=True, methods=['get'])
    def activity(self, request, pk=None):
        project = self.get_object()  # member-only via queryset scoping
        page = self.paginate_queryset(project.activity_logs.select_related('actor'))
        return self.get_paginated_response(ActivityLogSerializer(page, many=True).data)

    def perform_destroy(self, instance):
        pid = instance.id
        broadcast.to_project(pid, 'project.deleted', {'id': pid})
        instance.delete()