import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../lib/errors.js';
import { eventBus } from '../../lib/event-bus.js';

export async function createReport(
  reporterId: string,
  data: {
    reportedUserId: string;
    spaceId?: string;
    channelId?: string;
    messageId?: string;
    dmMessageId?: string;
    conversationId?: string;
    galleryItemId?: string;
    routeId?: string;
    forumPostId?: string;
    postId?: string;
    reason: string;
  },
) {
  if (reporterId === data.reportedUserId) {
    throw new BadRequestError('Cannot report yourself');
  }

  // Prevent duplicate active reports for the same content by same reporter
  if (data.messageId) {
    const existing = await db('reports')
      .where({ reporter_id: reporterId, message_id: data.messageId, status: 'pending' })
      .first();
    if (existing) throw new ConflictError('You have already reported this message');
  }
  if (data.dmMessageId) {
    const existing = await db('reports')
      .where({ reporter_id: reporterId, dm_message_id: data.dmMessageId, status: 'pending' })
      .first();
    if (existing) throw new ConflictError('You have already reported this message');
  }
  if (data.galleryItemId) {
    const existing = await db('reports')
      .where({ reporter_id: reporterId, gallery_item_id: data.galleryItemId, status: 'pending' })
      .first();
    if (existing) throw new ConflictError('You have already reported this photo');
  }
  if (data.routeId) {
    const existing = await db('reports')
      .where({ reporter_id: reporterId, route_id: data.routeId, status: 'pending' })
      .first();
    if (existing) throw new ConflictError('You have already reported this route');
  }
  if (data.forumPostId) {
    const existing = await db('reports')
      .where({ reporter_id: reporterId, forum_post_id: data.forumPostId, status: 'pending' })
      .first();
    if (existing) throw new ConflictError('You have already reported this post');
  }
  if (data.postId) {
    const existing = await db('reports')
      .where({ reporter_id: reporterId, post_id: data.postId, status: 'pending' })
      .first();
    if (existing) throw new ConflictError('You have already reported this post');
  }

  // Determine content_type
  let contentType: string | null = null;
  if (data.galleryItemId) contentType = 'gallery';
  else if (data.routeId) contentType = 'route';
  else if (data.forumPostId) contentType = 'forum_post';
  else if (data.postId) contentType = 'post';

  const id = snowflake.generate();
  await db('reports').insert({
    id,
    reporter_id: reporterId,
    reported_user_id: data.reportedUserId,
    space_id: data.spaceId || null,
    channel_id: data.channelId || null,
    message_id: data.messageId || null,
    dm_message_id: data.dmMessageId || null,
    conversation_id: data.conversationId || null,
    gallery_item_id: data.galleryItemId || null,
    route_id: data.routeId || null,
    forum_post_id: data.forumPostId || null,
    post_id: data.postId || null,
    content_type: contentType,
    reason: data.reason,
    status: 'pending',
  });

  // Post system message to space admin channel if spaceId is set
  if (data.spaceId) {
    try {
      const adminChannel = await db('channels')
        .where({ space_id: data.spaceId, is_admin: true })
        .first();
      const reporter = await db('users').where('id', reporterId).select('username').first();
      const reported = await db('users').where('id', data.reportedUserId).select('username').first();
      const space = await db('spaces').where('id', data.spaceId).first();

      if (adminChannel && reporter && reported && space) {
        const content = `**Report:** ${reporter.username} reported ${reported.username} — ${data.reason}`;
        await db('messages').insert({
          id: snowflake.generate(),
          channel_id: adminChannel.id,
          author_id: space.owner_id,
          content,
          message_type: 'system',
        });
      }
    } catch {
      // non-critical
    }
  }

  return getReport(id);
}

export async function getReport(reportId: string) {
  const row = await db('reports')
    .where('reports.id', reportId)
    .join('users as reporter', 'reports.reporter_id', 'reporter.id')
    .join('users as reported', 'reports.reported_user_id', 'reported.id')
    .select(
      'reports.*',
      'reporter.username as reporter_username',
      'reporter.display_name as reporter_display_name',
      'reported.username as reported_username',
      'reported.display_name as reported_display_name',
    )
    .first();

  if (!row) throw new NotFoundError('Report');
  return formatReport(row);
}

export async function listSpaceReports(spaceId: string) {
  const rows = await db('reports')
    .where('reports.space_id', spaceId)
    .join('users as reporter', 'reports.reporter_id', 'reporter.id')
    .join('users as reported', 'reports.reported_user_id', 'reported.id')
    .select(
      'reports.*',
      'reporter.username as reporter_username',
      'reporter.display_name as reporter_display_name',
      'reported.username as reported_username',
      'reported.display_name as reported_display_name',
    )
    .orderBy('reports.created_at', 'desc');

  // Get content previews for reports
  const messageIds = rows.filter((r: any) => r.message_id).map((r: any) => r.message_id);
  const dmMessageIds = rows.filter((r: any) => r.dm_message_id).map((r: any) => r.dm_message_id);
  const galleryItemIds = rows.filter((r: any) => r.gallery_item_id).map((r: any) => r.gallery_item_id);
  const routeIds = rows.filter((r: any) => r.route_id).map((r: any) => r.route_id);
  const forumPostIds = rows.filter((r: any) => r.forum_post_id).map((r: any) => r.forum_post_id);
  const postIds = rows.filter((r: any) => r.post_id).map((r: any) => r.post_id);

  const contentPreviews = await getContentPreviews(messageIds, dmMessageIds, galleryItemIds, routeIds, forumPostIds, postIds);

  return rows.map((r: any) => formatReport(r, contentPreviews));
}

