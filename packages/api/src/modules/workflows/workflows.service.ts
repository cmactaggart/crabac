import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import type { Workflow, WorkflowExecution, CustomCommand, CardTemplate, CardInstance } from '@crabac/shared';

// ── Helpers ───────────────────────────────────────────────────────────

function parseJson(val: any): any {
  if (val == null) return null;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return null; }
  }
  return val;
}

function formatWorkflow(row: any): Workflow {
  return {
    id: String(row.id),
    spaceId: String(row.space_id),
    name: row.name,
    description: row.description || null,
    triggerType: row.trigger_type,
    triggerConfig: parseJson(row.trigger_config),
    conditions: parseJson(row.conditions),
    actions: parseJson(row.actions) || [],
    enabled: !!row.enabled,
    createdBy: String(row.created_by),
    createdAt: row.created_at?.toISOString?.() ?? String(row.created_at),
    updatedAt: row.updated_at?.toISOString?.() ?? String(row.updated_at),
  };
}

function formatExecution(row: any): WorkflowExecution {
  return {
    id: String(row.id),
    workflowId: String(row.workflow_id),
    spaceId: String(row.space_id),
    triggerUserId: row.trigger_user_id ? String(row.trigger_user_id) : null,
    triggerType: row.trigger_type,
    triggerData: parseJson(row.trigger_data),
    status: row.status,
    actionsRun: row.actions_run,
    actionsTotal: row.actions_total,
    errorMessage: row.error_message || null,
    startedAt: row.started_at?.toISOString?.() ?? String(row.started_at),
    finishedAt: row.finished_at ? (row.finished_at.toISOString?.() ?? String(row.finished_at)) : null,
    durationMs: row.duration_ms ?? null,
    workflowName: row.workflow_name || undefined,
  };
}

function formatCommand(row: any): CustomCommand {
  return {
    id: String(row.id),
    spaceId: String(row.space_id),
    name: row.name,
    description: row.description,
    args: parseJson(row.args),
    createdBy: String(row.created_by),
    createdAt: row.created_at?.toISOString?.() ?? String(row.created_at),
  };
}

function formatCardTemplate(row: any): CardTemplate {
  return {
    id: String(row.id),
    spaceId: String(row.space_id),
    name: row.name,
    titleTemplate: row.title_template,
    bodyTemplate: row.body_template || null,
    color: row.color || null,
    fields: parseJson(row.fields),
    buttons: parseJson(row.buttons),
    createdBy: String(row.created_by),
    createdAt: row.created_at?.toISOString?.() ?? String(row.created_at),
  };
}

function formatCardInstance(row: any): CardInstance {
  return {
    id: String(row.id),
    templateId: String(row.template_id),
    channelId: String(row.channel_id),
    messageId: row.message_id ? String(row.message_id) : null,
    context: parseJson(row.context),
    state: parseJson(row.state),
    status: row.status,
    interactedBy: row.interacted_by ? String(row.interacted_by) : null,
    interactedAt: row.interacted_at ? (row.interacted_at.toISOString?.() ?? String(row.interacted_at)) : null,
    createdAt: row.created_at?.toISOString?.() ?? String(row.created_at),
    updatedAt: row.updated_at?.toISOString?.() ?? String(row.updated_at),
  };
}

// ── Workflow CRUD ─────────────────────────────────────────────────────

export async function listWorkflows(spaceId: string): Promise<Workflow[]> {
  const rows = await db('workflows')
    .where('space_id', spaceId)
    .orderBy('created_at', 'desc');
  return rows.map(formatWorkflow);
}

export async function getWorkflow(id: string): Promise<Workflow | null> {
  const row = await db('workflows').where('id', id).first();
  return row ? formatWorkflow(row) : null;
}

export async function createWorkflow(
  spaceId: string,
  userId: string,
  data: {
    name: string;
    description?: string | null;
    triggerType: string;
    triggerConfig?: Record<string, any> | null;
    conditions?: any;
    actions: any[];
    enabled?: boolean;
  },
): Promise<Workflow> {
  const id = snowflake.generate();
  await db('workflows').insert({
    id,
    space_id: spaceId,
    name: data.name,
    description: data.description || null,
    trigger_type: data.triggerType,
    trigger_config: data.triggerConfig ? JSON.stringify(data.triggerConfig) : null,
    conditions: data.conditions ? JSON.stringify(data.conditions) : null,
    actions: JSON.stringify(data.actions),
    enabled: data.enabled !== false,
    created_by: userId,
  });
  return formatWorkflow(await db('workflows').where('id', id).first());
}

