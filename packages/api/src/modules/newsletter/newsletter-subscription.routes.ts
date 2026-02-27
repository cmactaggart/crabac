import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { validate } from '../../middleware/validate.js';
import { validation } from '@crabac/shared';
import * as subscriptionService from './newsletter-subscription.service.js';

export const newsletterSubscriptionRoutes = Router();
newsletterSubscriptionRoutes.use(authenticate);

// List my subscriptions
newsletterSubscriptionRoutes.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const subs = await subscriptionService.listUserSubscriptions(req.user!.userId);
      res.json(subs);
    } catch (err) { next(err); }
  },
);

// Get subscription for a specific source
newsletterSubscriptionRoutes.get(
  '/check',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sourceType, sourceId } = req.query as { sourceType: string; sourceId: string };
      if (!sourceType || !sourceId) return res.json(null);
      const sub = await subscriptionService.getUserSubscription(req.user!.userId, sourceType, sourceId);
      res.json(sub);
    } catch (err) { next(err); }
  },
);

// Subscribe
newsletterSubscriptionRoutes.post(
  '/',
  validate(validation.subscribeNewsletterSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sub = await subscriptionService.subscribe(req.user!.userId, req.body);
      res.status(201).json(sub);
    } catch (err) { next(err); }
  },
);

// Update subscription
newsletterSubscriptionRoutes.patch(
  '/:id',
  validate(validation.updateNewsletterSubscriptionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sub = await subscriptionService.updateSubscription(req.params.id, req.user!.userId, req.body);
      res.json(sub);
    } catch (err) { next(err); }
  },
);

// Unsubscribe
newsletterSubscriptionRoutes.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await subscriptionService.unsubscribe(req.params.id, req.user!.userId);
      res.status(204).end();
    } catch (err) { next(err); }
  },
);
