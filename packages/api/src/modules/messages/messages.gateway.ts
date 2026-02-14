import { eventBus } from '../../lib/event-bus.js';
import { io } from '../../websocket/socket-server.js';

export function registerMessageGateway() {
  eventBus.on('message.created', ({ message, channelId }) => {
    if (!io) return;
    const room = `channel:${channelId}`;
    io.to(room).emit('message:new', message);
  });

  eventBus.on('message.updated', ({ message, channelId }) => {
    if (!io) return;
    io.to(`channel:${channelId}`).emit('message:updated', message);
  });

  eventBus.on('message.deleted', ({ channelId, messageId }) => {
    if (!io) return;
    io.to(`channel:${channelId}`).emit('message:deleted', { channelId, messageId });
  });

  eventBus.on('message.reactions_updated', ({ channelId, messageId, reactions }) => {
    if (!io) return;
    io.to(`channel:${channelId}`).emit('message:reactions_updated', { channelId, messageId, reactions });
  });

  eventBus.on('space.member_joined', ({ spaceId, userId }) => {
    if (!io) return;
    io.to(`space:${spaceId}`).emit('space:member_joined', { spaceId, userId });
  });

  eventBus.on('space.member_left', ({ spaceId, userId }) => {
    if (!io) return;
    io.to(`space:${spaceId}`).emit('space:member_left', { spaceId, userId });
  });
}
