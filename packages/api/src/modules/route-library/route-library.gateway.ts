import { eventBus } from '../../lib/event-bus.js';
import { io } from '../../websocket/socket-server.js';

export function registerRouteLibraryGateway() {
  eventBus.on('route.item_created', ({ item, channelId }) => {
    if (!io) return;
    io.to(`channel:${channelId}`).emit('route:item_created', item);
  });

  eventBus.on('route.item_deleted', ({ itemId, channelId }) => {
    if (!io) return;
    io.to(`channel:${channelId}`).emit('route:item_deleted', { itemId, channelId });
  });
}
