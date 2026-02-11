import type { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../../lib/errors.js';
import { hasPermission } from '@gud/shared';
import { computePermissions } from './rbac.service.js';
import * as spacesService from '../spaces/spaces.service.js';

/**
 * Middleware that checks if the authenticated user is a member of the space
 * identified by req.params.spaceId.
 */
export async function requireMember(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new UnauthorizedError());

    const spaceId = req.params.spaceId;
    const member = await spacesService.isMember(spaceId, req.user.userId);
    if (!member) return next(new ForbiddenError('You are not a member of this space'));

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware factory that checks if the user has a specific permission in the space.
 * Also implies membership check.
 */
export function requirePermission(perm: bigint) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new UnauthorizedError());

      const spaceId = req.params.spaceId;
      const member = await spacesService.isMember(spaceId, req.user.userId);
      if (!member) return next(new ForbiddenError('You are not a member of this space'));

      const userPerms = await computePermissions(spaceId, req.user.userId);
      if (!hasPermission(userPerms, perm)) {
        return next(new ForbiddenError('You do not have the required permission'));
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