export async function updateWorkflow(
  id: string,
  data: {
    name?: string;
    description?: string | null;
    triggerType?: string;
    triggerConfig?: Record<string, any> | null;
    conditions?: any;
    actions?: any[];
    enabled?: boolean;
  },
): Promise<Workflow> {
  const updates: Record<string, any> = { updated_at: db.fn.now(3) };
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.triggerType !== undefined) updates.trigger_type = data.triggerType;
  if (data.triggerConfig !== undefined) updates.trigger_config = data.triggerConfig ? JSON.stringify(data.triggerConfig) : null;
  if (data.conditions !== undefined) updates.conditions = data.conditions ? JSON.stringify(data.conditions) : null;
  if (data.actions !== undefined) updates.actions = JSON.stringify(data.actions);
  if (data.enabled !== undefined) updates.enabled = data.enabled;

  await db('workflows').where('id', id).update(updates);
  return formatWorkflow(await db('workflows').where('id', id).first());
}

export async function deleteWorkflow(id: string): Promise<void> {
  await db('workflows').where('id', id).delete();
}

export async function toggleWorkflow(id: string, enabled: boolean): Promise<Workflow> {
  await db('workflows').where('id', id).update({ enabled, updated_at: db.fn.now(3) });
  return formatWorkflow(await db('workflows').where('id', id).first());
}

export async function getEnabledWorkflows(spaceId: string, triggerType: string): Promise<Workflow[]> {
  const rows = await db('workflows')
    .where({ space_id: spaceId, trigger_type: triggerType, enabled: true });
  return rows.map(formatWorkflow);
}

// ── Custom Commands ───────────────────────────────────────────────────

export async function listCustomCommands(spaceId: string): Promise<CustomCommand[]> {
  const rows = await db('workflow_custom_commands')
    .where('space_id', spaceId)
    .orderBy('name', 'asc');
  return rows.map(formatCommand);
}

export async function getCustomCommand(spaceId: string, name: string): Promise<CustomCommand | null> {
  const row = await db('workflow_custom_commands')
    .where({ space_id: spaceId, name })
    .first();
  return row ? formatCommand(row) : null;
}

export async function getCustomCommandById(id: string): Promise<CustomCommand | null> {
  const row = await db('workflow_custom_commands').where('id', id).first();
  return row ? formatCommand(row) : null;
}

export async function createCustomCommand(
  spaceId: string,
  userId: string,
  data: { name: string; description: string; args?: any[] | null },
): Promise<CustomCommand> {
  const id = snowflake.generate();
  await db('workflow_custom_commands').insert({
    id,
    space_id: spaceId,
    name: data.name,
    description: data.description,
    args: data.args ? JSON.stringify(data.args) : null,
    created_by: userId,
  });
  return formatCommand(await db('workflow_custom_commands').where('id', id).first());
}

export async function updateCustomCommand(
  id: string,
  data: { name?: string; description?: string; args?: any[] | null },
): Promise<CustomCommand> {
  const updates: Record<string, any> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.args !== undefined) updates.args = data.args ? JSON.stringify(data.args) : null;

  await db('workflow_custom_commands').where('id', id).update(updates);
  return formatCommand(await db('workflow_custom_commands').where('id', id).first());
}

export async function deleteCustomCommand(id: string): Promise<void> {
  await db('workflow_custom_commands').where('id', id).delete();
}

// ── Card Templates ────────────────────────────────────────────────────

export async function listCardTemplates(spaceId: string): Promise<CardTemplate[]> {
  const rows = await db('workflow_card_templates')
    .where('space_id', spaceId)
    .orderBy('created_at', 'desc');
  return rows.map(formatCardTemplate);
}

export async function getCardTemplate(id: string): Promise<CardTemplate | null> {
  const row = await db('workflow_card_templates').where('id', id).first();
  return row ? formatCardTemplate(row) : null;
}

export async function createCardTemplate(
  spaceId: string,
  userId: string,
  data: {
    name: string;
    titleTemplate: string;
    bodyTemplate?: string | null;
    color?: string | null;
    fields?: any[] | null;
    buttons?: any[] | null;
  },
): Promise<CardTemplate> {
  const id = snowflake.generate();
  await db('workflow_card_templates').insert({
    id,
    space_id: spaceId,
    name: data.name,
    title_template: data.titleTemplate,
    body_template: data.bodyTemplate || null,
    color: data.color || null,
    fields: data.fields ? JSON.stringify(data.fields) : null,
    buttons: data.buttons ? JSON.stringify(data.buttons) : null,
    created_by: userId,
  });
  return formatCardTemplate(await db('workflow_card_templates').where('id', id).first());
}

