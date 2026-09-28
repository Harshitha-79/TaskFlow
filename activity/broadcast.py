import logging
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction

log = logging.getLogger(__name__)


def _send(group, message):
    try:
        async_to_sync(get_channel_layer().group_send)(group, message)
    except Exception:  # Redis down must never break a REST write
        log.exception('WebSocket broadcast failed for %s', group)


def to_project(project_id, event, data=None):
    payload = {'event': event, 'project_id': project_id, 'data': data}
    transaction.on_commit(lambda: _send(f'project_{project_id}', {'type': 'project.event', 'payload': payload}))


def to_user(user_id, event, data=None, project_id=None):
    payload = {'event': event, 'project_id': project_id, 'data': data}
    transaction.on_commit(lambda: _send(f'user_{user_id}', {'type': 'user.event', 'payload': payload}))


def membership(user_id, project_id, granted):
    kind = 'membership.granted' if granted else 'membership.revoked'
    transaction.on_commit(lambda: _send(f'user_{user_id}', {'type': kind, 'project_id': project_id}))