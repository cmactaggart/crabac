import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import * as notificationsService from './notifications.service.js';

export const notificationsRoutes = Router();
notificationsRoutes.use(authenticate);

// List notifications (paginated)
notificationsRoutes.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { before, limit } = req.query as any;
    const notifications = await notificationsService.listNotifications(req.user!.userId, {
      before,
      limit: Math.min(parseInt(limit) || 25, 50),
    });
    res.json(notifications);
  } catch (err) {
    next(err);
  }
});

// Get unread count
notificationsRoutes.get('/unread-count', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await notificationsService.getUnreadCount(req.user!.userId);
    res.json({ count });
  } catch (err) {
    next(err);
  }
});

// Mark single notification as read
notificationsRoutes.put('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await notificationsService.markAsRead(req.params.id, req.user!.userId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Mark all as read
notificationsRoutes.put('/read-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await notificationsService.markAllAsRead(req.user!.userId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
