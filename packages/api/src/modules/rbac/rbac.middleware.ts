import type { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../../lib/errors.js';
import { hasPermission } from '@crabac/shared';
import { computePermissions } from './rbac.service.js';
import * as spacesService from '../spaces/spaces.service.js';
import { db } from '../../database/connection.js';

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
 * Middleware that allows access if the user is a member OR the space is public.
 * For public spaces, also checks email verification requirement.
 */
export async function requireMemberOrPublicAccess(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new UnauthorizedError());

    const spaceId = req.params.spaceId;
    const member = await spacesService.isMember(spaceId, req.user.userId);
    if (member) return next();

    // Not a member — check if space is public
    const settings = await db('space_settings').where('space_id', spaceId).first();
    if (!settings?.is_public) {
      return next(new ForbiddenError('You are not a member of this space'));
    }

    // Check email verification requirement
    if (settings.require_verified_email) {
      const user = await db('users').where('id', req.user.userId).select('email_verified').first();
      if (!user?.email_verified) {
        return next(new ForbiddenError('Email verification required to access this space'));
      }
    }

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
