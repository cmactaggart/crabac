import { eventBus } from '../../lib/event-bus.js';
import { io } from '../../websocket/socket-server.js';
import { createNotification } from '../notifications/notifications.service.js';

export function registerDMGateway() {
  eventBus.on('dm.created', ({ message, conversationId }) => {
    if (!io) return;
    io.to(`dm:${conversationId}`).emit('dm:new', message);
  });

  eventBus.on('dm.updated', ({ message, conversationId }) => {
    if (!io) return;
    io.to(`dm:${conversationId}`).emit('dm:updated', message);
  });

  eventBus.on('dm.deleted', ({ conversationId, messageId }) => {
    if (!io) return;
    io.to(`dm:${conversationId}`).emit('dm:deleted', { conversationId, messageId });
  });

  // Message request created (DM to non-friend)
  eventBus.on('dm.request_created', async ({ conversation, senderId, recipientId, senderUsername, senderDisplayName }) => {
    if (!io) return;
    // Notify recipient of the message request
    io.to(`user:${recipientId}`).emit('conversation:created', conversation);

    try {
      await createNotification(recipientId, 'dm_request', {
        conversationId: conversation.id,
        fromUsername: senderUsername,
        fromDisplayName: senderDisplayName,
        fromUserId: senderId,
      });
    } catch {
      // ignore
    }
  });

  // Group DM or accepted conversation created
  eventBus.on('conversation.created', ({ conversation, participantIds }) => {
    if (!io) return;
    for (const pid of participantIds) {
      io.to(`user:${pid}`).emit('conversation:created', conversation);
    }
  });

  // Conversation updated (renamed)
  eventBus.on('conversation.updated', ({ conversation }) => {
    if (!io) return;
    io.to(`dm:${conversation.id}`).emit('conversation:updated', conversation);
  });

  // Member left group
  eventBus.on('conversation.member_left', ({ conversationId, userId }) => {
    if (!io) return;
    io.to(`dm:${conversationId}`).emit('conversation:member_left', { conversationId, userId });
  });
}
