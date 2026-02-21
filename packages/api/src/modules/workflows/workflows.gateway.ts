import { eventBus } from '../../lib/event-bus.js';
import { io } from '../../websocket/socket-server.js';

export function registerWorkflowGateway() {
  eventBus.on('workflow.card_created', ({ instance, channelId }) => {
    if (!io) return;
    io.to(`channel:${channelId}`).emit('workflow:card_created', instance);
  });

  eventBus.on('workflow.card_updated', ({ instance, channelId }) => {
    if (!io) return;
    io.to(`channel:${channelId}`).emit('workflow:card_updated', instance);
  });

  eventBus.on('workflow.card_dismissed', ({ instance, channelId }) => {
    if (!io) return;
    io.to(`channel:${channelId}`).emit('workflow:card_dismissed', instance);
  });
}
