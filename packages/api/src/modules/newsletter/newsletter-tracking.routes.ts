import { Router, type Request, type Response, type NextFunction } from 'express';
import * as trackingService from './newsletter-tracking.service.js';
import { TRACKING_PIXEL } from './newsletter-tracking.service.js';

export const newsletterTrackingRoutes = Router();

// Open tracking pixel
newsletterTrackingRoutes.get(
  '/open/:trackingToken',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await trackingService.recordOpen(req.params.trackingToken);
    } catch {
      // Silently fail - don't break email rendering
    }
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.end(TRACKING_PIXEL);
  },
);

// Click tracking redirect
newsletterTrackingRoutes.get(
  '/click/:trackingToken',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const url = req.query.url as string;
      if (!url) return res.status(400).send('Missing URL');

      const redirectUrl = await trackingService.recordClick(
        req.params.trackingToken,
        url,
        req.headers['user-agent'] || null,
        req.ip || null,
      );
      res.redirect(302, redirectUrl);
    } catch {
      const url = req.query.url as string;
      if (url) res.redirect(302, url);
      else res.status(404).send('Not found');
    }
  },
);
