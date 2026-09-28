from django.conf import settings
from django.db import models

class Project(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='owned_projects'
    )
    # FIX: Point the through argument to 'Membership' instead of 'ProjectMembership'
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        through='Membership',
        related_name='joined_projects'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

# FIX: Name aligns with the through definition above
class Membership(models.Model):
    OWNER = 'owner'
    MEMBER = 'member'
    ROLE_CHOICES = [(OWNER, 'Owner'), (MEMBER, 'Member')]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='memberships')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='memberships')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default=MEMBER)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'project')

    def __str__(self):
        return f"{self.user.email} - {self.project.title} ({self.role})"