export async function updateCardTemplate(
  id: string,
  data: {
    name?: string;
    titleTemplate?: string;
    bodyTemplate?: string | null;
    color?: string | null;
    fields?: any[] | null;
    buttons?: any[] | null;
  },
): Promise<CardTemplate> {
  const updates: Record<string, any> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.titleTemplate !== undefined) updates.title_template = data.titleTemplate;
  if (data.bodyTemplate !== undefined) updates.body_template = data.bodyTemplate;
  if (data.color !== undefined) updates.color = data.color;
  if (data.fields !== undefined) updates.fields = data.fields ? JSON.stringify(data.fields) : null;
  if (data.buttons !== undefined) updates.buttons = data.buttons ? JSON.stringify(data.buttons) : null;

  await db('workflow_card_templates').where('id', id).update(updates);
  return formatCardTemplate(await db('workflow_card_templates').where('id', id).first());
}

export async function deleteCardTemplate(id: string): Promise<void> {
  await db('workflow_card_templates').where('id', id).delete();
}

// ── Card Instances ────────────────────────────────────────────────────

export async function createCardInstance(
  templateId: string,
  channelId: string,
  context: Record<string, any> | null,
  state: Record<string, any> | null,
): Promise<CardInstance> {
  const id = snowflake.generate();
  await db('workflow_card_instances').insert({
    id,
    template_id: templateId,
    channel_id: channelId,
    context: context ? JSON.stringify(context) : null,
    state: state ? JSON.stringify(state) : null,
  });
  return formatCardInstance(await db('workflow_card_instances').where('id', id).first());
}

export async function getCardInstance(id: string): Promise<CardInstance | null> {
  const row = await db('workflow_card_instances').where('id', id).first();
  if (!row) return null;
  const instance = formatCardInstance(row);
  // Also attach the template
  const template = await getCardTemplate(String(row.template_id));
  if (template) instance.template = template;
  return instance;
}

export async function updateCardInstanceMessage(id: string, messageId: string): Promise<void> {
  await db('workflow_card_instances')
    .where('id', id)
    .update({ message_id: messageId, updated_at: db.fn.now(3) });
}

export async function updateCardInstanceState(id: string, state: Record<string, any>): Promise<CardInstance> {
  await db('workflow_card_instances')
    .where('id', id)
    .update({
      state: JSON.stringify(state),
      updated_at: db.fn.now(3),
    });
  return formatCardInstance(await db('workflow_card_instances').where('id', id).first());
}

export async function dismissCardInstance(id: string, userId: string): Promise<CardInstance> {
  await db('workflow_card_instances')
    .where('id', id)
    .update({
      status: 'dismissed',
      interacted_by: userId,
      interacted_at: db.fn.now(3),
      updated_at: db.fn.now(3),
    });
  return formatCardInstance(await db('workflow_card_instances').where('id', id).first());
}

// ── Execution Logs ────────────────────────────────────────────────────

export async function listExecutions(
  spaceId: string,
  opts: { workflowId?: string; limit: number; before?: string },
): Promise<WorkflowExecution[]> {
  let query = db('workflow_executions')
    .leftJoin('workflows', 'workflow_executions.workflow_id', 'workflows.id')
    .where('workflow_executions.space_id', spaceId)
    .select('workflow_executions.*', 'workflows.name as workflow_name')
    .orderBy('workflow_executions.started_at', 'desc')
    .limit(opts.limit);

  if (opts.workflowId) {
    query = query.where('workflow_executions.workflow_id', opts.workflowId);
  }
  if (opts.before) {
    query = query.where('workflow_executions.id', '<', opts.before);
  }

  const rows = await query;
  return rows.map(formatExecution);
}

export async function createExecution(data: {
  workflowId: string;
  spaceId: string;
  triggerUserId?: string | null;
  triggerType: string;
  triggerData?: Record<string, any> | null;
  actionsTotal: number;
}): Promise<string> {
  const id = snowflake.generate();
  await db('workflow_executions').insert({
    id,
    workflow_id: data.workflowId,
    space_id: data.spaceId,
    trigger_user_id: data.triggerUserId || null,
    trigger_type: data.triggerType,
    trigger_data: data.triggerData ? JSON.stringify(data.triggerData) : null,
    status: 'success',
    actions_total: data.actionsTotal,
  });
  return String(id);
}

export async function finishExecution(
  id: string,
  result: {
    status: 'success' | 'partial' | 'error' | 'skipped';
    actionsRun: number;
    errorMessage?: string | null;
  },
): Promise<void> {
  const row = await db('workflow_executions').where('id', id).first();
  const startedAt = row?.started_at ? new Date(row.started_at).getTime() : Date.now();
  const durationMs = Date.now() - startedAt;

  await db('workflow_executions').where('id', id).update({
    status: result.status,
    actions_run: result.actionsRun,
    error_message: result.errorMessage || null,
    finished_at: db.fn.now(3),
    duration_ms: durationMs,
  });
}
