import type { Request, Response, NextFunction } from 'express';
import { config } from '../../config.js';
import { ForbiddenError } from '../../lib/errors.js';

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const email = req.user?.email;
  if (!email || !config.adminEmails.includes(email)) {
    return next(new ForbiddenError('Admin access required'));
  }
  next();
}
