import { eventBus } from '../../lib/event-bus.js';
import { db } from '../../database/connection.js';
import { createNotification } from '../notifications/notifications.service.js';

export function registerBlogListener() {
  eventBus.on('blog.post.published', async ({ post, spaceId }: { post: any; spaceId: string }) => {
    try {
      const space = await db('spaces').where('id', spaceId).first();
      if (!space) return;

      const author = await db('users').where('id', post.authorId).select('username').first();

      // Notify all space members except the author
      const members = await db('space_members')
        .where('space_id', spaceId)
        .whereNot('user_id', post.authorId)
        .select('user_id');

      // Load mute settings for all members in one query
      const memberIds = members.map((m: any) => m.user_id);
      const mutedRows = await db('space_member_settings')
        .where('space_id', spaceId)
        .whereIn('user_id', memberIds)
        .where(function () {
          this.where('mute_blog', true).orWhere('mute_all', true);
        })
        .select('user_id');
      const mutedUserIds = new Set(mutedRows.map((r: any) => String(r.user_id)));

      for (const member of members) {
        if (mutedUserIds.has(String(member.user_id))) continue;

        await createNotification(String(member.user_id), 'new_blog_post', {
          postId: String(post.id),
          postTitle: post.title,
          spaceId: String(spaceId),
          spaceName: space.name,
          spaceSlug: space.slug,
          spaceIconUrl: space.icon_url || null,
          authorUsername: author?.username || '',
        });
      }
    } catch (err) {
      console.error('[BlogListener] Error handling blog post published:', err);
    }
  });
}
