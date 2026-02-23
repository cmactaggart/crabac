import type { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../../lib/errors.js';
import { hasPermission } from '@crabac/shared';
import { computePermissions } from './rbac.service.js';
import * as spacesService from '../spaces/spaces.service.js';
import { db } from '../../database/connection.js';

/** Get or create the request-scoped permission cache */
function getPermCache(req: Request): Map<string, string> {
  if (!req.permCache) req.permCache = new Map();
  return req.permCache;
}

/**
 * Middleware that checks if the authenticated user is a member of the space
 * identified by req.params.spaceId.
 * Stashes basePerms on req to avoid recomputation downstream.
 */
export async function requireMember(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new UnauthorizedError());

    const spaceId = req.params.spaceId;
    const cache = getPermCache(req);

    // Use computePermissions which checks membership internally
    // and cache the result so downstream handlers can reuse it
    if (req.basePerms === undefined) {
      req.basePerms = await computePermissions(spaceId, req.user.userId, cache);
    }

    // Members and owners have perms > 0; guests in public spaces also have perms > 0
    // but requireMember should only allow actual members
    const member = await spacesService.isMember(spaceId, req.user.userId, cache);
    if (!member) return next(new ForbiddenError('You are not a member of this space'));

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware that allows access if the user is a member OR the space is public.
 * For public spaces, also checks email verification requirement.
 * Stashes basePerms on req to avoid recomputation downstream.
 */
export async function requireMemberOrPublicAccess(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new UnauthorizedError());

    const spaceId = req.params.spaceId;
    const cache = getPermCache(req);

    // computePermissions handles both member and guest (public space) cases
    const basePerms = await computePermissions(spaceId, req.user.userId, cache);
    req.basePerms = basePerms;

    // If they have any permissions, they have access (member or guest)
    if (basePerms > 0n) return next();

    // Zero perms — check if space is public (guest role may grant 0 perms explicitly, which is unusual)
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
 * Reuses basePerms from req if already computed by prior middleware.
 */
export function requirePermission(perm: bigint) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new UnauthorizedError());

      const spaceId = req.params.spaceId;
      const cache = getPermCache(req);

      const member = await spacesService.isMember(spaceId, req.user.userId, cache);
      if (!member) return next(new ForbiddenError('You are not a member of this space'));

      const userPerms = req.basePerms ?? await computePermissions(spaceId, req.user.userId, cache);
      req.basePerms = userPerms;

      if (!hasPermission(userPerms, perm)) {
        return next(new ForbiddenError('You do not have the required permission'));
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
