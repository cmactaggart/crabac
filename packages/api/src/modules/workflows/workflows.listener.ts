import { eventBus } from '../../lib/event-bus.js';
import { db } from '../../database/connection.js';
import { processEvent } from './workflows.engine.js';

export function registerWorkflowListener() {
  // ── Member Joined ─────────────────────────────────────────────────
  eventBus.on('space.member_joined', async ({ spaceId, userId, inviteCode }) => {
    try {
      await processEvent('member_joined', String(spaceId), {
        spaceId: String(spaceId),
        userId: String(userId),
        inviteCode: inviteCode || null,
      });
    } catch (err) {
      console.error('[WorkflowListener] member_joined error:', err);
    }
  });

  // ── Message Created ───────────────────────────────────────────────
  eventBus.on('message.created', async ({ message, channelId, spaceId }) => {
    if (!spaceId) return;

    // Loop prevention: skip workflow-generated messages
    if (message.metadata?.workflowId) return;

    try {
      const ch = await db('channels').where('id', channelId).select('space_id').first();
      const resolvedSpaceId = String(spaceId || ch?.space_id);
      if (!resolvedSpaceId) return;

      // Determine attachment types
      const attachments = message.attachments || [];
      if (attachments.length === 0) {
        // Load attachments from DB
        const dbAtts = await db('attachments').where('message_id', message.id);
        attachments.push(...dbAtts);
      }

      const imageAtts = attachments.filter((a: any) =>
        (a.mimeType || a.mime_type || '').startsWith('image/'),
      );
      const gpxAtts = attachments.filter((a: any) =>
        (a.originalName || a.original_name || '').toLowerCase().endsWith('.gpx'),
      );

      const baseCtx = {
        spaceId: resolvedSpaceId,
        userId: String(message.authorId || message.author_id),
        authorId: String(message.authorId || message.author_id),
        channelId: String(channelId),
        messageId: String(message.id),
        messageContent: message.content || '',
      };

      // Fire message_created trigger
      await processEvent('message_created', resolvedSpaceId, baseCtx);

      // Fire image_uploaded if images present
      if (imageAtts.length > 0) {
        await processEvent('image_uploaded', resolvedSpaceId, {
          ...baseCtx,
          imageCount: imageAtts.length,
          attachmentUrls: imageAtts.map((a: any) => a.url),
        });
      }

      // Fire gpx_uploaded if GPX files present
      if (gpxAtts.length > 0) {
        await processEvent('gpx_uploaded', resolvedSpaceId, {
          ...baseCtx,
          gpxCount: gpxAtts.length,
          gpxAttachmentUrls: gpxAtts.map((a: any) => a.url),
        });
      }
    } catch (err) {
      console.error('[WorkflowListener] message.created error:', err);
    }
  });
}
