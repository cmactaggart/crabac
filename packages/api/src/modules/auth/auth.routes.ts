import { Router, type Request, type Response, type NextFunction } from 'express';
import { validate } from '../../middleware/validate.js';
import { authLimiter, strictAuthLimiter } from '../../middleware/rate-limiter.js';
import { validation } from '@gud/shared';
import { authenticate } from './auth.middleware.js';
import * as authService from './auth.service.js';
import * as verificationService from './verification.service.js';
import * as magicLinkService from './magic-link.service.js';

export const authRoutes = Router();

authRoutes.use(authLimiter);

authRoutes.post(
  '/register',
  strictAuthLimiter,
  validate(validation.registerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, username, displayName, password } = req.body;
      const result = await authService.register(email, username, displayName, password);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

authRoutes.post(
  '/login',
  strictAuthLimiter,
  validate(validation.loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { login, password } = req.body;
      const result = await authService.login(login, password);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

authRoutes.post(
  '/refresh',
  validate(validation.refreshSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refresh(refreshToken);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

authRoutes.post(
  '/logout',
  validate(validation.refreshSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;
      await authService.logout(refreshToken);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

// Email verification
authRoutes.post(
  '/verify-email',
  validate(validation.verifyEmailSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.body;
      await verificationService.verifyEmail(token);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

authRoutes.post(
  '/resend-verification',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await verificationService.resendVerification(req.user!.userId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

// Magic links
authRoutes.post(
  '/magic-link/send',
  validate(validation.magicLinkSendSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;
      await magicLinkService.sendMagicLink(email);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

authRoutes.post(
  '/magic-link/redeem',
  validate(validation.magicLinkRedeemSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.body;
      const result = await authService.loginWithMagicLink(token);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// MFA verification (during login)
authRoutes.post(
  '/mfa/verify',
  validate(validation.mfaVerifySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { mfaToken, code } = req.body;
      const result = await authService.loginWithMFA(mfaToken, code);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);
