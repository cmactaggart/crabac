import { Router, type Request, type Response, type NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { validate } from '../../middleware/validate.js';
import { validation } from '@crabac/shared';
import { authenticate } from './auth.middleware.js';
import { db } from '../../database/connection.js';
import { UnauthorizedError } from '../../lib/errors.js';
import * as mfaService from './mfa.service.js';

export const mfaRoutes = Router();

mfaRoutes.use(authenticate);

// Setup TOTP (get QR code + secret)
mfaRoutes.post(
  '/totp/setup',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await mfaService.setupTOTP(req.user!.userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// Confirm TOTP with a code (enables MFA)
mfaRoutes.post(
  '/totp/confirm',
  validate(validation.totpConfirmSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { code } = req.body;
      await mfaService.confirmTOTP(req.user!.userId, code);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

// Disable TOTP (requires password)
mfaRoutes.post(
  '/totp/disable',
  validate(validation.totpDisableSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { password } = req.body;
      const user = await db('users').where('id', req.user!.userId).first();
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) throw new UnauthorizedError('Invalid password');
      await mfaService.disableTOTP(req.user!.userId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

// Regenerate backup codes (requires password)
mfaRoutes.post(
  '/totp/backup-codes',
  validate(validation.totpDisableSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { password } = req.body;
      const user = await db('users').where('id', req.user!.userId).first();
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) throw new UnauthorizedError('Invalid password');
      const backupCodes = await mfaService.regenerateBackupCodes(req.user!.userId);
      res.json({ backupCodes });
    } catch (err) {
      next(err);
    }
  },
);
