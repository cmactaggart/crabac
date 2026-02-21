import { db } from '../../database/connection.js';
import { eventBus } from '../../lib/event-bus.js';
import * as messagesService from '../messages/messages.service.js';
import * as galleriesService from '../galleries/galleries.service.js';
import * as routeLibraryService from '../route-library/route-library.service.js';
import * as workflowsService from './workflows.service.js';
import { interpolate, type ResolvedVariables, type TriggerContext } from './workflows.variables.js';
import type { WorkflowAction } from '@crabac/shared';

export interface ActionContext {
  spaceId: string;
  workflowId: string;
  vars: ResolvedVariables;
  trigger: TriggerContext;
}

export async function executeAction(action: WorkflowAction, ctx: ActionContext): Promise<void> {
  switch (action.type) {
    case 'send_message':
      await executeSendMessage(action, ctx);
      break;
    case 'send_admin_message':
      await executeSendAdminMessage(action, ctx);
      break;
    case 'add_role':
      await executeAddRole(action, ctx);
      break;
    case 'remove_role':
      await executeRemoveRole(action, ctx);
      break;
    case 'copy_images_to_gallery':
      await executeCopyImagesToGallery(action, ctx);
      break;
    case 'copy_routes_to_library':
      await executeCopyRoutesToLibrary(action, ctx);
      break;
    case 'show_card':
      await executeShowCard(action, ctx);
      break;
    case 'update_card':
      await executeUpdateCard(action, ctx);
      break;
    case 'dismiss_card':
      await executeDismissCard(action, ctx);
      break;
    case 'send_webhook':
      await executeSendWebhook(action, ctx);
      break;
  }
}

async function executeSendMessage(action: WorkflowAction, ctx: ActionContext): Promise<void> {
  const channelId = action.config.channelId || ctx.trigger.channelId;
  if (!channelId) return;

  const content = interpolate(action.config.content || '', ctx.vars);
  if (!content) return;

  const createdBy = await getSystemUserId(ctx.spaceId);
  const style = action.config.messageStyle || 'normal';
  const displayName = action.config.displayName
    ? interpolate(action.config.displayName, ctx.vars)
    : undefined;

  const metadata: Record<string, any> = { workflowId: ctx.workflowId };
  if (displayName) metadata.workflowDisplayName = displayName;

  await messagesService.createMessage(channelId, createdBy, {
    content,
    messageType: style === 'system' ? 'system' : 'user',
    metadata,
  });
}

async function executeSendAdminMessage(action: WorkflowAction, ctx: ActionContext): Promise<void> {
  // Find an admin/is_admin channel in the space
  const adminChannel = await db('channels')
    .where({ space_id: ctx.spaceId, is_private: true })
    .whereExists(function () {
      this.select(db.raw(1))
        .from('channel_permission_overrides')
        .whereRaw('channel_permission_overrides.channel_id = channels.id');
    })
    .first();

  // Fallback: use the first text channel
  const targetChannel = adminChannel || await db('channels')
    .where({ space_id: ctx.spaceId, type: 'text' })
    .orderBy('position', 'asc')
    .first();

  if (!targetChannel) return;

  const channelId = String(targetChannel.id);
  const content = interpolate(action.config.content || '', ctx.vars);
  if (!content) return;

  const createdBy = await getSystemUserId(ctx.spaceId);
  const style = action.config.messageStyle || 'normal';
  const displayName = action.config.displayName
    ? interpolate(action.config.displayName, ctx.vars)
    : undefined;

  const metadata: Record<string, any> = { workflowId: ctx.workflowId };
  if (displayName) metadata.workflowDisplayName = displayName;

  await messagesService.createMessage(channelId, createdBy, {
    content,
    messageType: style === 'system' ? 'system' : 'user',
    metadata,
  });
}

