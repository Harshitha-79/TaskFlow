from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from .models import Membership


class EventsConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope['user']
        if not user.is_authenticated:
            await self.close(code=4401)  # rejected at handshake, never accepted
            return
        self.user_group = f'user_{user.id}'
        self.joined = set()
        await self.channel_layer.group_add(self.user_group, self.channel_name)
        for pid in await self._project_ids(user.id):
            await self._join(pid)
        await self.accept()

    async def disconnect(self, code):
        if hasattr(self, 'user_group'):
            await self.channel_layer.group_discard(self.user_group, self.channel_name)
            for pid in list(self.joined):
                await self._leave(pid)

    async def receive_json(self, content, **kwargs):
        if content.get('type') == 'ping':
            await self.send_json({'type': 'pong'})

    # ---- handlers for channel-layer messages ("a.b" maps to method a_b) ----
    async def project_event(self, event):
        payload = event['payload']
        await self.send_json(payload)
        if payload['event'] == 'project.deleted':
            await self._leave(payload['project_id'])

    async def user_event(self, event):
        await self.send_json(event['payload'])

    async def membership_granted(self, event):
        # re-check the DB; never trust the message alone
        pid = event['project_id']
        if await self._is_member(self.scope['user'].id, pid):
            await self._join(pid)

    async def membership_revoked(self, event):
        await self._leave(event['project_id'])
        await self.send_json({'event': 'membership.revoked', 'project_id': event['project_id']})

    # ---- helpers ----
    async def _join(self, pid):
        await self.channel_layer.group_add(f'project_{pid}', self.channel_name)
        self.joined.add(pid)

    async def _leave(self, pid):
        await self.channel_layer.group_discard(f'project_{pid}', self.channel_name)
        self.joined.discard(pid)

    @database_sync_to_async
    def _project_ids(self, user_id):
        return list(Membership.objects.filter(user_id=user_id).values_list('project_id', flat=True))

    @database_sync_to_async
    def _is_member(self, user_id, pid):
        return Membership.objects.filter(user_id=user_id, project_id=pid).exists()