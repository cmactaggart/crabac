import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { validate } from '../../middleware/validate.js';
import { validation } from '@gud/shared';
import { requireMember } from '../rbac/rbac.middleware.js';
import * as portalsService from './portals.service.js';
import { getChannelSpaceId } from '../channels/channels.service.js';

export const portalsRoutes = Router();

portalsRoutes.use(authenticate);

// Create portal directly (requires CREATE_PORTAL in target space)
portalsRoutes.post(
  '/:spaceId/portals',
  requireMember,
  validate(validation.createPortalSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const portal = await portalsService.createPortal(
        req.body.channelId,
        req.params.spaceId,
        req.body.targetSpaceId,
        req.user!.userId,
      );
      res.status(201).json(portal);
    } catch (err) {
      next(err);
    }
  },
);

// Submit portal invite (requires SUBMIT_PORTAL_INVITE in target space)
portalsRoutes.post(
  '/:spaceId/portal-invites',
  requireMember,
  validate(validation.submitPortalInviteSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invite = await portalsService.submitPortalInvite(
        req.body.channelId,
        req.params.spaceId,
        req.body.targetSpaceId,
        req.user!.userId,
      );
      res.status(201).json(invite);
    } catch (err) {
      next(err);
    }
  },
);

// List portals for a space
portalsRoutes.get(
  '/:spaceId/portals',
  requireMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const portals = await portalsService.getPortalsForSpace(req.params.spaceId);
      res.json(portals);
    } catch (err) {
      next(err);
    }
  },
);

// List pending portal invites for a space
portalsRoutes.get(
  '/:spaceId/portal-invites',
  requireMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invites = await portalsService.getPortalInvites(req.params.spaceId);
      res.json(invites);
    } catch (err) {
      next(err);
    }
  },
);

// Accept portal invite
portalsRoutes.post(
  '/:spaceId/portal-invites/:inviteId/accept',
  requireMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await portalsService.acceptPortalInvite(req.params.inviteId, req.user!.userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// Reject portal invite
portalsRoutes.post(
  '/:spaceId/portal-invites/:inviteId/reject',
  requireMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await portalsService.rejectPortalInvite(req.params.inviteId, req.user!.userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// Remove portal
portalsRoutes.delete(
  '/:spaceId/portals/:portalId',
  requireMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await portalsService.removePortal(req.params.portalId, req.user!.userId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

// Get eligible spaces for portaling a channel (standalone route, not space-scoped)
portalsRoutes.get(
  '/eligible-spaces/:channelId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const spaces = await portalsService.getEligibleSpaces(req.user!.userId, req.params.channelId);
      res.json(spaces);
    } catch (err) {
      next(err);
    }
  },
);
