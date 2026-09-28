from datetime import date
from rest_framework import serializers
from .models import Task, Comment
from accounts.serializers import UserSerializer
from projects.models import Membership


class CommentSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)

    class Meta:
        model = Comment
        fields = ['id', 'task', 'author', 'body', 'created_at']
        read_only_fields = ['task', 'author']


class TaskSerializer(serializers.ModelSerializer):
    assignee = UserSerializer(read_only=True)
    assignee_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    comments = CommentSerializer(many=True, read_only=True)

    class Meta:
        model = Task
        fields = [
            'id', 'project', 'title', 'description', 'status', 'priority',
            'due_date', 'completed_at', 'assignee', 'assignee_id',
            'created_by', 'created_at', 'comments',
        ]
        read_only_fields = ['completed_at', 'created_by']

    def validate_title(self, value):
        if not value.strip():
            raise serializers.ValidationError("Title cannot be empty.")
        return value

    def validate_due_date(self, value):
        # only enforce on create, not on edits to an already-past-due task
        if self.instance is None and value and value < date.today():
            raise serializers.ValidationError("Due date cannot be in the past.")
        return value

    def validate(self, attrs):
        assignee_id = attrs.get('assignee_id')
        project = attrs.get('project') or getattr(self.instance, 'project', None)
        if assignee_id is not None and project is not None:
            is_member = Membership.objects.filter(project=project, user_id=assignee_id).exists()
            if not is_member:
                raise serializers.ValidationError(
                    {'assignee_id': 'Assignee must be a member of this project.'}
                )
                if self.instance and 'project' in attrs and attrs['project'] != self.instance.project:
                    raise serializers.ValidationError({'project': 'A task cannot be moved to another project.'})    
        return attrs