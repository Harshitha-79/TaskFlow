from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.serializers import UserRegisterSerializer
from activity.utils import log_activity
from projects.models import Membership, Project
from tasks.models import Comment, Task

User = get_user_model()
PASSWORD = 'TaskFlow@2026'


def get_or_create_user(name, email):
    user = User.objects.filter(email__iexact=email).first()
    if user:
        return user
    s = UserRegisterSerializer(data={'name': name, 'email': email, 'password': PASSWORD})
    s.is_valid(raise_exception=True)
    return s.save()


class Command(BaseCommand):
    help = 'Create two demo users, a shared project and sample tasks (idempotent).'

    @transaction.atomic
    def handle(self, *args, **options):
        alice = get_or_create_user('Alice Demo', 'alice@example.com')
        bob = get_or_create_user('Bob Demo', 'bob@example.com')

        project, created = Project.objects.get_or_create(
            title='Website Redesign', owner=alice,
            defaults={'description': 'Demo project shared by Alice and Bob'},
        )
        Membership.objects.get_or_create(user=alice, project=project, defaults={'role': Membership.OWNER})
        Membership.objects.get_or_create(user=bob, project=project, defaults={'role': Membership.MEMBER})

        if created:
            today = date.today()
            specs = [
                ('Design landing page', 'Hero, pricing, footer', Task.TODO, Task.HIGH, today + timedelta(days=5), bob),
                ('Set up CI pipeline', 'Run checks on every push', Task.IN_PROGRESS, Task.MEDIUM, today + timedelta(days=7), alice),
                ('Write launch copy', '', Task.TODO, Task.LOW, None, None),
                ('Fix login bug', 'Users get logged out on refresh', Task.DONE, Task.HIGH, None, bob),
            ]
            first = None
            for title, desc, status, prio, due, assignee in specs:
                t = Task.objects.create(
                    project=project, title=title, description=desc, status=status,
                    priority=prio, due_date=due, assignee=assignee, created_by=alice)
                first = first or t
                log_activity(project, alice, 'created task', f"created '{t.title}'")
            log_activity(project, alice, 'invited member', f'invited {bob.email}')
            Comment.objects.create(task=first, author=bob, body='On it, will have a draft tomorrow.')
            log_activity(project, bob, 'commented', f"commented on '{first.title}'")

        self.stdout.write(self.style.SUCCESS(
            f'Seeded. Login: alice@example.com / bob@example.com, password: {PASSWORD}'))