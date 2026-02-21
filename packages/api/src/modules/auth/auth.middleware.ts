import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config.js';
import { db } from '../../database/connection.js';
import { UnauthorizedError, ForbiddenError } from '../../lib/errors.js';

export interface JwtPayload {
  userId: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or invalid authorization header'));
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.user = payload;

    // Check if user is banned from the app
    const ban = await db('user_bans').where('user_id', payload.userId).first();
    if (ban) {
      return next(new ForbiddenError('Your account has been suspended'));
    }

    next();
  } catch (err) {
    if (err instanceof ForbiddenError) return next(err);
    next(new UnauthorizedError('Invalid or expired token'));
  }
}
