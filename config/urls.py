from django.contrib import admin
from django.urls import path, include
from rest_framework_nested import routers
from projects.views import ProjectViewSet
from tasks.views import TaskViewSet

router = routers.SimpleRouter()
router.register(r'projects', ProjectViewSet, basename='project')

# Nested routing allows urls like /api/projects/1/tasks/
projects_router = routers.NestedSimpleRouter(router, r'projects', lookup='project')
projects_router.register(r'tasks', TaskViewSet, basename='project-tasks')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/analytics/', include('activity.urls')),
    path('api/', include(router.urls)),
    path('api/', include(projects_router.urls)),
]
