import { eventBus } from '../../lib/event-bus.js';
import { io } from '../../websocket/socket-server.js';
import { sendPushNotification } from './push.service.js';
import { db } from '../../database/connection.js';
import { config } from '../../config.js';

function getActorName(notification: any): string {
  const d = notification.data || {};
  return d.fromDisplayName || d.authorDisplayName || d.commenterDisplayName || d.taggedByDisplayName || d.authorUsername || d.repliedByUsername || d.repliedByDisplayName || d.reactedByUsername || 'Someone';
}

function formatNotificationForPush(notification: any): { title: string; body: string } {
  const actor = getActorName(notification);
  const d = notification.data || {};
  const spaceChannel = d.spaceName && d.channelName ? `${actor} (${d.spaceName} | #${d.channelName})` : actor;
  switch (notification.type) {
    case 'mention':
      return { title: spaceChannel, body: d.messagePreview || 'mentioned you' };
    case 'dm_request':
      return { title: actor, body: 'sent you a message request' };
    case 'dm_message':
      return { title: actor, body: d.preview || 'sent you a message' };
    case 'reply':
      return { title: spaceChannel, body: d.messagePreview || 'replied to your message' };
    case 'reaction':
      return { title: spaceChannel, body: `${d.emoji || ''} reacted to your message`.trim() };
    case 'friend_request':
      return { title: 'Friend Request', body: `${actor} sent you a friend request` };
    case 'post_tag':
      return { title: actor, body: 'tagged you in a post' };
    case 'post_comment':
      return { title: actor, body: d.commentPreview || 'commented on your post' };
    case 'new_event': {
      let eventBody = `${d.spaceName || 'A space'} has posted a new event: ${d.eventName || 'an event'}`;
      if (d.eventDate) eventBody += ` ${d.eventDate}`;
      if (d.eventTime) eventBody += ` ${d.eventTime}`;
      return { title: d.spaceName || 'New Event', body: eventBody };
    }
    case 'new_blog_post':
      return { title: d.spaceName || 'New Blog Post', body: `New blog post from ${d.spaceName}: ${d.postTitle}` };
    case 'event_rsvp':
      return { title: d.spaceName || 'Event RSVP', body: `${d.rsvpDisplayName || d.rsvpUsername} RSVP'd ${d.rsvpStatus} to ${d.eventName}` };
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
    if (d.eventId) pushData.eventId = d.eventId;
    if (d.postId) pushData.postId = d.postId;

    // Resolve actor avatar URL for rich notifications
    const actorUserId = d.fromUserId || d.taggedByUserId || d.commenterUserId;
    const actorUsername = d.authorUsername || d.repliedByUsername || d.reactedByUsername || d.fromUsername;
    if (notification.type === 'new_event' && d.spaceId) {
      // Use space icon for event notifications
      const space = await db('spaces').where('id', d.spaceId).select('icon_url').first();
      if (space?.icon_url) pushData.avatarUrl = `${config.apiUrl}${space.icon_url}`;
    } else if (notification.type === 'new_blog_post' && d.spaceId) {
      const space = await db('spaces').where('id', d.spaceId).select('icon_url').first();
      if (space?.icon_url) pushData.avatarUrl = `${config.apiUrl}${space.icon_url}`;
    } else if (actorUserId) {
      const actor = await db('users').where('id', actorUserId).select('avatar_url').first();
      if (actor?.avatar_url) pushData.avatarUrl = `${config.apiUrl}${actor.avatar_url}`;
    } else if (actorUsername) {
      const actor = await db('users').where('username', actorUsername).select('avatar_url').first();
      if (actor?.avatar_url) pushData.avatarUrl = `${config.apiUrl}${actor.avatar_url}`;
    }

    sendPushNotification(userId, pushContent.title, pushContent.body, pushData);
  });
}
