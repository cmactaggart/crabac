import { db } from '../../database/connection.js';
import type { TriggerType } from '@crabac/shared';

export interface TriggerContext {
  spaceId: string;
  userId?: string;
  channelId?: string;
  messageId?: string;
  messageContent?: string;
  inviteCode?: string | null;
  imageCount?: number;
  gpxCount?: number;
  commandName?: string;
  commandArgs?: Record<string, any>;
  cardInstanceId?: string;
  buttonId?: string;
  cardTemplateId?: string;
  cardFields?: Record<string, any>;
  attachmentUrls?: string[];
  gpxAttachmentUrls?: string[];
  authorId?: string;
  webhookSlug?: string;
  webhookMethod?: string;
  webhookPayload?: Record<string, any>;
}

export interface ResolvedVariables {
  [key: string]: string | number | null | undefined;
}

export async function resolveVariables(
  triggerType: TriggerType,
  ctx: TriggerContext,
): Promise<ResolvedVariables> {
  const vars: ResolvedVariables = {};

  // Space info
  const space = await db('spaces').where('id', ctx.spaceId).select('name').first();
  vars.spaceName = space?.name || '';

  // User info (if applicable)
  if (ctx.userId) {
    const user = await db('users')
      .where('id', ctx.userId)
      .select('username', 'display_name')
      .first();
    vars.userId = ctx.userId;
    vars.username = user?.username || '';
    vars.displayName = user?.display_name || user?.username || '';
  }

  switch (triggerType) {
    case 'member_joined':
      vars.inviteCode = ctx.inviteCode || '';
      break;

    case 'message_created':
      vars.channelId = ctx.channelId || '';
      vars.messageId = ctx.messageId || '';
      vars.messageContent = ctx.messageContent || '';
      if (ctx.channelId) {
        const ch = await db('channels').where('id', ctx.channelId).select('name').first();
        vars.channelName = ch?.name || '';
      }
      break;

    case 'image_uploaded':
      vars.channelId = ctx.channelId || '';
      vars.messageId = ctx.messageId || '';
      vars.messageContent = ctx.messageContent || '';
      vars.imageCount = ctx.imageCount || 0;
      if (ctx.channelId) {
        const ch = await db('channels').where('id', ctx.channelId).select('name').first();
        vars.channelName = ch?.name || '';
      }
      break;

    case 'gpx_uploaded':
      vars.channelId = ctx.channelId || '';
      vars.messageId = ctx.messageId || '';
      vars.messageContent = ctx.messageContent || '';
      vars.gpxCount = ctx.gpxCount || 0;
      if (ctx.channelId) {
        const ch = await db('channels').where('id', ctx.channelId).select('name').first();
        vars.channelName = ch?.name || '';
      }
      break;

    case 'slash_command':
      vars.channelId = ctx.channelId || '';
      vars.commandName = ctx.commandName || '';
      if (ctx.channelId) {
        const ch = await db('channels').where('id', ctx.channelId).select('name').first();
        vars.channelName = ch?.name || '';
      }
      // Flatten command args as args.argName
      if (ctx.commandArgs) {
        for (const [key, val] of Object.entries(ctx.commandArgs)) {
          vars[`args.${key}`] = val != null ? String(val) : '';
        }
      }
      break;

    case 'card_interaction':
      vars.channelId = ctx.channelId || '';
      vars.cardInstanceId = ctx.cardInstanceId || '';
      vars.buttonId = ctx.buttonId || '';
      if (ctx.channelId) {
        const ch = await db('channels').where('id', ctx.channelId).select('name').first();
        vars.channelName = ch?.name || '';
      }
      // Flatten card fields as fields.fieldKey
      if (ctx.cardFields) {
        for (const [key, val] of Object.entries(ctx.cardFields)) {
          vars[`fields.${key}`] = val != null ? String(val) : '';
        }
      }
      // Load card instance context and expose as card.* variables
      // This preserves the original trigger context from when the card was created
      if (ctx.cardInstanceId) {
        const cardRow = await db('workflow_card_instances')
          .where('id', ctx.cardInstanceId)
          .select('context')
          .first();
        if (cardRow?.context) {
          const cardCtx = typeof cardRow.context === 'string'
            ? JSON.parse(cardRow.context)
            : cardRow.context;
          for (const [key, val] of Object.entries(cardCtx)) {
            vars[`card.${key}`] = val != null ? String(val) : '';
          }
        }
      }
      break;

    case 'webhook':
      vars.webhookSlug = ctx.webhookSlug || '';
      vars.webhookMethod = ctx.webhookMethod || '';
      // Flatten webhook payload as payload.* keys (up to 3 levels deep)
      if (ctx.webhookPayload) {
        flattenObject(ctx.webhookPayload, 'payload', vars, 3);
      }
      break;
  }

  return vars;
}

function flattenObject(
  obj: Record<string, any>,
  prefix: string,
  vars: ResolvedVariables,
  maxDepth: number,
  depth = 0,
): void {
  if (depth >= maxDepth) return;
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = `${prefix}.${key}`;
    if (val != null && typeof val === 'object' && !Array.isArray(val)) {
      flattenObject(val, fullKey, vars, maxDepth, depth + 1);
    } else {
      vars[fullKey] = val != null ? String(val) : '';
    }
  }
}

export function interpolate(template: string, vars: ResolvedVariables): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_match, key) => {
    const val = vars[key];
    return val != null ? String(val) : `{{${key}}}`;
  });
}
