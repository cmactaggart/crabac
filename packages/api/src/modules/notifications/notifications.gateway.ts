import { eventBus } from '../../lib/event-bus.js';
import { io } from '../../websocket/socket-server.js';
import { sendPushNotification } from './push.service.js';

function getActorName(notification: any): string {
  const d = notification.data || {};
  return d.fromDisplayName || d.authorDisplayName || d.authorUsername || d.repliedByUsername || d.repliedByDisplayName || 'Someone';
}

function formatNotificationForPush(notification: any): { title: string; body: string } {
  const actor = getActorName(notification);
  const d = notification.data || {};
  switch (notification.type) {
    case 'mention':
      return { title: `${actor} mentioned you`, body: d.channelName ? `in #${d.channelName}` : 'in a message' };
    case 'dm_request':
      return { title: `${actor}`, body: 'sent you a message request' };
    case 'dm_message':
      return { title: `${actor}`, body: d.preview || 'sent you a message' };
    case 'reply':
      return { title: `${actor} replied`, body: 'to a thread' };
    case 'friend_request':
      return { title: 'Friend Request', body: `${actor} sent you a friend request` };
    case 'post_tag':
      return { title: `${actor} tagged you`, body: 'in a post' };
    case 'post_comment':
      return { title: `${actor} commented`, body: 'on your post' };
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
    const d = notification.data || {};
    const pushData: Record<string, string> = { type: notification.type };
    if (d.spaceId) pushData.spaceId = d.spaceId;
    if (d.channelId) pushData.channelId = d.channelId;
    if (d.messageId) pushData.messageId = d.messageId;
    if (d.conversationId) pushData.conversationId = d.conversationId;
    sendPushNotification(userId, pushContent.title, pushContent.body, pushData);
  });
}
