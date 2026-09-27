from rest_framework import permissions
from .models import Membership


class IsProjectMember(permissions.BasePermission):
    """Object must have a `.project` attribute (Task, Comment via task.project, etc.)
    or BE a Project. User must have a Membership row for it."""

    def has_object_permission(self, request, view, obj):
        project = obj if hasattr(obj, 'memberships') else obj.project
        return Membership.objects.filter(project=project, user=request.user).exists()


class IsProjectOwner(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        project = obj if hasattr(obj, 'memberships') else obj.project
        return Membership.objects.filter(
            project=project, user=request.user, role=Membership.OWNER
        ).exists()


class CanMarkTaskDone(permissions.BasePermission):
    """Only the task's assignee or the project owner may set status to Done."""

    def has_object_permission(self, request, view, obj):
        if request.data.get('status') != 'done':
            return True  # not attempting to mark Done, defer to other checks
        if obj.assignee_id == request.user.id:
            return True
        return Membership.objects.filter(
            project=obj.project, user=request.user, role=Membership.OWNER
        ).exists()