import { eventBus } from '../../lib/event-bus.js';
import { io } from '../../websocket/socket-server.js';

export function registerNotificationGateway() {
  eventBus.on('notification.created', async ({ notification, userId }) => {
    if (!io) return;
    // Find all sockets for this user and emit to them
    const sockets = await io.fetchSockets();
    for (const socket of sockets) {
      if (socket.data.userId === userId) {
        socket.emit('notification:new', notification);
      }
    }
  });
}
