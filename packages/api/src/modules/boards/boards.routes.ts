import { Router, type Request, type Response, type NextFunction } from 'express';
import { optionalAuthenticate, requirePublicBoard, requireBoardAuth, requireReadAccess } from './boards.middleware.js';
import * as boardsService from './boards.service.js';
import * as forumsService from '../forums/forums.service.js';
import { validate } from '../../middleware/validate.js';
import { validation } from '@crabac/shared';

export const boardsRoutes = Router();

// All board routes use optional auth
boardsRoutes.use(optionalAuthenticate);

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

// Create thread (requires auth)
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
