import { Router, type Request, type Response, type NextFunction } from 'express';
import { validate } from '../../middleware/validate.js';
import { validation } from '@crabac/shared';
import * as subscriptionService from './newsletter-subscription.service.js';
import * as newsletterService from './newsletter.service.js';
import { db } from '../../database/connection.js';
import { NotFoundError } from '../../lib/errors.js';

export const newsletterPublicRoutes = Router();

// Anonymous subscribe
newsletterPublicRoutes.post(
  '/subscribe',
  validate(validation.anonymousSubscribeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await subscriptionService.anonymousSubscribe(req.body);
      res.json(result);
    } catch (err) { next(err); }
  },
);

// Verify anonymous subscription
newsletterPublicRoutes.get(
  '/verify/:token',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await subscriptionService.verifyAnonymousSubscription(req.params.token);
      res.json(result);
    } catch (err) { next(err); }
  },
);

// Unsubscribe via token (link from email)
newsletterPublicRoutes.get(
  '/unsubscribe/:token',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await subscriptionService.unsubscribeByToken(req.params.token);
      res.json(result);
    } catch (err) { next(err); }
  },
);

// Get preferences by token
newsletterPublicRoutes.get(
  '/preferences/:token',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const prefs = await subscriptionService.getPreferencesByToken(req.params.token);
      res.json(prefs);
    } catch (err) { next(err); }
  },
);

// Update preferences by token
newsletterPublicRoutes.patch(
  '/preferences/:token',
  validate(validation.updateAnonymousPreferencesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const prefs = await subscriptionService.updatePreferencesByToken(req.params.token, req.body);
      res.json(prefs);
    } catch (err) { next(err); }
  },
);

// ─── Public Newsletter Reading ───

// List newsletters for a space (by slug)
newsletterPublicRoutes.get(
  '/space/:spaceSlug',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const space = await db('spaces').where('slug', req.params.spaceSlug).first();
      if (!space) throw new NotFoundError('Space');

      const settings = await db('space_settings').where('space_id', space.id).first();
      if (!settings?.allow_public_newsletter) throw new NotFoundError('Newsletter not enabled');

      const parsed = validation.newslettersQuerySchema.parse(req.query);
      const newsletters = await newsletterService.listPublicNewsletters(String(space.id), parsed);
      res.json({ space: { id: String(space.id), name: space.name, slug: space.slug, iconUrl: space.icon_url }, newsletters });
    } catch (err) { next(err); }
  },
);

// Get single public newsletter for a space
newsletterPublicRoutes.get(
  '/space/:spaceSlug/:newsletterId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const newsletter = await newsletterService.getPublicNewsletter(req.params.newsletterId);
      res.json(newsletter);
    } catch (err) { next(err); }
  },
);

// List personal newsletters (by username)
newsletterPublicRoutes.get(
  '/user/:username',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await db('users').where('username', req.params.username).first();
      if (!user) throw new NotFoundError('User');

      const parsed = validation.newslettersQuerySchema.parse(req.query);
      const newsletters = await newsletterService.listPublicPersonalNewsletters(String(user.id), parsed);
      res.json({
        user: { id: String(user.id), username: user.username, displayName: user.display_name, avatarUrl: user.avatar_url },
        newsletters,
      });
    } catch (err) { next(err); }
  },
);

// Get single personal newsletter
newsletterPublicRoutes.get(
  '/user/:username/:newsletterId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const newsletter = await newsletterService.getPublicPersonalNewsletter(req.params.newsletterId);
      res.json(newsletter);
    } catch (err) { next(err); }
  },
);
