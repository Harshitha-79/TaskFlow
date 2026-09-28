from rest_framework import serializers
from .models import ActivityLog
from accounts.serializers import UserSerializer


class ActivityLogSerializer(serializers.ModelSerializer):
    actor = UserSerializer(read_only=True)

    class Meta:
        model = ActivityLog
        fields = ['id', 'project', 'actor', 'verb', 'description', 'created_at']