# Create your models here.
from django.db import models
from django.conf import settings
from projects.models import Project


class ActivityLog(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='activity_logs')
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    verb = models.CharField(max_length=100)          # e.g. "created task", "moved task", "invited member"
    description = models.CharField(max_length=255)   # human-readable detail, e.g. "moved 'Fix login bug' to Done"
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']   # reverse-chronological by default

    def __str__(self):
        return f'{self.actor} {self.verb} in {self.project}'