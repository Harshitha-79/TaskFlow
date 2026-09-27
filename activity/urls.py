from django.urls import path
from .views import PersonalDashboardAPIView, ProjectActivityLogAPIView

urlpatterns = [
    path('dashboard/', PersonalDashboardAPIView.as_view(), name='personal_dashboard'),
    path('projects/<int:project_id>/logs/', ProjectActivityLogAPIView.as_view(), name='project_activity_logs'),
]
