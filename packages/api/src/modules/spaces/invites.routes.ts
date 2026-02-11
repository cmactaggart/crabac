import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { validate } from '../../middleware/validate.js';
import { validation, Permissions } from '@gud/shared';
import { requirePermission } from '../rbac/rbac.middleware.js';
import * as invitesService from './invites.service.js';

export const inviteRoutes = Router();

// Public preview (no auth required) — shows space name for invite landing page
inviteRoutes.get(
  '/invites/:code/preview',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invite = await invitesService.previewInvite(req.params.code);
      res.json(invite);
    } catch (err) {
      next(err);
    }
  },
);

inviteRoutes.use(authenticate);

// Create invite
inviteRoutes.post(
  '/:spaceId/invites',
  requirePermission(Permissions.CREATE_INVITES),
  validate(validation.createInviteSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invite = await invitesService.createInvite(req.params.spaceId, req.user!.userId, req.body);
      res.status(201).json(invite);
    } catch (err) {
      next(err);
    }
  },
);

// List invites
inviteRoutes.get(
  '/:spaceId/invites',
  requirePermission(Permissions.MANAGE_INVITES),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invites = await invitesService.listInvites(req.params.spaceId);
      res.json(invites);
    } catch (err) {
      next(err);
    }
  },
);

// Delete invite
inviteRoutes.delete(
  '/:spaceId/invites/:inviteId',
  requirePermission(Permissions.MANAGE_INVITES),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await invitesService.deleteInvite(req.params.spaceId, req.params.inviteId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
