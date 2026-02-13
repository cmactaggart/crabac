import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { validate } from '../../middleware/validate.js';
import { validation, Permissions } from '@crabac/shared';
import { requirePermission, requireMember } from '../rbac/rbac.middleware.js';
import * as forumsService from './forums.service.js';

export const forumsRoutes = Router();
forumsRoutes.use(authenticate);

// List threads in a forum channel
forumsRoutes.get(
  '/:spaceId/channels/:channelId/threads',
  requireMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { before, limit, sort } = req.query as any;
      const threads = await forumsService.listThreads(req.params.channelId, {
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

// Create a new thread
forumsRoutes.post(
  '/:spaceId/channels/:channelId/threads',
  requirePermission(Permissions.CREATE_THREADS),
  validate(validation.createThreadSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const thread = await forumsService.createThread(
        req.params.channelId,
        req.user!.userId,
        req.body,
      );
      res.status(201).json(thread);
    } catch (err) {
      next(err);
    }
  },
);

// Get a single thread
forumsRoutes.get(
  '/:spaceId/channels/:channelId/threads/:threadId',
  requireMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const thread = await forumsService.getThread(req.params.threadId);
      res.json(thread);
    } catch (err) {
      next(err);
    }
  },
);

// Update a thread (moderators)
forumsRoutes.patch(
  '/:spaceId/channels/:channelId/threads/:threadId',
  requirePermission(Permissions.MANAGE_THREADS),
  validate(validation.updateThreadSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const thread = await forumsService.updateThread(req.params.threadId, req.body);
      res.json(thread);
    } catch (err) {
      next(err);
    }
  },
);

// Delete a thread
forumsRoutes.delete(
  '/:spaceId/channels/:channelId/threads/:threadId',
  requirePermission(Permissions.MANAGE_THREADS),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await forumsService.deleteThread(req.params.threadId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

// List posts in a thread
forumsRoutes.get(
  '/:spaceId/channels/:channelId/threads/:threadId/posts',
  requireMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { before, limit } = req.query as any;
      const posts = await forumsService.listThreadPosts(req.params.threadId, {
        before,
        limit: Math.min(parseInt(limit) || 50, 100),
      });
      res.json(posts);
    } catch (err) {
      next(err);
    }
  },
);

// Create a post in a thread
forumsRoutes.post(
  '/:spaceId/channels/:channelId/threads/:threadId/posts',
  requirePermission(Permissions.SEND_MESSAGES),
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
