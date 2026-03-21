import { eventBus } from '../../lib/event-bus.js';
import { io } from '../../websocket/socket-server.js';
import { createNotification } from '../notifications/notifications.service.js';
import { db } from '../../database/connection.js';
import { sendPushNotification } from '../notifications/push.service.js';
import { config } from '../../config.js';

export function registerDMGateway() {
  eventBus.on('dm.created', async ({ message, conversationId }) => {
    if (!io) return;
    io.to(`dm:${conversationId}`).emit('dm:new', message);

    // Send push notifications to participants not connected to this conversation room
    try {
      const members = await db('conversation_members')
        .where({ conversation_id: conversationId, status: 'accepted', muted: false })
        .whereNot('user_id', message.authorId)
        .select('user_id');

      const connectedSockets = await io.in(`dm:${conversationId}`).fetchSockets();
      const connectedUserIds = new Set(connectedSockets.map(s => s.data.userId));

      for (const member of members) {
        const recipientId = member.user_id.toString();
        if (!connectedUserIds.has(recipientId)) {
          const senderName = message.author?.displayName || message.author?.username || 'Someone';
          const preview = message.content?.length > 100 ? message.content.slice(0, 100) + '...' : message.content;
          const pushData: Record<string, string> = { type: 'dm_message', conversationId };
          if (message.author?.avatarUrl) pushData.avatarUrl = `${config.apiUrl}${message.author.avatarUrl}`;
          sendPushNotification(recipientId, senderName, preview || 'sent you a message', pushData);
        }
      }
    } catch {
      // ignore push errors
    }
  });

  eventBus.on('dm.updated', ({ message, conversationId }) => {
    if (!io) return;
    io.to(`dm:${conversationId}`).emit('dm:updated', message);
  });

  eventBus.on('dm.deleted', ({ conversationId, messageId }) => {
    if (!io) return;
    io.to(`dm:${conversationId}`).emit('dm:deleted', { conversationId, messageId });
  });

  eventBus.on('dm.embeds_ready', ({ conversationId, messageId, embeds }) => {
    if (!io) return;
    io.to(`dm:${conversationId}`).emit('dm:embeds_ready', { conversationId, messageId, embeds });
  });

  eventBus.on('dm.reactions_updated', ({ conversationId, messageId, reactions }) => {
    if (!io) return;
    io.to(`dm:${conversationId}`).emit('dm:reactions_updated', { conversationId, messageId, reactions });
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

  // Members added to group DM
  eventBus.on('conversation.members_added', ({ conversation, addedMemberIds, existingMemberIds }) => {
    if (!io) return;
    // Notify new members (they need to know about the conversation)
    for (const pid of addedMemberIds) {
      io.to(`user:${pid}`).emit('conversation:created', conversation);
    }
    // Notify existing members (updated participant list)
    io.to(`dm:${conversation.id}`).emit('conversation:updated', conversation);
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
