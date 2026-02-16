import { Router, type Request, type Response, type NextFunction } from 'express';
import { optionalAuthenticate, requirePublicBoard, requireBoardAuth, requireReadAccess } from './boards.middleware.js';
import * as boardsService from './boards.service.js';
import * as forumsService from '../forums/forums.service.js';
import * as calendarService from '../calendar/calendar.service.js';
import * as routeLibraryService from '../route-library/route-library.service.js';
import * as blogService from '../blog/blog.service.js';
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
        ? await calendarService.listEvents(String(data.space.id), from, to, req.user?.userId)
        : await calendarService.listPublicEvents(String(data.space.id), from, to);

      res.json(events);
    } catch (err) {
      next(err);
    }
  },
);

// ─── Public Blog ───

boardsRoutes.get(
  '/blog/:spaceSlug',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const space = await boardsService.getPublicSpace(req.params.spaceSlug);
      const settings = await (await import('../../database/connection.js')).db('space_settings').where('space_id', space.id).first();
      if (!settings?.allow_public_blog) {
        return res.status(404).json({ error: { message: 'Blog not available' } });
      }
      if (!req.user && (!settings || !settings.allow_anonymous_browsing)) {
        return res.status(401).json({ error: { message: 'Authentication required' } });
      }
      const { before, limit } = req.query as any;
      const posts = await blogService.listPublicPosts(String(space.id), {
        before,
        limit: Math.min(parseInt(limit) || 20, 50),
      });
      res.json({ space, posts });
    } catch (err) {
      next(err);
    }
  },
);

boardsRoutes.get(
  '/blog/:spaceSlug/:postId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const space = await boardsService.getPublicSpace(req.params.spaceSlug);
      const settings = await (await import('../../database/connection.js')).db('space_settings').where('space_id', space.id).first();
      if (!settings?.allow_public_blog) {
        return res.status(404).json({ error: { message: 'Blog not available' } });
      }
      if (!req.user && (!settings || !settings.allow_anonymous_browsing)) {
        return res.status(401).json({ error: { message: 'Authentication required' } });
      }
      const post = await blogService.getPublicPost(req.params.postId);
      res.json({ space, post });
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

// ─── Public Route Library ───

// List ALL public routes across all route_library channels in a space
boardsRoutes.get(
  '/:spaceSlug/all-routes',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const space = await boardsService.getPublicSpace(req.params.spaceSlug);
      // Check read access
      const settings = await (await import('../../database/connection.js')).db('space_settings').where('space_id', space.id).first();
      if (!req.user && (!settings || !settings.allow_anonymous_browsing)) {
        return res.status(401).json({ error: { message: 'Authentication required' } });
      }
      const parsed = validation.routesQuerySchema.parse(req.query);
      const channelId = req.query.channelId as string | undefined;
      const data = await boardsService.listAllPublicRouteItems(String(space.id), {
        ...parsed,
        channelId,
        userId: req.user?.userId,
      });
      res.json(data);
    } catch (err) {
      next(err);
    }
  },
);

// List public route items
boardsRoutes.get(
  '/:spaceSlug/:channelName/routes',
  requirePublicBoard,
  requireReadAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const channel = (req as any).boardChannel;
      if (channel.type !== 'route_library') {
        return res.status(404).json({ error: { message: 'Not a route library channel' } });
      }
      const parsed = validation.routesQuerySchema.parse(req.query);
      const items = await boardsService.listPublicRouteItems(String(channel.id), {
        ...parsed,
        userId: req.user?.userId,
      });
      res.json(items);
    } catch (err) {
      next(err);
    }
  },
);

// Get public route categories for a space
boardsRoutes.get(
  '/:spaceSlug/:channelName/route-categories',
  requirePublicBoard,
  requireReadAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const space = (req as any).boardSpace;
      const categories = await boardsService.listPublicRouteCategories(String(space.id));
      res.json(categories);
    } catch (err) {
      next(err);
    }
  },
);

// Star a public route (requires auth)
boardsRoutes.post(
  '/:spaceSlug/:channelName/routes/:routeId/star',
  requirePublicBoard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: { message: 'Authentication required to star routes' } });
      }
      await routeLibraryService.starRoute(req.user.userId, req.params.routeId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

// Unstar a public route (requires auth)
boardsRoutes.delete(
  '/:spaceSlug/:channelName/routes/:routeId/star',
  requirePublicBoard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: { message: 'Authentication required' } });
      }
      await routeLibraryService.unstarRoute(req.user.userId, req.params.routeId);
      res.json({ success: true });
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
