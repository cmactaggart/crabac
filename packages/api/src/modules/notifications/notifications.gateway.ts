import { eventBus } from '../../lib/event-bus.js';
import { io } from '../../websocket/socket-server.js';
import { sendPushNotification } from './push.service.js';

function formatNotificationForPush(notification: any): { title: string; body: string } {
  const actor = notification.actorDisplayName || 'Someone';
  switch (notification.type) {
    case 'message_mention':
      return { title: `${actor} mentioned you`, body: notification.preview || 'in a message' };
    case 'dm_message':
      return { title: `${actor}`, body: notification.preview || 'sent you a message' };
    case 'thread_reply':
      return { title: `${actor} replied`, body: notification.preview || 'to a thread' };
    case 'friend_request':
      return { title: 'Friend Request', body: `${actor} sent you a friend request` };
    default:
      return { title: 'crab.ac', body: `${actor} sent you a notification` };
  }
}

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

    // Send push notification
    const pushContent = formatNotificationForPush(notification);
    sendPushNotification(userId, pushContent.title, pushContent.body, { type: notification.type, ...(notification.spaceId ? { spaceId: notification.spaceId } : {}) });
  });
}
