import { eventBus } from '../../lib/event-bus.js';
import { io } from '../../websocket/socket-server.js';
import { sendPushNotification } from '../notifications/push.service.js';
import { db } from '../../database/connection.js';
import { config } from '../../config.js';

export function registerCallGateway() {
  // Incoming call — ring all participants via their personal rooms
  eventBus.on('call.ringing', async ({ call, callerId, conversationId }) => {
    if (!io) return;

    for (const participant of call.participants) {
      if (participant.userId === callerId) continue;

      // Send via personal room so the user gets it regardless of which page they're on
      io.to(`user:${participant.userId}`).emit('call:ringing', {
        call,
        conversationId,
      });

      // Push notification for offline users
      try {
        const connectedSockets = await io.in(`user:${participant.userId}`).fetchSockets();
        if (connectedSockets.length === 0) {
          const caller = call.participants.find((p: any) => p.userId === callerId);
          const callerName = caller?.displayName || caller?.username || 'Someone';
          sendPushNotification(
            participant.userId,
            callerName,
            'Incoming call',
            { type: 'call_ringing', callId: call.id, conversationId },
          );
        }
      } catch {
        // ignore push errors
      }
    }
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
  });

  // Participant declined
  eventBus.on('call.participant_declined', ({ call, userId, conversationId }) => {
    if (!io) return;

    if (conversationId) {
      io.to(`dm:${conversationId}`).emit('call:participant_declined', { call, userId });
    }
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
  });
}
