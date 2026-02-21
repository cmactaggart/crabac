import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { requirePermission, requireMember } from '../rbac/rbac.middleware.js';
import { validate } from '../../middleware/validate.js';
import { Permissions, validation } from '@crabac/shared';
import { NotFoundError, BadRequestError } from '../../lib/errors.js';
import * as workflowsService from './workflows.service.js';
import { processEvent } from './workflows.engine.js';
import { eventBus } from '../../lib/event-bus.js';

export const workflowRoutes = Router({ mergeParams: true });

workflowRoutes.use(authenticate);

// ── Workflow CRUD ─────────────────────────────────────────────────────

// List workflows
workflowRoutes.get(
  '/:spaceId/workflows',
  requirePermission(Permissions.MANAGE_WORKFLOWS),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workflows = await workflowsService.listWorkflows(req.params.spaceId);
      res.json(workflows);
    } catch (err) {
      next(err);
    }
  },
);

// Create workflow
workflowRoutes.post(
  '/:spaceId/workflows',
  requirePermission(Permissions.MANAGE_WORKFLOWS),
  validate(validation.createWorkflowSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workflow = await workflowsService.createWorkflow(
        req.params.spaceId,
        req.user!.userId,
        req.body,
      );
      res.status(201).json(workflow);
    } catch (err) {
      next(err);
    }
  },
);

// Get workflow
workflowRoutes.get(
  '/:spaceId/workflows/details/:id',
  requirePermission(Permissions.MANAGE_WORKFLOWS),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workflow = await workflowsService.getWorkflow(req.params.id);
      if (!workflow) return next(new NotFoundError('Workflow'));
      res.json(workflow);
    } catch (err) {
      next(err);
    }
  },
);

// Update workflow
workflowRoutes.put(
  '/:spaceId/workflows/details/:id',
  requirePermission(Permissions.MANAGE_WORKFLOWS),
  validate(validation.updateWorkflowSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await workflowsService.getWorkflow(req.params.id);
      if (!existing) return next(new NotFoundError('Workflow'));
      const workflow = await workflowsService.updateWorkflow(req.params.id, req.body);
      res.json(workflow);
    } catch (err) {
      next(err);
    }
  },
);

// Delete workflow
workflowRoutes.delete(
  '/:spaceId/workflows/details/:id',
  requirePermission(Permissions.MANAGE_WORKFLOWS),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await workflowsService.deleteWorkflow(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

// Toggle workflow
workflowRoutes.patch(
  '/:spaceId/workflows/details/:id/toggle',
  requirePermission(Permissions.MANAGE_WORKFLOWS),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await workflowsService.getWorkflow(req.params.id);
      if (!existing) return next(new NotFoundError('Workflow'));
      const workflow = await workflowsService.toggleWorkflow(req.params.id, !existing.enabled);
      res.json(workflow);
    } catch (err) {
      next(err);
    }
  },
);

// ── Execution Logs ────────────────────────────────────────────────────

workflowRoutes.get(
  '/:spaceId/workflows/executions',
  requirePermission(Permissions.MANAGE_WORKFLOWS),
  validate(validation.workflowExecutionsQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const executions = await workflowsService.listExecutions(
        req.params.spaceId,
        req.query as any,
      );
      res.json(executions);
    } catch (err) {
      next(err);
    }
  },
);

// ── Custom Commands ───────────────────────────────────────────────────

// List commands (any member can see for palette)
workflowRoutes.get(
  '/:spaceId/workflows/commands',
  requireMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const commands = await workflowsService.listCustomCommands(req.params.spaceId);
      res.json(commands);
    } catch (err) {
      next(err);
    }
  },
);

// Create command
workflowRoutes.post(
  '/:spaceId/workflows/commands',
  requirePermission(Permissions.MANAGE_WORKFLOWS),
  validate(validation.createCustomCommandSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const command = await workflowsService.createCustomCommand(
        req.params.spaceId,
        req.user!.userId,
        req.body,
      );
      res.status(201).json(command);
    } catch (err) {
      next(err);
    }
  },
);

