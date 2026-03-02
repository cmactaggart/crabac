import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { validate } from '../../middleware/validate.js';
import { validation, Permissions } from '@crabac/shared';
import { requirePermission, requireMember } from '../rbac/rbac.middleware.js';
import * as newsletterService from './newsletter.service.js';
import * as sendService from './newsletter-send.service.js';
import * as trackingService from './newsletter-tracking.service.js';
import * as subscriptionService from './newsletter-subscription.service.js';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { config } from '../../config.js';

export const newsletterRoutes = Router();
newsletterRoutes.use(authenticate);

const upload = multer({
  storage: multer.diskStorage({
    destination: config.uploadsDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, 'nl-' + crypto.randomBytes(16).toString('hex') + ext);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  },
});

// ─── Space Newsletters ───

// List newsletters
newsletterRoutes.get(
  '/:spaceId/newsletters',
  requireMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = validation.newslettersQuerySchema.parse(req.query);
      const newsletters = await newsletterService.listNewsletters(req.params.spaceId, req.user!.userId, parsed);
      res.json(newsletters);
    } catch (err) { next(err); }
  },
);

// Get single newsletter
newsletterRoutes.get(
  '/:spaceId/newsletters/:id',
  requireMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const newsletter = await newsletterService.getNewsletter(req.params.id);
      res.json(newsletter);
    } catch (err) { next(err); }
  },
);

// Create newsletter
newsletterRoutes.post(
  '/:spaceId/newsletters',
  requirePermission(Permissions.MANAGE_NEWSLETTER),
  validate(validation.createNewsletterSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const newsletter = await newsletterService.createNewsletter(req.params.spaceId, req.user!.userId, req.body);
      // If published immediately, enqueue sends
      if (newsletter.status === 'published') {
        sendService.enqueueNewsletterSends(newsletter.id).catch(console.error);
      }
      res.status(201).json(newsletter);
    } catch (err) { next(err); }
  },
);

// Update newsletter
newsletterRoutes.patch(
  '/:spaceId/newsletters/:id',
  requireMember,
  validate(validation.updateNewsletterSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await newsletterService.getNewsletter(req.params.id);
      if (existing.authorId !== req.user!.userId) {
        await new Promise<void>((resolve, reject) => {
          requirePermission(Permissions.MANAGE_NEWSLETTER)(req, res, (err: any) => {
            if (err) reject(err); else resolve();
          });
        });
      }
      const wasPublished = existing.status === 'published';
      const updated = await newsletterService.updateNewsletter(req.params.id, req.body);
      // Enqueue sends if just published
      if (!wasPublished && updated.status === 'published') {
        sendService.enqueueNewsletterSends(updated.id).catch(console.error);
      }
      res.json(updated);
    } catch (err) { next(err); }
  },
);

// Delete newsletter
newsletterRoutes.delete(
  '/:spaceId/newsletters/:id',
  requirePermission(Permissions.MANAGE_NEWSLETTER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await newsletterService.deleteNewsletter(req.params.id);
      res.status(204).end();
    } catch (err) { next(err); }
  },
);

// Upload image
newsletterRoutes.post(
  '/:spaceId/newsletters/upload-image',
  requirePermission(Permissions.MANAGE_NEWSLETTER),
  upload.single('image'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) return res.status(400).json({ error: { message: 'No image uploaded' } });
      const url = `/uploads/${req.file.filename}`;
      res.json({ url });
    } catch (err) { next(err); }
  },
);

// Analytics
newsletterRoutes.get(
  '/:spaceId/newsletters/:id/stats',
  requirePermission(Permissions.MANAGE_NEWSLETTER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await trackingService.getNewsletterStats(req.params.id);
      res.json(stats);
    } catch (err) { next(err); }
  },
);

newsletterRoutes.get(
  '/:spaceId/newsletter-analytics',
  requirePermission(Permissions.MANAGE_NEWSLETTER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const analytics = await trackingService.getNewsletterAnalyticsList(req.params.spaceId);
      res.json(analytics);
    } catch (err) { next(err); }
  },
);

// Newsletter stats (drafts + published + subscribers combined)
newsletterRoutes.get(
  '/:spaceId/newsletter-stats',
  requirePermission(Permissions.MANAGE_NEWSLETTER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [stats, subscriberCounts] = await Promise.all([
        newsletterService.getNewsletterStats(req.params.spaceId),
        subscriptionService.getSubscriberCounts('space', req.params.spaceId),
      ]);
      res.json({ ...stats, subscribers: subscriberCounts.total });
    } catch (err) { next(err); }
  },
);

// Subscriber counts
newsletterRoutes.get(
  '/:spaceId/newsletter-subscribers/count',
  requirePermission(Permissions.MANAGE_NEWSLETTER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const counts = await subscriptionService.getSubscriberCounts('space', req.params.spaceId);
      res.json(counts);
    } catch (err) { next(err); }
  },
);

// ─── Personal Newsletters ───

export const personalNewsletterRoutes = Router();
personalNewsletterRoutes.use(authenticate);

personalNewsletterRoutes.get(
  '/me/newsletters',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = validation.newslettersQuerySchema.parse(req.query);
      const newsletters = await newsletterService.listPersonalNewsletters(req.user!.userId, parsed);
      res.json(newsletters);
    } catch (err) { next(err); }
  },
);

personalNewsletterRoutes.post(
  '/me/newsletters',
  validate(validation.createNewsletterSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const newsletter = await newsletterService.createNewsletter(null, req.user!.userId, req.body);
      if (newsletter.status === 'published') {
        sendService.enqueueNewsletterSends(newsletter.id).catch(console.error);
      }
      res.status(201).json(newsletter);
    } catch (err) { next(err); }
  },
);

personalNewsletterRoutes.patch(
  '/me/newsletters/:id',
  validate(validation.updateNewsletterSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await newsletterService.getNewsletter(req.params.id);
      if (existing.authorId !== req.user!.userId) {
        return res.status(403).json({ error: { message: 'Forbidden' } });
      }
      const wasPublished = existing.status === 'published';
      const updated = await newsletterService.updateNewsletter(req.params.id, req.body);
      if (!wasPublished && updated.status === 'published') {
        sendService.enqueueNewsletterSends(updated.id).catch(console.error);
      }
      res.json(updated);
    } catch (err) { next(err); }
  },
);

personalNewsletterRoutes.delete(
  '/me/newsletters/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await newsletterService.getNewsletter(req.params.id);
      if (existing.authorId !== req.user!.userId) {
        return res.status(403).json({ error: { message: 'Forbidden' } });
      }
      await newsletterService.deleteNewsletter(req.params.id);
      res.status(204).end();
    } catch (err) { next(err); }
  },
);

personalNewsletterRoutes.post(
  '/me/newsletters/upload-image',
  upload.single('image'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) return res.status(400).json({ error: { message: 'No image uploaded' } });
      res.json({ url: `/uploads/${req.file.filename}` });
    } catch (err) { next(err); }
  },
);