export async function listAllReports(statusFilter?: string) {
  let query = db('reports')
    .join('users as reporter', 'reports.reporter_id', 'reporter.id')
    .join('users as reported', 'reports.reported_user_id', 'reported.id')
    .leftJoin('spaces', 'reports.space_id', 'spaces.id')
    .select(
      'reports.*',
      'reporter.username as reporter_username',
      'reporter.display_name as reporter_display_name',
      'reported.username as reported_username',
      'reported.display_name as reported_display_name',
      'spaces.name as space_name',
    )
    .orderBy('reports.created_at', 'desc');

  if (statusFilter) {
    query = query.where('reports.status', statusFilter);
  }

  const rows = await query;

  const messageIds = rows.filter((r: any) => r.message_id).map((r: any) => r.message_id);
  const dmMessageIds = rows.filter((r: any) => r.dm_message_id).map((r: any) => r.dm_message_id);
  const galleryItemIds = rows.filter((r: any) => r.gallery_item_id).map((r: any) => r.gallery_item_id);
  const routeIds = rows.filter((r: any) => r.route_id).map((r: any) => r.route_id);
  const forumPostIds = rows.filter((r: any) => r.forum_post_id).map((r: any) => r.forum_post_id);
  const postIds = rows.filter((r: any) => r.post_id).map((r: any) => r.post_id);
  const contentPreviews = await getContentPreviews(messageIds, dmMessageIds, galleryItemIds, routeIds, forumPostIds, postIds);

  return rows.map((r: any) => formatReport(r, contentPreviews));
}

export async function updateReportStatus(reportId: string, status: 'resolved' | 'dismissed', resolvedBy: string) {
  const report = await db('reports').where('id', reportId).first();
  if (!report) throw new NotFoundError('Report');

  await db('reports').where('id', reportId).update({
    status,
    resolved_by: resolvedBy,
    resolved_at: db.fn.now(3),
  });

  return getReport(reportId);
}

async function getContentPreviews(
  messageIds: string[],
  dmMessageIds: string[],
  galleryItemIds: string[],
  routeIds: string[],
  forumPostIds: string[],
  postIds: string[] = [],
) {
  const previews = new Map<string, string>();

  if (messageIds.length > 0) {
    const messages = await db('messages')
      .whereIn('id', messageIds)
      .select('id', 'content');
    for (const m of messages) {
      previews.set(`msg:${m.id}`, m.content?.slice(0, 200) || '');
    }
  }

  if (dmMessageIds.length > 0) {
    const dms = await db('direct_messages')
      .whereIn('id', dmMessageIds)
      .select('id', 'content');
    for (const d of dms) {
      previews.set(`dm:${d.id}`, d.content?.slice(0, 200) || '');
    }
  }

  if (galleryItemIds.length > 0) {
    const items = await db('gallery_items')
      .whereIn('id', galleryItemIds)
      .select('id', 'caption');
    for (const g of items) {
      previews.set(`gallery:${g.id}`, g.caption?.slice(0, 200) || '(photo)');
    }
  }

  if (routeIds.length > 0) {
    const routes = await db('route_items')
      .whereIn('id', routeIds)
      .select('id', 'name');
    for (const r of routes) {
      previews.set(`route:${r.id}`, r.name?.slice(0, 200) || '(route)');
    }
  }

  if (forumPostIds.length > 0) {
    const posts = await db('messages')
      .whereIn('id', forumPostIds)
      .select('id', 'content');
    for (const p of posts) {
      previews.set(`forum:${p.id}`, p.content?.slice(0, 200) || '');
    }
  }

  if (postIds.length > 0) {
    const userPosts = await db('user_posts')
      .whereIn('id', postIds)
      .select('id', 'body');
    for (const p of userPosts) {
      previews.set(`post:${p.id}`, p.body?.slice(0, 200) || '(post)');
    }
  }

  return previews;
}

function formatReport(row: any, contentPreviews?: Map<string, string>) {
  let messagePreview: string | null = null;
  if (contentPreviews) {
    if (row.gallery_item_id) {
      messagePreview = contentPreviews.get(`gallery:${row.gallery_item_id}`) || null;
    } else if (row.route_id) {
      messagePreview = contentPreviews.get(`route:${row.route_id}`) || null;
    } else if (row.forum_post_id) {
      messagePreview = contentPreviews.get(`forum:${row.forum_post_id}`) || null;
    } else if (row.post_id) {
      messagePreview = contentPreviews.get(`post:${row.post_id}`) || null;
    } else if (row.message_id) {
      messagePreview = contentPreviews.get(`msg:${row.message_id}`) || null;
    } else if (row.dm_message_id) {
      messagePreview = contentPreviews.get(`dm:${row.dm_message_id}`) || null;
    }
  }

  return {
    id: row.id,
    reporterId: row.reporter_id,
    reportedUserId: row.reported_user_id,
    spaceId: row.space_id,
    channelId: row.channel_id,
    messageId: row.message_id,
    dmMessageId: row.dm_message_id,
    conversationId: row.conversation_id,
    galleryItemId: row.gallery_item_id,
    routeId: row.route_id,
    forumPostId: row.forum_post_id,
    postId: row.post_id,
    contentType: row.content_type,
    reason: row.reason,
    status: row.status,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    reporter: {
      id: row.reporter_id,
      username: row.reporter_username,
      displayName: row.reporter_display_name,
    },
    reportedUser: {
      id: row.reported_user_id,
      username: row.reported_username,
      displayName: row.reported_display_name,
    },
    messagePreview,
    spaceName: row.space_name || null,
  };
}
