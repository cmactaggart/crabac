import { eventBus } from '../../lib/event-bus.js';
import { io } from '../../websocket/socket-server.js';

export function registerMessageGateway() {
  eventBus.on('message.created', ({ message, channelId, spaceId }) => {
    if (!io) return;
    const room = `channel:${channelId}`;
    if (message.metadata?.workflowId) {
      const roomSockets = io.sockets.adapter.rooms.get(room);
      console.log(`[Gateway] Emitting workflow message ${message.id} to room ${room} (${roomSockets?.size ?? 0} sockets)`);
    }
    io.to(room).emit('message:new', message);

    // Notify the space room so channel lists can update unreads in real time
    if (spaceId) {
      const spaceRoom = `space:${spaceId}`;
      const roomSockets = io.sockets.adapter.rooms.get(spaceRoom);
      console.log(`[Gateway] Emitting channel:activity to ${spaceRoom} (${roomSockets?.size ?? 0} sockets) channelId=${channelId}`);
      io.to(spaceRoom).emit('channel:activity', {
        channelId,
        authorId: message.authorId,
        messageId: message.id,
        spaceId,
      });
    }
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
