import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config.js';
import { db } from '../../database/connection.js';
import { NotFoundError, ForbiddenError, UnauthorizedError } from '../../lib/errors.js';
import type { JwtPayload } from '../auth/auth.middleware.js';

// Parse JWT if present, doesn't error if missing
export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next();
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.user = payload;
  } catch {
    // Invalid token - treat as anonymous
  }
  next();
}

// Loads space by slug + channel by name, verifies public board access
export function requirePublicBoard(req: Request, _res: Response, next: NextFunction) {
  loadPublicBoard(req)
    .then(() => next())
    .catch(next);
}

async function loadPublicBoard(req: Request) {
  const { spaceSlug, channelName } = req.params;

  // Load space
  const space = await db('spaces').where('slug', spaceSlug).first();
  if (!space) throw new NotFoundError('Space');

  // Check space settings
  const settings = await db('space_settings').where('space_id', space.id).first();
  if (!settings?.allow_public_boards) throw new NotFoundError('Space');

  // Store space data on request for downstream use
  (req as any).boardSpace = space;
  (req as any).boardSettings = settings;

  // If channelName is provided, load and verify channel
  if (channelName) {
    const channel = await db('channels')
      .where({ space_id: space.id, name: channelName })
      .first();
    if (!channel) throw new NotFoundError('Channel');
    if (!channel.is_public || channel.type !== 'forum') throw new NotFoundError('Channel');
    (req as any).boardChannel = channel;
  }
}

// Require authenticated user for write operations on boards
// Allows both full app users (who are space members) and verified board users
export function requireBoardAuth(req: Request, _res: Response, next: NextFunction) {
  verifyBoardAuth(req)
    .then(() => next())
    .catch(next);
}

async function verifyBoardAuth(req: Request) {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required to post');
  }

  const userId = req.user.userId;
  const space = (req as any).boardSpace;
  if (!space) throw new NotFoundError('Space');

  // Check if user is a full app user who is a member of the space
  const user = await db('users').where('id', userId).select('account_type', 'email_verified').first();
  if (!user) throw new UnauthorizedError('User not found');

  if (user.account_type === 'full') {
    // Full users can post if they are space members
    const membership = await db('space_members')
      .where({ space_id: space.id, user_id: userId })
      .first();
    if (membership) return;
  }

  // Check board registration
  const registration = await db('board_registrations')
    .where({ user_id: userId, space_id: space.id })
    .first();
  if (!registration) {
    throw new ForbiddenError('You must be registered for this board');
  }

  // Verify email
  if (!user.email_verified) {
    throw new ForbiddenError('Email verification required before posting');
  }
}

// Check if anonymous browsing is allowed for read operations
export function requireReadAccess(req: Request, _res: Response, next: NextFunction) {
  const settings = (req as any).boardSettings;
  if (!req.user && (!settings || !settings.allow_anonymous_browsing)) {
    return next(new UnauthorizedError('Authentication required'));
  }
  next();
}
