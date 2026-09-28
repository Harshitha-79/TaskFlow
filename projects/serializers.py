from rest_framework import serializers
from .models import Project, Membership
from accounts.serializers import UserSerializer


class MembershipSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Membership
        fields = ['id', 'user', 'role', 'joined_at']


class ProjectSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)
    memberships = MembershipSerializer(many=True, read_only=True)
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = ['id', 'title', 'description', 'owner', 'created_at', 'memberships', 'member_count']
        read_only_fields = ['owner']

    def get_member_count(self, obj):
        return obj.memberships.count()


class InviteMemberSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        if not User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("No registered user with this email.")
        return value