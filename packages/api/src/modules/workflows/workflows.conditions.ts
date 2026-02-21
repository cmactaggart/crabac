import { db } from '../../database/connection.js';
import type { ConditionRule, ConditionGroup } from '@crabac/shared';

export interface ConditionContext {
  userId?: string;
  channelId?: string;
  messageContent?: string;
  commandArgs?: Record<string, any>;
  cardFields?: Record<string, any>;
  inviteCode?: string | null;
  buttonId?: string;
  spaceId: string;
  webhookPayload?: Record<string, any>;
}

export async function evaluateConditions(
  conditions: ConditionGroup | null,
  ctx: ConditionContext,
): Promise<boolean> {
  if (!conditions) return true;
  return evaluateGroup(conditions, ctx);
}

async function evaluateGroup(group: ConditionGroup, ctx: ConditionContext): Promise<boolean> {
  if (!group.rules || group.rules.length === 0) return true;

  if (group.operator === 'AND') {
    for (const rule of group.rules) {
      const result = isGroup(rule)
        ? await evaluateGroup(rule, ctx)
        : await evaluateRule(rule, ctx);
      if (!result) return false;
    }
    return true;
  } else {
    // OR
    for (const rule of group.rules) {
      const result = isGroup(rule)
        ? await evaluateGroup(rule, ctx)
        : await evaluateRule(rule, ctx);
      if (result) return true;
    }
    return false;
  }
}

function isGroup(item: ConditionRule | ConditionGroup): item is ConditionGroup {
  return 'operator' in item && 'rules' in item;
}

async function evaluateRule(rule: ConditionRule, ctx: ConditionContext): Promise<boolean> {
  let result: boolean;

  switch (rule.type) {
    case 'user_has_role': {
      if (!ctx.userId || !rule.config.roleId) { result = false; break; }
      const row = await db('member_roles')
        .where({ space_id: ctx.spaceId, user_id: ctx.userId, role_id: rule.config.roleId })
        .first();
      result = !!row;
      break;
    }
    case 'channel_is': {
      result = ctx.channelId === rule.config.channelId;
      break;
    }
    case 'message_contains': {
      const text = (ctx.messageContent || '').toLowerCase();
      const search = (rule.config.text || '').toLowerCase();
      result = text.includes(search);
      break;
    }
    case 'message_equals': {
      const text = (ctx.messageContent || '').toLowerCase().trim();
      const target = (rule.config.text || '').toLowerCase().trim();
      result = text === target;
      break;
    }
    case 'command_arg_equals': {
      const argVal = ctx.commandArgs?.[rule.config.argName];
      result = String(argVal) === String(rule.config.value);
      break;
    }
    case 'card_field_equals': {
      const fieldVal = ctx.cardFields?.[rule.config.fieldKey];
      result = String(fieldVal) === String(rule.config.value);
      break;
    }
    case 'card_field_not_null': {
      const fieldVal = ctx.cardFields?.[rule.config.fieldKey];
      result = fieldVal != null && fieldVal !== '';
      break;
    }
    case 'invite_code_is': {
      result = ctx.inviteCode === rule.config.code;
      break;
    }
    case 'button_is': {
      result = ctx.buttonId === rule.config.buttonId;
      break;
    }
    case 'webhook_payload_equals': {
      const payloadVal = getNestedValue(ctx.webhookPayload, rule.config.key);
      result = String(payloadVal) === String(rule.config.value);
      break;
    }
    default:
      result = false;
  }

  return rule.negate ? !result : result;
}

function getNestedValue(obj: Record<string, any> | undefined, dotPath: string): any {
  if (!obj || !dotPath) return undefined;
  const parts = dotPath.split('.');
  let current: any = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}
