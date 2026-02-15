import { eventBus } from '../../lib/event-bus.js';
import { io } from '../../websocket/socket-server.js';

export function registerGalleryGateway() {
  eventBus.on('gallery.item_created', ({ item, channelId }) => {
    if (!io) return;
    io.to(`channel:${channelId}`).emit('gallery:item_created', item);
  });

  eventBus.on('gallery.item_deleted', ({ itemId, channelId }) => {
    if (!io) return;
    io.to(`channel:${channelId}`).emit('gallery:item_deleted', { itemId, channelId });
  });
}
