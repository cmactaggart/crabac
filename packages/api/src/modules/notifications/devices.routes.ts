import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { registerDeviceToken, unregisterDeviceToken } from './push.service.js';

const router = Router();

router.post('/register', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, platform, appVersion, tokenType } = req.body;
    if (!token || !platform) {
      return res.status(400).json({ error: { message: 'token and platform required' } });
    }
    if (!['ios', 'android'].includes(platform)) {
      return res.status(400).json({ error: { message: 'platform must be ios or android' } });
    }
    if (tokenType && !['standard', 'voip'].includes(tokenType)) {
      return res.status(400).json({ error: { message: 'tokenType must be standard or voip' } });
    }
    await registerDeviceToken(req.user!.userId, token, platform, appVersion, tokenType);
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:token', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await unregisterDeviceToken(req.params.token);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export { router as devicesRoutes };
