from datetime import timedelta

from django.db.models import Case, Count, IntegerField, Q, When
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from activity import broadcast
from activity.models import ActivityLog
from activity.serializers import ActivityLogSerializer
from activity.utils import log_activity
from projects.models import Membership, Project
from projects.permissions import CanMarkTaskDone, IsProjectMember
from .filters import TaskFilter
from .models import Task
from .pagination import TaskPagination
from .serializers import CommentSerializer, TaskSerializer


class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated, IsProjectMember, CanMarkTaskDone]
    pagination_class = TaskPagination
    filterset_class = TaskFilter
    search_fields = ['title']
    # priority is text, so we sort on a numeric rank instead:
    # ?ordering=-priority_rank,due_date  (multi-column)
    ordering_fields = ['priority_rank', 'due_date', 'created_at', 'status']
    ordering = ['-created_at']

    def get_queryset(self):
        # Scoped to projects the user belongs to: outsiders get 404, never data.
        return (
            Task.objects.filter(project__memberships__user=self.request.user)
            .select_related('project', 'assignee', 'created_by')
            .prefetch_related('comments__author')
            .annotate(priority_rank=Case(
                When(priority=Task.HIGH, then=3),
                When(priority=Task.MEDIUM, then=2),
                default=1, output_field=IntegerField(),
            ))
        )

    def perform_create(self, serializer):
        user = self.request.user
        project = serializer.validated_data['project']

        membership = Membership.objects.filter(project=project, user=user).first()
        if membership is None:
            raise PermissionDenied('You are not a member of this project.')

        if serializer.validated_data.get('status') == Task.DONE:
            is_owner = membership.role == Membership.OWNER
            if not is_owner and serializer.validated_data.get('assignee_id') != user.id:
                raise PermissionDenied(CanMarkTaskDone.message)

        task = serializer.save(created_by=user)
        log_activity(project, user, 'created task', f"created '{task.title}'")
        if task.assignee_id:
            log_activity(project, user, 'assigned task',
                         f"assigned '{task.title}' to {task.assignee.email}")

        data = TaskSerializer(task).data
        broadcast.to_project(project.id, 'task.created', data)
        if task.assignee_id:
            broadcast.to_user(task.assignee_id, 'task.assigned', data, project.id)

    def perform_update(self, serializer):
        old_status = serializer.instance.status
        old_assignee = serializer.instance.assignee_id
        task = serializer.save()

        if task.status != old_status:
            log_activity(task.project, self.request.user, 'moved task',
                         f"moved '{task.title}' to {task.get_status_display()}")
        if task.assignee_id != old_assignee:
            who = task.assignee.email if task.assignee else 'nobody'
            log_activity(task.project, self.request.user, 'assigned task',
                         f"assigned '{task.title}' to {who}")

        data = TaskSerializer(task).data
        broadcast.to_project(task.project_id, 'task.updated', data)
        if task.assignee_id != old_assignee:
            if task.assignee_id:
                broadcast.to_user(task.assignee_id, 'task.assigned', data, task.project_id)
            if old_assignee:
                broadcast.to_user(old_assignee, 'task.unassigned', {'id': task.id}, task.project_id)

    def perform_destroy(self, instance):
        pid, tid, assignee = instance.project_id, instance.id, instance.assignee_id
        instance.delete()
        broadcast.to_project(pid, 'task.deleted', {'id': tid})
        if assignee:
            broadcast.to_user(assignee, 'task.unassigned', {'id': tid}, pid)

    @action(detail=True, methods=['post'])
    def comments(self, request, pk=None):
        task = self.get_object()  # member-only via queryset scoping
        s = CommentSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        s.save(task=task, author=request.user)
        log_activity(task.project, request.user, 'commented', f"commented on '{task.title}'")
        broadcast.to_project(task.project_id, 'comment.created',
                             {'task_id': task.id, 'comment': s.data})
        return Response(s.data, status=201)

    @action(detail=False, methods=['get'], url_path='assigned-to-me')
    def assigned_to_me(self, request):
        qs = self.filter_queryset(self.get_queryset().filter(assignee=request.user))
        page = self.paginate_queryset(qs)
        return self.get_paginated_response(self.get_serializer(page, many=True).data)


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        now = timezone.now()
        week_start = (now - timedelta(days=now.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0)

        by_status = {value: 0 for value, _ in Task.STATUS_CHOICES}
        for row in Task.objects.filter(assignee=user).values('status').annotate(n=Count('id')):
            by_status[row['status']] = row['n']

        top = (Project.objects.filter(memberships__user=user)
               .annotate(open_tasks=Count('tasks', filter=~Q(tasks__status=Task.DONE)))
             .order_by('-open_tasks', 'title').first())

        return Response({
            'project_count': Project.objects.filter(memberships__user=user).count(),
            'tasks_by_status': by_status,
            # completed = assigned to me and marked Done since Monday
            'completed_this_week': Task.objects.filter(
                assignee=user, completed_at__gte=week_start).count(),
            'busiest_project': (
                {'id': top.id, 'name': top.title, 'open_tasks': top.open_tasks}
                if top and top.open_tasks else None),
            'recent_activity': ActivityLogSerializer(
                ActivityLog.objects.filter(actor=user).select_related('actor')[:10],
                many=True).data,
        })