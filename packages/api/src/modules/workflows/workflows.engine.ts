import type { TriggerType } from '@crabac/shared';
import * as workflowsService from './workflows.service.js';
import { evaluateConditions } from './workflows.conditions.js';
import { resolveVariables, type TriggerContext } from './workflows.variables.js';
import { executeAction, type ActionContext } from './workflows.actions.js';

// ── Rate Limiting ─────────────────────────────────────────────────────

const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

function isRateLimited(workflowId: string): boolean {
  const now = Date.now();
  let timestamps = rateLimitMap.get(workflowId) || [];
  timestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT_MAX) return true;
  timestamps.push(now);
  rateLimitMap.set(workflowId, timestamps);
  return false;
}

// Clean up stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of rateLimitMap) {
    const active = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (active.length === 0) rateLimitMap.delete(key);
    else rateLimitMap.set(key, active);
  }
}, 5 * 60_000);

// ── Execution Timeout ─────────────────────────────────────────────────

const EXECUTION_TIMEOUT_MS = 10_000;

// ── Core Engine ───────────────────────────────────────────────────────

export async function processEvent(
  triggerType: TriggerType,
  spaceId: string,
  context: TriggerContext,
): Promise<void> {
  let workflows;
  try {
    workflows = await workflowsService.getEnabledWorkflows(spaceId, triggerType);
  } catch (err) {
    console.error('[WorkflowEngine] Failed to fetch workflows:', err);
    return;
  }

  if (workflows.length === 0) return;

  // User-initiated triggers (slash commands, card interactions) should be awaited
  // so the HTTP response only comes after the workflow finishes execution.
  // Event-driven triggers (message_created, member_joined, etc.) stay fire-and-forget.
  const shouldAwait = triggerType === 'slash_command' || triggerType === 'card_interaction';

  for (const workflow of workflows) {
    if (shouldAwait) {
      try {
        await processWorkflow(workflow, triggerType, context);
      } catch (err) {
        console.error(`[WorkflowEngine] Error in workflow ${workflow.id}:`, err);
      }
    } else {
      processWorkflow(workflow, triggerType, context).catch((err) => {
        console.error(`[WorkflowEngine] Unhandled error in workflow ${workflow.id}:`, err);
      });
    }
  }
}

async function processWorkflow(
  workflow: ReturnType<typeof workflowsService.getEnabledWorkflows> extends Promise<(infer T)[]> ? T : never,
  triggerType: TriggerType,
  context: TriggerContext,
): Promise<void> {
  // Rate limit check
  if (isRateLimited(workflow.id)) {
    await workflowsService.createExecution({
      workflowId: workflow.id,
      spaceId: workflow.spaceId,
      triggerUserId: context.userId,
      triggerType,
      actionsTotal: workflow.actions.length,
    }).then((execId) =>
      workflowsService.finishExecution(execId, {
        status: 'skipped',
        actionsRun: 0,
        errorMessage: 'Rate limited (>10 executions/min)',
      }),
    );
    return;
  }

  // Check trigger config specifics
  if (!matchesTriggerConfig(workflow, context)) return;

  // Resolve variables
  const vars = await resolveVariables(triggerType, context);

  // Evaluate conditions
  const conditionsMatch = await evaluateConditions(workflow.conditions, {
    spaceId: workflow.spaceId,
    userId: context.userId,
    channelId: context.channelId,
    messageContent: context.messageContent,
    commandArgs: context.commandArgs,
    cardFields: context.cardFields,
    inviteCode: context.inviteCode,
    buttonId: context.buttonId,
    webhookPayload: context.webhookPayload,
  });

  // Create execution log
  const execId = await workflowsService.createExecution({
    workflowId: workflow.id,
    spaceId: workflow.spaceId,
    triggerUserId: context.userId,
    triggerType,
    triggerData: { context: vars },
    actionsTotal: workflow.actions.length,
  });

  if (!conditionsMatch) {
    await workflowsService.finishExecution(execId, {
      status: 'skipped',
      actionsRun: 0,
      errorMessage: 'Conditions not met',
    });
    return;
  }

  // Execute actions with timeout
  let actionsRun = 0;
  let errorMessage: string | null = null;

  try {
    await Promise.race([
      (async () => {
        const actionCtx: ActionContext = {
          spaceId: workflow.spaceId,
          workflowId: workflow.id,
          vars,
          trigger: context,
        };

        for (const action of workflow.actions) {
          try {
            await executeAction(action, actionCtx);
            actionsRun++;
          } catch (err: any) {
            errorMessage = `Action ${action.type} failed: ${err.message || 'Unknown error'}`;
            break;
          }
        }
      })(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Workflow execution timed out')), EXECUTION_TIMEOUT_MS),
      ),
    ]);
  } catch (err: any) {
    errorMessage = err.message || 'Execution failed';
  }

  const status = errorMessage
    ? actionsRun > 0 ? 'partial' : 'error'
    : 'success';

  await workflowsService.finishExecution(execId, {
    status: status as any,
    actionsRun,
    errorMessage,
  });
}

function matchesTriggerConfig(
  workflow: { triggerType: string; triggerConfig: Record<string, any> | null },
  context: TriggerContext,
): boolean {
  const config = workflow.triggerConfig;
  if (!config) return true;

  switch (workflow.triggerType) {
    case 'message_created':
    case 'image_uploaded':
    case 'gpx_uploaded':
      // Optional channel filter
      if (config.channelId && config.channelId !== context.channelId) return false;
      break;
    case 'slash_command':
      if (config.commandName && config.commandName !== context.commandName) return false;
      break;
    case 'card_interaction':
      if (config.cardTemplateId && config.cardTemplateId !== context.cardTemplateId) return false;
      break;
    case 'webhook':
      if (config.slug && config.slug !== context.webhookSlug) return false;
      break;
  }

  return true;
}