async function executeAddRole(action: WorkflowAction, ctx: ActionContext): Promise<void> {
  // Target user: from config variable, or the triggering user
  const rawTarget = action.config.targetUserId
    ? interpolate(action.config.targetUserId, ctx.vars)
    : null;
  const userId = rawTarget || ctx.trigger.userId;
  // Role: from config variable, or the static roleId
  const rawRole = action.config.roleVariable
    ? interpolate(action.config.roleVariable, ctx.vars)
    : null;
  const roleId = rawRole || action.config.roleId;
  if (!userId || !roleId) return;

  // Check if already has role
  const existing = await db('member_roles')
    .where({ space_id: ctx.spaceId, user_id: userId, role_id: roleId })
    .first();
  if (existing) return;

  // Verify role exists in this space
  const role = await db('roles')
    .where({ id: roleId, space_id: ctx.spaceId })
    .first();
  if (!role) return;

  await db('member_roles').insert({
    space_id: ctx.spaceId,
    user_id: userId,
    role_id: roleId,
  });
}

async function executeRemoveRole(action: WorkflowAction, ctx: ActionContext): Promise<void> {
  const rawTarget = action.config.targetUserId
    ? interpolate(action.config.targetUserId, ctx.vars)
    : null;
  const userId = rawTarget || ctx.trigger.userId;
  const rawRole = action.config.roleVariable
    ? interpolate(action.config.roleVariable, ctx.vars)
    : null;
  const roleId = rawRole || action.config.roleId;
  if (!userId || !roleId) return;

  await db('member_roles')
    .where({ space_id: ctx.spaceId, user_id: userId, role_id: roleId })
    .delete();
}

