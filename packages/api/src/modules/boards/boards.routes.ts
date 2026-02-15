import { Router, type Request, type Response, type NextFunction } from 'express';
import { optionalAuthenticate, requirePublicBoard, requireBoardAuth, requireReadAccess } from './boards.middleware.js';
import * as boardsService from './boards.service.js';
import * as forumsService from '../forums/forums.service.js';
import * as calendarService from '../calendar/calendar.service.js';
import { validate } from '../../middleware/validate.js';
import { validation } from '@crabac/shared';

export const boardsRoutes = Router();

// All board routes use optional auth
boardsRoutes.use(optionalAuthenticate);

// ─── Public Calendar ───

// Get public calendar space info + categories
boardsRoutes.get(
  '/calendar/:spaceSlug',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await boardsService.getPublicCalendarSpace(req.params.spaceSlug);
      // Check anonymous access
      if (!req.user && !data.allowAnonymousBrowsing) {
        return res.status(401).json({ error: { message: 'Authentication required' } });
      }
      res.json({ space: data.space, categories: data.categories });
    } catch (err) {
      next(err);
    }
  },
);

// Get public calendar events
boardsRoutes.get(
  '/calendar/:spaceSlug/events',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await boardsService.getPublicCalendarSpace(req.params.spaceSlug);
      // Check anonymous access
      if (!req.user && !data.allowAnonymousBrowsing) {
        return res.status(401).json({ error: { message: 'Authentication required' } });
      }

      const { from, to } = req.query as { from?: string; to?: string };
      if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        return res.status(400).json({ error: { message: 'Invalid from/to date parameters' } });
      }

      // If authenticated user is a space member, show all events; otherwise public only
      let isMember = false;
      if (req.user) {
        isMember = await boardsService.isSpaceMember(String(data.space.id), req.user.userId);
      }

      const events = isMember
        ? await calendarService.listEvents(String(data.space.id), from, to)
        : await calendarService.listPublicEvents(String(data.space.id), from, to);

      res.json(events);
    } catch (err) {
      next(err);
    }
  },
);

// List public channels for a space
boardsRoutes.get(
  '/:spaceSlug',
  requirePublicBoard,
  requireReadAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const space = (req as any).boardSpace;
      const channels = await boardsService.listPublicChannels(String(space.id));
      res.json({
        space: {
          id: space.id,
          name: space.name,
          slug: space.slug,
          description: space.description,
          iconUrl: space.icon_url,
        },
        channels,
      });
    } catch (err) {
      next(err);
    }
  },
);

// List items in a public gallery channel (must be before /:channelName/:threadId)
boardsRoutes.get(
  '/:spaceSlug/:channelName/gallery',
  requirePublicBoard,
  requireReadAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const channel = (req as any).boardChannel;
      if (channel.type !== 'media_gallery') {
        return res.status(404).json({ error: { message: 'Not a gallery channel' } });
      }
      const { before, limit } = req.query as any;
      const items = await boardsService.listPublicGalleryItems(String(channel.id), {
        before,
        limit: Math.min(parseInt(limit) || 30, 100),
      });
      res.json(items);
    } catch (err) {
      next(err);
    }
  },
);

// Create thread (requires auth) - must be before /:channelName/:threadId
boardsRoutes.post(
  '/:spaceSlug/:channelName/threads',
  requirePublicBoard,
  requireBoardAuth,
  validate(validation.createThreadSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const channel = (req as any).boardChannel;
      const thread = await forumsService.createThread(
        String(channel.id),
        req.user!.userId,
        req.body,
      );
      res.status(201).json(thread);
    } catch (err) {
      next(err);
    }
  },
);

// List threads in a public board channel
boardsRoutes.get(
  '/:spaceSlug/:channelName',
  requirePublicBoard,
  requireReadAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const channel = (req as any).boardChannel;
      const { before, limit, sort } = req.query as any;
      const threads = await forumsService.listThreads(String(channel.id), {
        before,
        limit: Math.min(parseInt(limit) || 30, 100),
        sort: sort === 'newest' ? 'newest' : 'latest',
      });
      res.json(threads);
    } catch (err) {
      next(err);
    }
  },
);

// Get thread + posts
boardsRoutes.get(
  '/:spaceSlug/:channelName/:threadId',
  requirePublicBoard,
  requireReadAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const thread = await forumsService.getThread(req.params.threadId);
      const { before, limit } = req.query as any;
      const posts = await forumsService.listThreadPosts(req.params.threadId, {
        before,
        limit: Math.min(parseInt(limit) || 50, 100),
      });
      res.json({ thread, posts });
    } catch (err) {
      next(err);
    }
  },
);

// Create post in thread (requires auth)
boardsRoutes.post(
  '/:spaceSlug/:channelName/:threadId/posts',
  requirePublicBoard,
  requireBoardAuth,
  validate(validation.createThreadPostSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const post = await forumsService.createThreadPost(
        req.params.threadId,
        req.user!.userId,
        req.body,
      );
      res.status(201).json(post);
    } catch (err) {
      next(err);
    }
  },
);
