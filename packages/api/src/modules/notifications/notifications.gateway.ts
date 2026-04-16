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
      return { title: spaceChannel, body: `${d.emoji || ''} to: ${d.messagePreview || 'your message'}`.trim() };
    case 'follow_request':
      return { title: actor, body: 'sent you a follow request' };
    case 'post_tag':
      return { title: actor, body: `tagged you in a post: ${d.postPreview || ''}`.trim() };
    case 'post_comment':
      return { title: `${actor} commented on your post`, body: d.commentPreview || '' };
    case 'new_event': {
      let eventTime = '';
      if (d.eventDate && d.eventTime) eventTime = ` — ${d.eventDate} at ${d.eventTime}`;
      else if (d.eventDate) eventTime = ` — ${d.eventDate}`;
      else if (d.eventTime) eventTime = ` — ${d.eventTime}`;
      return { title: d.spaceName || 'New Event', body: `New event: ${d.eventName || 'an event'}${eventTime}` };
    }
    case 'event_cancelled': {
      const cancelParts = [];
      if (d.eventDate) cancelParts.push(d.eventDate);
      if (d.eventTime) cancelParts.push(d.eventTime);
      return { title: `Canceled: ${d.eventName || 'Event'}`, body: cancelParts.length ? `Was ${cancelParts.join(' - ')} and has been canceled.` : 'Has been canceled.' };
    }
    case 'portal_invite':
      return { title: 'Portal Request', body: `${d.requestedByUsername || actor} sent a portal request from ${d.sourceSpaceName || 'a space'}` };
    case 'new_blog_post':
      return { title: d.spaceName || 'New Blog Post', body: `New blog post from ${d.spaceName}: ${d.postTitle}` };
    case 'event_rsvp':
      return { title: d.spaceName || 'Event RSVP', body: `${d.rsvpDisplayName || d.rsvpUsername} RSVP'd ${d.rsvpStatus} to ${d.eventName}` };
    case 'event_organizer_needed': {
      const title = `${d.spaceName || 'A space'} — Organizer Needed`;
      const dateParts = [];
      if (d.eventDate) dateParts.push(d.eventDate);
      if (d.eventTime) dateParts.push(d.eventTime);
      const when = dateParts.length ? ` / ${dateParts.join(' ')}` : '';
      return { title, body: `${d.eventName || 'An event'}${when}` };
    }
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
    const d = notification.data || {};

    // Skip push if user has the space muted
    if (d.spaceId) {
      const spaceMuted = await db('space_mutes')
        .where({ space_id: d.spaceId, user_id: userId })
        .first();
      if (spaceMuted) return;
    }

    const pushContent = formatNotificationForPush(notification);
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
    } else if (notification.type === 'event_organizer_needed' && d.spaceId) {
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
