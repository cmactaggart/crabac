import { eventBus } from '../../lib/event-bus.js';
import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { createNotification } from '../notifications/notifications.service.js';

export function registerCalendarListener() {
  eventBus.on('calendar.event.created', async ({ event, spaceId }: { event: any; spaceId: string }) => {
    try {
      const space = await db('spaces').where('id', spaceId).first();
      if (!space) return;

      const creator = await db('users').where('id', event.creatorId).select('username').first();

      // Auto-post if social is enabled (do this first so we can include postId in notifications)
      const settings = await db('space_settings').where('space_id', spaceId).first();
      let autoPostId: string | null = null;
      if (settings?.social_enabled) {
        // Build descriptive body
        let body = `New event: **${event.name}**`;
        if (event.eventDate) body += `\nDate: ${event.eventDate}`;
        if (event.eventTime) body += ` at ${event.eventTime}`;
        if (event.location) body += `\nLocation: ${event.location}`;
        if (event.description) body += `\n\n${event.description.substring(0, 500)}`;

        const postId = snowflake.generate();
        autoPostId = String(postId);
        await db('user_posts').insert({
          id: postId,
          user_id: event.creatorId,
          space_id: spaceId,
          body,
          metadata: JSON.stringify({
            type: 'calendar_event',
            eventId: String(event.id),
            spaceId: String(spaceId),
          }),
          visibility: 'public',
        });
      }

      // Notify all space members except the creator
      const members = await db('space_members')
        .where('space_id', spaceId)
        .whereNot('user_id', event.creatorId)
        .select('user_id');

      for (const member of members) {
        await createNotification(String(member.user_id), 'new_event', {
          eventId: String(event.id),
          eventName: event.name,
          eventDate: event.eventDate,
          eventTime: event.eventTime || null,
          spaceId: String(spaceId),
          spaceName: space.name,
          spaceSlug: space.slug,
          spaceIconUrl: space.icon_url || null,
          creatorUsername: creator?.username || '',
          location: event.location || null,
          postId: autoPostId,
        });
      }
    } catch (err) {
      console.error('[CalendarListener] Error handling event created:', err);
    }
  });
}
