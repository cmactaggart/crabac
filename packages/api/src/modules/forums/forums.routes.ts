import { Router, type Request, type Response, type NextFunction } from 'express';
import path from 'path';
import { authenticate } from '../auth/auth.middleware.js';
import { validate } from '../../middleware/validate.js';
import { handleMulterUpload, VIDEO_EXTENSIONS } from '../../middleware/upload.js';
import { validation, Permissions, hasPermission } from '@crabac/shared';
import { requirePermission, requireMember } from '../rbac/rbac.middleware.js';
import { computeChannelPermissions } from '../rbac/rbac.service.js';
import * as forumsService from './forums.service.js';
import * as messagesService from '../messages/messages.service.js';
import { parseGpxFile } from '../messages/gpx.service.js';
import { BadRequestError, ForbiddenError } from '../../lib/errors.js';

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
      const { thread, openingPostId } = await forumsService.createThread(
        req.params.channelId,
        req.user!.userId,
        req.body,
      );

      // Attach collection items if provided
      const collectionItems = req.body.collectionItems;
      if (Array.isArray(collectionItems) && collectionItems.length > 0) {
        await forumsService.attachFromCollection(openingPostId, req.user!.userId, collectionItems);
      }

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

      // Attach collection items if provided
      const collectionItems = req.body.collectionItems;
      if (Array.isArray(collectionItems) && collectionItems.length > 0) {
        await forumsService.attachFromCollection(post.id, req.user!.userId, collectionItems);
        // Re-fetch to include attachments
        const posts = await forumsService.listThreadPosts(req.params.threadId, { limit: 50 });
        const fullPost = posts.find((p: any) => p.id === post.id) || post;
        return res.status(201).json(fullPost);
      }

      res.status(201).json(post);
    } catch (err) {
      next(err);
    }
  },
);

// ─── Upload Routes ───

// Create a new thread with file attachments
forumsRoutes.post(
  '/:spaceId/channels/:channelId/threads/upload',
  requireMember,
  handleMulterUpload,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const perms = await computeChannelPermissions(req.params.spaceId, req.params.channelId, req.user!.userId);
      if (!hasPermission(perms, Permissions.CREATE_THREADS)) {
        return next(new ForbiddenError('You do not have permission to create threads'));
      }

      const uploadedFiles = (req.files as Express.Multer.File[]) || [];

      if (uploadedFiles.length > 0 && !hasPermission(perms, Permissions.ATTACH_FILES)) {
        return next(new ForbiddenError('You do not have permission to attach files'));
      }

      const title = (req.body.title || '').trim();
      const content = (req.body.content || '').trim();
      if (!title || title.length > 200) {
        return next(new BadRequestError('Title is required and must be under 200 characters'));
      }
      if (!content || content.length > 4000) {
        return next(new BadRequestError('Content is required and must be under 4000 characters'));
      }
      for (const file of uploadedFiles) {
        const ext = path.extname(file.originalname).toLowerCase();
        const isVideo = file.mimetype.startsWith('video/') || VIDEO_EXTENSIONS.has(ext);
        if (!isVideo && file.size > 10 * 1024 * 1024) {
          return next(new BadRequestError(`File "${file.originalname}" exceeds 10MB limit for non-video files`));
        }
      }

      const { thread, openingPostId } = await forumsService.createThread(
        req.params.channelId,
        req.user!.userId,
        { title, content },
      );

      for (const file of uploadedFiles) {
        let metadata: Record<string, any> | null = null;
        if (file.originalname.toLowerCase().endsWith('.gpx')) {
          const gpx = await parseGpxFile(file.path);
          if (gpx) metadata = { gpx };
        }
        await messagesService.createAttachment(
          openingPostId,
          {
            filename: file.filename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            url: `/uploads/${file.filename}`,
          },
          metadata,
        );
      }

      // Attach collection items if provided
      let collectionItems = req.body.collectionItems;
      if (typeof collectionItems === 'string') {
        try { collectionItems = JSON.parse(collectionItems); } catch { collectionItems = null; }
      }
      if (Array.isArray(collectionItems) && collectionItems.length > 0) {
        await forumsService.attachFromCollection(openingPostId, req.user!.userId, collectionItems);
      }

      // Re-fetch posts to include attachments in response
      const posts = await forumsService.listThreadPosts(String(thread.id), { limit: 1 });
      res.status(201).json({ ...thread, openingPostId, firstPost: posts[0] || null });
    } catch (err) {
      next(err);
    }
  },
);

// Create a post in a thread with file attachments
forumsRoutes.post(
  '/:spaceId/channels/:channelId/threads/:threadId/posts/upload',
  requireMember,
  handleMulterUpload,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const perms = await computeChannelPermissions(req.params.spaceId, req.params.channelId, req.user!.userId);
      if (!hasPermission(perms, Permissions.SEND_MESSAGES)) {
        return next(new ForbiddenError('You do not have permission to send messages'));
      }

      const content = (req.body.content || '').trim();
      const uploadedFiles = (req.files as Express.Multer.File[]) || [];

      if (uploadedFiles.length > 0 && !hasPermission(perms, Permissions.ATTACH_FILES)) {
        return next(new ForbiddenError('You do not have permission to attach files'));
      }

      let parsedCollectionItems = req.body.collectionItems;
      if (typeof parsedCollectionItems === 'string') {
        try { parsedCollectionItems = JSON.parse(parsedCollectionItems); } catch { parsedCollectionItems = null; }
      }
      const hasCollectionItems = Array.isArray(parsedCollectionItems) && parsedCollectionItems.length > 0;

      if (!content && uploadedFiles.length === 0 && !hasCollectionItems) {
        return next(new BadRequestError('Post must have content or at least one attachment'));
      }
      if (content.length > 4000) {
        return next(new BadRequestError('Content must be under 4000 characters'));
      }

      for (const file of uploadedFiles) {
        const ext = path.extname(file.originalname).toLowerCase();
        const isVideo = file.mimetype.startsWith('video/') || VIDEO_EXTENSIONS.has(ext);
        if (!isVideo && file.size > 10 * 1024 * 1024) {
          return next(new BadRequestError(`File "${file.originalname}" exceeds 10MB limit for non-video files`));
        }
      }

      const post = await forumsService.createThreadPost(
        req.params.threadId,
        req.user!.userId,
        { content, replyToId: req.body.replyToId },
      );

      for (const file of uploadedFiles) {
        let metadata: Record<string, any> | null = null;
        if (file.originalname.toLowerCase().endsWith('.gpx')) {
          const gpx = await parseGpxFile(file.path);
          if (gpx) metadata = { gpx };
        }
        await messagesService.createAttachment(
          post.id,
          {
            filename: file.filename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            url: `/uploads/${file.filename}`,
          },
          metadata,
        );
      }

      // Attach collection items if provided
      if (hasCollectionItems) {
        await forumsService.attachFromCollection(post.id, req.user!.userId, parsedCollectionItems);
      }

      // Re-fetch the post with attachments
      const posts = await forumsService.listThreadPosts(req.params.threadId, { limit: 50 });
      const fullPost = posts.find((p: any) => p.id === post.id) || post;
      res.status(201).json(fullPost);
    } catch (err) {
      next(err);
    }
  },
);
