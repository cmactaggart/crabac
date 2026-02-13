import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { validate } from '../../middleware/validate.js';
import { validation, Permissions } from '@crabac/shared';
import { requirePermission } from './rbac.middleware.js';
import * as rbacService from './rbac.service.js';

export const rbacRoutes = Router();

rbacRoutes.use(authenticate);

// List roles
rbacRoutes.get(
  '/:spaceId/roles',
  requirePermission(Permissions.VIEW_CHANNELS), // any member can view roles
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roles = await rbacService.listRoles(req.params.spaceId);
      res.json(roles);
    } catch (err) {
      next(err);
    }
  },
);

// Create role
rbacRoutes.post(
  '/:spaceId/roles',
  requirePermission(Permissions.MANAGE_ROLES),
  validate(validation.createRoleSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = await rbacService.createRole(req.params.spaceId, req.user!.userId, req.body);
      res.status(201).json(role);
    } catch (err) {
      next(err);
    }
  },
);

// Update role
rbacRoutes.patch(
  '/:spaceId/roles/:roleId',
  requirePermission(Permissions.MANAGE_ROLES),
  validate(validation.updateRoleSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = await rbacService.updateRole(
        req.params.spaceId,
        req.params.roleId,
        req.user!.userId,
        req.body,
      );
      res.json(role);
    } catch (err) {
      next(err);
    }
  },
);

// Delete role
rbacRoutes.delete(
  '/:spaceId/roles/:roleId',
  requirePermission(Permissions.MANAGE_ROLES),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await rbacService.deleteRole(req.params.spaceId, req.params.roleId, req.user!.userId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

// Set member roles
rbacRoutes.put(
  '/:spaceId/members/:userId/roles',
  requirePermission(Permissions.MANAGE_MEMBERS),
  validate(validation.setMemberRolesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roles = await rbacService.setMemberRoles(
        req.params.spaceId,
        req.params.userId,
        req.body.roleIds,
        req.user!.userId,
      );
      res.json(roles);
    } catch (err) {
      next(err);
    }
  },
);
