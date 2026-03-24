import { eventBus } from '../../lib/event-bus.js';
import { io } from '../../websocket/socket-server.js';
import { sendVoipPush, sendPushNotification } from '../notifications/push.service.js';
import { db } from '../../database/connection.js';
import { config } from '../../config.js';

const RINGING_TIMEOUT_MS = 60_000; // 60 seconds

export function registerCallGateway() {
  // Incoming call — ring all participants via their personal rooms
  eventBus.on('call.ringing', async ({ call, callerId, conversationId }) => {
    if (!io) return;

    // Look up conversation name for group DMs
    let conversationName: string | null = null;
    if (conversationId) {
      const conv = await db('conversations').where('id', conversationId).first();
      if (conv?.name) conversationName = conv.name;
    }

    const caller = call.participants.find((p: any) => p.userId === callerId);
    const callerName = caller?.displayName || caller?.username || 'Someone';
    // For group DMs, show the group name; for 1:1 DMs, show the caller name
    const pushDisplayName = conversationName || callerName;

    for (const participant of call.participants) {
      if (participant.userId === callerId) continue;

      // Send via personal room so the user gets it regardless of which page they're on
      io.to(`user:${participant.userId}`).emit('call:ringing', {
        call,
        conversationId,
      });

      // VoIP push for mobile (triggers CallKit on iOS, full-screen intent on Android)
      try {
        sendVoipPush(participant.userId, {
          callId: call.id,
          conversationId,
          callerName: pushDisplayName,
          callerAvatarUrl: caller?.avatarUrl || null,
        });
      } catch {
        // ignore push errors
      }
    }

    // Auto-end the call if still ringing after timeout
    setTimeout(async () => {
      try {
        const current = await db('calls').where('id', call.id).first();
        if (current && current.status === 'ringing') {
          await db('calls').where('id', call.id).update({ status: 'ended', ended_at: db.fn.now(3) });
          await db('call_participants').where({ call_id: call.id, status: 'ringing' }).update({ status: 'missed' });

          const endedCall = await db('calls').where('id', call.id).first();
          if (endedCall) {
            const { deleteRoom } = await import('livekit-server-sdk').then((m) => {
              const rs = new m.RoomServiceClient(config.livekit.host, config.livekit.apiKey, config.livekit.apiSecret);
              return { deleteRoom: (name: string) => rs.deleteRoom(name) };
            });
            deleteRoom(endedCall.room_name).catch(() => {});
          }

          // Notify all participants
          if (conversationId) {
            io.to(`dm:${conversationId}`).emit('call:ended', { call: { ...call, status: 'ended' }, conversationId });
          }
          for (const p of call.participants) {
            io.to(`user:${p.userId}`).emit('call:ended', { call: { ...call, status: 'ended' } });
          }
        }
      } catch {
        // ignore timeout cleanup errors
      }
    }, RINGING_TIMEOUT_MS);
  });

  // Participant joined
  eventBus.on('call.participant_joined', ({ call, userId, conversationId, channelId, spaceId }) => {
    if (!io) return;

    if (conversationId) {
      io.to(`dm:${conversationId}`).emit('call:participant_joined', { call, userId });
    }
    if (channelId && spaceId) {
      io.to(`space:${spaceId}`).emit('call:participant_joined', { call, userId, channelId });
    }

    // Notify the user's other devices so they can dismiss the incoming call
    io.to(`user:${userId}`).emit('call:answered_elsewhere', { callId: call.id });

    // Silent push to cancel ringing on mobile devices that may be backgrounded
    for (const p of call.participants) {
      if (p.userId === userId) continue; // skip the one who just joined
      if (p.status === 'ringing') {
        sendPushNotification(p.userId, '', '', {
          type: 'call_answered_elsewhere',
          callId: call.id,
        }).catch(() => {});
      }
    }
  });

  // Participant declined
  eventBus.on('call.participant_declined', ({ call, userId, conversationId }) => {
    if (!io) return;

    if (conversationId) {
      io.to(`dm:${conversationId}`).emit('call:participant_declined', { call, userId });
    }

    // Notify the user's other devices so they can dismiss the incoming call
    io.to(`user:${userId}`).emit('call:declined_elsewhere', { callId: call.id });
  });

  // Participant left
  eventBus.on('call.participant_left', ({ call, userId, conversationId, channelId, spaceId }) => {
    if (!io) return;

    if (conversationId) {
      io.to(`dm:${conversationId}`).emit('call:participant_left', { call, userId });
    }
    if (channelId && spaceId) {
      io.to(`space:${spaceId}`).emit('call:participant_left', { call, userId, channelId });
    }
  });

  // Call ended
  eventBus.on('call.ended', ({ call, conversationId, channelId, spaceId }) => {
    if (!io) return;

    if (conversationId) {
      io.to(`dm:${conversationId}`).emit('call:ended', { call, conversationId });
    }
    if (channelId && spaceId) {
      io.to(`space:${spaceId}`).emit('call:ended', { call, channelId });
    }

    // Silent push to cancel ringing on mobile devices
    for (const p of call.participants) {
      sendPushNotification(p.userId, '', '', {
        type: 'call_ended',
        callId: call.id,
      }).catch(() => {});
    }
  });
}
