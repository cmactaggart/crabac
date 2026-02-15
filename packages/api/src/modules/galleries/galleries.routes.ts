import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate } from '../auth/auth.middleware.js';
import { Permissions, hasPermission } from '@crabac/shared';
import { computeChannelPermissions } from '../rbac/rbac.service.js';
import { getChannelSpaceId } from '../channels/channels.service.js';
import * as spacesService from '../spaces/spaces.service.js';
import { db } from '../../database/connection.js';
import * as galleriesService from './galleries.service.js';
import { ForbiddenError, BadRequestError } from '../../lib/errors.js';
import { config } from '../../config.js';

// Configure multer for gallery uploads
const galleryStorage = multer.diskStorage({
  destination: config.uploadsDir,
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

const BLOCKED_EXTENSIONS = new Set(['.html', '.htm', '.svg', '.xml', '.xhtml', '.js', '.mjs', '.cjs', '.php', '.asp', '.aspx', '.jsp', '.sh', '.bat', '.cmd', '.ps1', '.exe', '.dll', '.msi']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.ogg', '.ogv', '.avi', '.mkv']);

const galleryUpload = multer({
  storage: galleryStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) {
      cb(new Error('File type not allowed'));
    } else {
      cb(null, true);
    }
  },
});

function handleGalleryUpload(req: Request, res: Response, next: NextFunction) {
  galleryUpload.array('files', 20)(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new BadRequestError('File too large (max 100MB for video, 10MB for other files)'));
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return next(new BadRequestError('Too many files (max 20)'));
      }
      return next(new BadRequestError(err.message || 'Upload failed'));
    }
    next();
  });
}

export const galleriesRoutes = Router();

galleriesRoutes.use(authenticate);

/** Middleware to resolve channel → space, verify membership, and check channel type */
async function requireGalleryAccess(req: Request, _res: Response, next: NextFunction) {
  try {
    const channelId = req.params.channelId;
    const spaceId = await getChannelSpaceId(channelId);
    const userId = req.user!.userId;
    let isMember = await spacesService.isMember(spaceId, userId);

    if (!isMember) {
      const portal = await db('portals').where('channel_id', channelId).first();
      if (portal) {
        isMember = await spacesService.isMember(String(portal.target_space_id), userId);
      }
      if (!isMember) return next(new ForbiddenError('You are not a member of this space'));
    }

    // Verify channel is media_gallery
    const channel = await db('channels').where('id', channelId).first();
    if (!channel || channel.type !== 'media_gallery') {
      return next(new BadRequestError('Channel is not a media gallery'));
    }

    (req as any).spaceId = spaceId;
    const chanPerms = await computeChannelPermissions(spaceId, channelId, userId);
    (req as any).channelPerms = chanPerms;
    next();
  } catch (err) {
    next(err);
  }
}

// List gallery items (paginated)
galleriesRoutes.get(
  '/:channelId/gallery',
  requireGalleryAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { before, limit } = req.query as any;
      const items = await galleriesService.listGalleryItems(req.params.channelId, {
        before,
        limit: Math.min(parseInt(limit) || 30, 100),
      });
      res.json(items);
    } catch (err) {
      next(err);
    }
  },
);

// Upload new gallery item (create item + attachments)
galleriesRoutes.post(
  '/:channelId/gallery/upload',
  requireGalleryAccess,
  handleGalleryUpload,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const perms = (req as any).channelPerms as bigint;
      if (!hasPermission(perms, Permissions.SEND_MESSAGES)) {
        return next(new ForbiddenError('You do not have permission to post in this gallery'));
      }
      if (!hasPermission(perms, Permissions.ATTACH_FILES)) {
        return next(new ForbiddenError('You do not have permission to upload files'));
      }

      const uploadedFiles = (req.files as Express.Multer.File[]) || [];
      if (uploadedFiles.length === 0) {
        return next(new BadRequestError('At least one file is required'));
      }

      // Enforce 10MB limit for non-video files
      for (const file of uploadedFiles) {
        const ext = path.extname(file.originalname).toLowerCase();
        const isVideo = file.mimetype.startsWith('video/') || VIDEO_EXTENSIONS.has(ext);
        if (!isVideo && file.size > 10 * 1024 * 1024) {
          return next(new BadRequestError(`File "${file.originalname}" exceeds 10MB limit for non-video files`));
        }
      }

      const caption = req.body.caption || null;
      const item = await galleriesService.createGalleryItem(
        req.params.channelId,
        req.user!.userId,
        caption,
      );

      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        await galleriesService.createGalleryAttachment(item.id, {
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          url: `/uploads/${file.filename}`,
        }, i);
      }

      await galleriesService.emitGalleryItemCreated(req.params.channelId, item.id);
      const fullItem = await galleriesService.getGalleryItem(item.id);
      res.status(201).json(fullItem);
    } catch (err) {
      next(err);
    }
  },
);

// Add attachments to existing gallery item (for batched uploads)
galleriesRoutes.post(
  '/:channelId/gallery/:itemId/attachments',
  requireGalleryAccess,
  handleGalleryUpload,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const perms = (req as any).channelPerms as bigint;
      if (!hasPermission(perms, Permissions.ATTACH_FILES)) {
        return next(new ForbiddenError('You do not have permission to upload files'));
      }

      const uploadedFiles = (req.files as Express.Multer.File[]) || [];
      if (uploadedFiles.length === 0) {
        return next(new BadRequestError('At least one file is required'));
      }

      // Get current max position
      const maxPos = await db('gallery_item_attachments')
        .where('gallery_item_id', req.params.itemId)
        .max('position as max')
        .first();
      let position = (maxPos?.max ?? -1) + 1;

      for (const file of uploadedFiles) {
        const ext = path.extname(file.originalname).toLowerCase();
        const isVideo = file.mimetype.startsWith('video/') || VIDEO_EXTENSIONS.has(ext);
        if (!isVideo && file.size > 10 * 1024 * 1024) {
          return next(new BadRequestError(`File "${file.originalname}" exceeds 10MB limit`));
        }

        await galleriesService.createGalleryAttachment(req.params.itemId, {
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          url: `/uploads/${file.filename}`,
        }, position++);
      }

      const fullItem = await galleriesService.getGalleryItem(req.params.itemId);
      res.json(fullItem);
    } catch (err) {
      next(err);
    }
  },
);

// Delete gallery item
galleriesRoutes.delete(
  '/:channelId/gallery/:itemId',
  requireGalleryAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const perms = (req as any).channelPerms as bigint;
      const canManage = hasPermission(perms, Permissions.MANAGE_MESSAGES);
      await galleriesService.deleteGalleryItem(req.params.itemId, req.user!.userId, canManage);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);
