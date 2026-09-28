from .models import ActivityLog


def log_activity(project, actor, verb, description):
    return ActivityLog.objects.create(
        project=project, actor=actor, verb=verb, description=description
    )