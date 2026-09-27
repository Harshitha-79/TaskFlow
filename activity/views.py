from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.utils import timezone
from datetime import timedelta
from tasks.models import Task
from .models import ActivityLog
from tasks.serializers import TaskSerializer
from projects.models import Project

class PersonalDashboardAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        now = timezone.now()
        one_week_ago = now - timedelta(days=7)

        # 1. Compute quick metrics for the logged-in developer
        assigned_tasks = Task.objects.filter(assignee=user)
        total_assigned = assigned_tasks.count()
        todo_count = assigned_tasks.filter(status='TODO').count()
        in_progress_count = assigned_tasks.filter(status='IN_PROGRESS').count()
        
        # 2. Extract tasks completed during this explicit 7-day sprint window
        completed_this_week = assigned_tasks.filter(
            status='DONE', 
            completed_date__gte=one_week_ago
        ).count()

        # 3. Pull recent personal task workload objects list
        recent_tasks = assigned_tasks.exclude(status='DONE')[:5]
        task_serializer = TaskSerializer(recent_tasks, many=True)

        return Response({
            "metrics": {
                "total_assigned": total_assigned,
                "todo": todo_count,
                "in_progress": in_progress_count,
                "completed_this_week": completed_this_week
            },
            "recent_tasks": task_serializer.data
        }, status=status.HTTP_200_OK)

class ProjectActivityLogAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_id):
        # Enforce security: Ensure user belongs to the project room they are auditing
        if not Project.objects.filter(id=project_id, members=request.user).exists():
            return Response({"error": "Access denied. You are not a member of this project."}, status=status.HTTP_403_FORBIDDEN)

        # Pull reverse-chronological event lists (ordering is handled implicitly by model Meta)
        logs = ActivityLog.objects.filter(project_id=project_id)[:50]
        
        logs_data = [{
            "id": log.id,
            "actor": log.actor.name,
            "event_type": log.get_event_type_display(),
            "description": log.description,
            "created_at": log.created_at
        } for log in logs]

        return Response(logs_data, status=status.HTTP_200_OK)
