import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { validate } from '../../middleware/validate.js';
import { validation, Permissions } from '@crabac/shared';
import { requirePermission, requireMember } from '../rbac/rbac.middleware.js';
import * as blogService from './blog.service.js';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { config } from '../../config.js';

export const blogRoutes = Router();
blogRoutes.use(authenticate);

const upload = multer({
  storage: multer.diskStorage({
    destination: config.uploadsDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, 'blog-' + crypto.randomBytes(16).toString('hex') + ext);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  },
});

// List posts (member - sees published + own drafts)
blogRoutes.get(
  '/:spaceId/blog/posts',
  requireMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = validation.blogPostsQuerySchema.parse(req.query);
      const posts = await blogService.listPosts(req.params.spaceId, req.user!.userId, parsed);
      res.json(posts);
    } catch (err) {
      next(err);
    }
  },
);

// Get single post
blogRoutes.get(
  '/:spaceId/blog/posts/:id',
  requireMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const post = await blogService.getPost(req.params.id);
      res.json(post);
    } catch (err) {
      next(err);
    }
  },
);

// Create post
blogRoutes.post(
  '/:spaceId/blog/posts',
  requirePermission(Permissions.MANAGE_BLOG),
  validate(validation.createBlogPostSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const post = await blogService.createPost(req.params.spaceId, req.user!.userId, req.body);
      res.status(201).json(post);
    } catch (err) {
      next(err);
    }
  },
);

// Update post (MANAGE_BLOG or author)
blogRoutes.patch(
  '/:spaceId/blog/posts/:id',
  requireMember,
  validate(validation.updateBlogPostSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const post = await blogService.getPost(req.params.id);
      // Allow author or MANAGE_BLOG permission holders
      if (post.authorId !== req.user!.userId) {
        // Will throw if no permission
        await new Promise<void>((resolve, reject) => {
          requirePermission(Permissions.MANAGE_BLOG)(req, res, (err: any) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
      const updated = await blogService.updatePost(req.params.id, req.body);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// Delete post
blogRoutes.delete(
  '/:spaceId/blog/posts/:id',
  requirePermission(Permissions.MANAGE_BLOG),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await blogService.deletePost(req.params.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

// Upload image
blogRoutes.post(
  '/:spaceId/blog/upload-image',
  requirePermission(Permissions.MANAGE_BLOG),
  upload.single('image'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: { message: 'No image uploaded' } });
      }
      const url = `/uploads/${req.file.filename}`;
      res.json({ url });
    } catch (err) {
      next(err);
    }
  },
);