// Update command
workflowRoutes.put(
  '/:spaceId/workflows/commands/:id',
  requirePermission(Permissions.MANAGE_WORKFLOWS),
  validate(validation.updateCustomCommandSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await workflowsService.getCustomCommandById(req.params.id);
      if (!existing) return next(new NotFoundError('Custom command'));
      const command = await workflowsService.updateCustomCommand(req.params.id, req.body);
      res.json(command);
    } catch (err) {
      next(err);
    }
  },
);

// Delete command
workflowRoutes.delete(
  '/:spaceId/workflows/commands/:id',
  requirePermission(Permissions.MANAGE_WORKFLOWS),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await workflowsService.deleteCustomCommand(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

// Invoke command
workflowRoutes.post(
  '/:spaceId/workflows/commands/:name/invoke',
  requireMember,
  validate(validation.invokeCommandSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const command = await workflowsService.getCustomCommand(req.params.spaceId, req.params.name);
      if (!command) return next(new NotFoundError('Custom command'));

      // Fire the slash_command trigger
      await processEvent('slash_command', req.params.spaceId, {
        spaceId: req.params.spaceId,
        userId: req.user!.userId,
        channelId: req.body.channelId,
        commandName: command.name,
        commandArgs: req.body.args || {},
      });

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

// ── Card Templates ────────────────────────────────────────────────────

// List card templates
workflowRoutes.get(
  '/:spaceId/workflows/card-templates',
  requirePermission(Permissions.MANAGE_WORKFLOWS),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const templates = await workflowsService.listCardTemplates(req.params.spaceId);
      res.json(templates);
    } catch (err) {
      next(err);
    }
  },
);

// Create card template
workflowRoutes.post(
  '/:spaceId/workflows/card-templates',
  requirePermission(Permissions.MANAGE_WORKFLOWS),
  validate(validation.createCardTemplateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const template = await workflowsService.createCardTemplate(
        req.params.spaceId,
        req.user!.userId,
        req.body,
      );
      res.status(201).json(template);
    } catch (err) {
      next(err);
    }
  },
);

// Update card template
workflowRoutes.put(
  '/:spaceId/workflows/card-templates/:id',
  requirePermission(Permissions.MANAGE_WORKFLOWS),
  validate(validation.updateCardTemplateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await workflowsService.getCardTemplate(req.params.id);
      if (!existing) return next(new NotFoundError('Card template'));
      const template = await workflowsService.updateCardTemplate(req.params.id, req.body);
      res.json(template);
    } catch (err) {
      next(err);
    }
  },
);

// Delete card template
workflowRoutes.delete(
  '/:spaceId/workflows/card-templates/:id',
  requirePermission(Permissions.MANAGE_WORKFLOWS),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await workflowsService.deleteCardTemplate(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

// ── Card Interactions ─────────────────────────────────────────────────

// Get card instance
workflowRoutes.get(
  '/:spaceId/workflows/cards/:instanceId',
  requireMember,
  async (req: Request, res: Response, next: NextFunction) => {
    console.log(`[Cards] GET card instance ${req.params.instanceId} for space ${req.params.spaceId}`);
    try {
      const instance = await workflowsService.getCardInstance(req.params.instanceId);
      if (!instance) return next(new NotFoundError('Card instance'));
      res.json(instance);
    } catch (err) {
      next(err);
    }
  },
);

// Interact with card
workflowRoutes.post(
  '/:spaceId/workflows/cards/:instanceId/interact',
  requireMember,
  validate(validation.cardInteractionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const instance = await workflowsService.getCardInstance(req.params.instanceId);
      if (!instance) return next(new NotFoundError('Card instance'));
      if (instance.status !== 'active') {
        return next(new BadRequestError('Card is no longer active'));
      }

      // Fire card_interaction trigger
      await processEvent('card_interaction', req.params.spaceId, {
        spaceId: req.params.spaceId,
        userId: req.user!.userId,
        channelId: instance.channelId,
        cardInstanceId: instance.id,
        cardTemplateId: instance.templateId,
        buttonId: req.body.buttonId || '',
        cardFields: req.body.fields || {},
      });

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);