async function executeCopyImagesToGallery(action: WorkflowAction, ctx: ActionContext): Promise<void> {
  const galleryChannelId = action.config.galleryChannelId;
  if (!galleryChannelId || !ctx.trigger.attachmentUrls?.length) return;

  const authorId = ctx.trigger.authorId || ctx.trigger.userId;
  if (!authorId) return;

  // Get attachment details from the message
  const messageId = ctx.trigger.messageId;
  if (!messageId) return;

  const attachments = await db('attachments')
    .where('message_id', messageId)
    .whereIn('mime_type', ['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

  if (attachments.length === 0) return;

  // Create gallery item for each image
  for (const att of attachments) {
    try {
      const item = await galleriesService.createGalleryItem(galleryChannelId, authorId, null);
      await galleriesService.createGalleryAttachment(
        item.id,
        {
          filename: att.filename,
          originalName: att.original_name,
          mimeType: att.mime_type,
          size: att.size,
          url: att.url,
        },
        0,
      );
      await galleriesService.emitGalleryItemCreated(galleryChannelId, item.id);
    } catch {
      // Skip individual failures
    }
  }
}

async function executeCopyRoutesToLibrary(action: WorkflowAction, ctx: ActionContext): Promise<void> {
  const routeLibraryChannelId = action.config.routeLibraryChannelId;
  if (!routeLibraryChannelId || !ctx.trigger.gpxAttachmentUrls?.length) return;

  const authorId = ctx.trigger.authorId || ctx.trigger.userId;
  if (!authorId) return;

  for (const gpxUrl of ctx.trigger.gpxAttachmentUrls) {
    try {
      await routeLibraryService.createRouteFromExistingFile(
        routeLibraryChannelId,
        authorId,
        {
          name: 'Auto-imported route',
          activityType: action.config.activityType || null,
        },
        gpxUrl,
      );
    } catch {
      // Skip individual failures
    }
  }
}

async function executeShowCard(action: WorkflowAction, ctx: ActionContext): Promise<void> {
  const templateId = action.config.templateId;
  const channelId = action.config.channelId || ctx.trigger.channelId;
  if (!templateId || !channelId) return;

  const template = await workflowsService.getCardTemplate(templateId);
  if (!template) return;

  // Merge template args into vars — each arg value is itself interpolated first
  const cardVars = { ...ctx.vars };
  if (action.config.templateArgs) {
    for (const [key, val] of Object.entries(action.config.templateArgs)) {
      cardVars[key] = interpolate(String(val), ctx.vars);
    }
  }

  // Interpolate title and body for initial state
  const title = interpolate(template.titleTemplate, cardVars);
  const body = template.bodyTemplate ? interpolate(template.bodyTemplate, cardVars) : null;

  const state = { title, body, fields: {} };
  const instance = await workflowsService.createCardInstance(templateId, channelId, cardVars as any, state);

  // Create a message with the card instance reference
  const createdBy = await getSystemUserId(ctx.spaceId);
  const message = await messagesService.createMessage(channelId, createdBy, {
    content: title,
    messageType: 'system',
    metadata: { workflowId: ctx.workflowId, cardInstanceId: instance.id },
  });

  // Link message to card instance
  await workflowsService.updateCardInstanceMessage(instance.id, message.id);

  eventBus.emit('workflow.card_created', { instance, channelId });
}

async function executeUpdateCard(action: WorkflowAction, ctx: ActionContext): Promise<void> {
  const cardInstanceId = action.config.cardInstanceId || ctx.trigger.cardInstanceId;
  if (!cardInstanceId) return;

  const current = await workflowsService.getCardInstance(cardInstanceId);
  if (!current || current.status !== 'active') return;

  const newState = { ...(current.state || {}) };
  if (action.config.title) newState.title = interpolate(action.config.title, ctx.vars);
  if (action.config.body) newState.body = interpolate(action.config.body, ctx.vars);
  if (action.config.fieldUpdates) {
    const fields = { ...(newState.fields || {}) };
    for (const [key, val] of Object.entries(action.config.fieldUpdates)) {
      fields[key] = interpolate(String(val), ctx.vars);
    }
    newState.fields = fields;
  }

  const updated = await workflowsService.updateCardInstanceState(cardInstanceId, newState);
  eventBus.emit('workflow.card_updated', { instance: updated, channelId: current.channelId });
}

async function executeDismissCard(action: WorkflowAction, ctx: ActionContext): Promise<void> {
  const cardInstanceId = action.config.cardInstanceId || ctx.trigger.cardInstanceId;
  if (!cardInstanceId) return;

  const current = await workflowsService.getCardInstance(cardInstanceId);
  if (!current || current.status !== 'active') return;

  const userId = ctx.trigger.userId || '';
  const dismissed = await workflowsService.dismissCardInstance(cardInstanceId, userId);
  eventBus.emit('workflow.card_dismissed', { instance: dismissed, channelId: current.channelId });
}

async function executeSendWebhook(action: WorkflowAction, ctx: ActionContext): Promise<void> {
  const rawUrl = action.config.url;
  if (!rawUrl) throw new Error('Webhook URL is required');

  const url = interpolate(rawUrl, ctx.vars);

  // SSRF prevention: block private/reserved IPs
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('169.254.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      throw new Error('Webhook URL targets a private/reserved address');
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('Webhook URL must use http or https');
    }
  } catch (err: any) {
    if (err.message.includes('private') || err.message.includes('http')) throw err;
    throw new Error(`Invalid webhook URL: ${url}`);
  }

  const method = (action.config.method || 'POST').toUpperCase();
  const headers: Record<string, string> = {
    'User-Agent': 'crab.ac-workflows/1.0',
  };

  // Custom headers from config
  if (action.config.headers && typeof action.config.headers === 'object') {
    for (const [key, val] of Object.entries(action.config.headers)) {
      if (typeof val === 'string' && key.trim()) {
        headers[key.trim()] = interpolate(val, ctx.vars);
      }
    }
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
    signal: AbortSignal.timeout(5000),
  };

  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    const bodyTemplate = action.config.body || '{}';
    fetchOptions.body = interpolate(bodyTemplate, ctx.vars);
    if (!headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
    }
  }

  const resp = await fetch(url, fetchOptions);
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Webhook returned ${resp.status}: ${text.slice(0, 200)}`);
  }
}

// Helper to get a system user for workflow-generated messages
async function getSystemUserId(spaceId: string): Promise<string> {
  // Use the space owner as the sender for workflow messages
  const space = await db('spaces').where('id', spaceId).select('owner_id').first();
  return space ? String(space.owner_id) : '';
}
