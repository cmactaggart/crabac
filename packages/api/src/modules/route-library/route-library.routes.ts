import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate } from '../auth/auth.middleware.js';
import { Permissions, hasPermission } from '@crabac/shared';
import { computeChannelPermissions } from '../rbac/rbac.service.js';
import { getChannelSpaceId } from '../channels/channels.service.js';
import * as spacesService from '../spaces/spaces.service.js';
import { db } from '../../database/connection.js';
import * as routeLibraryService from './route-library.service.js';
import { parseGpxFile } from '../messages/gpx.service.js';
import { ForbiddenError, BadRequestError } from '../../lib/errors.js';
import { config } from '../../config.js';
import { validate } from '../../middleware/validate.js';
import { validation } from '@crabac/shared';

// Configure multer for GPX uploads
const routeStorage = multer.diskStorage({
  destination: config.uploadsDir,
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

const routeUpload = multer({
  storage: routeStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max for GPX
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.gpx') {
      cb(new Error('Only .gpx files are allowed'));
    } else {
      cb(null, true);
    }
  },
});

function handleRouteUpload(req: Request, res: Response, next: NextFunction) {
  routeUpload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new BadRequestError('File too large (max 50MB)'));
      }
      return next(new BadRequestError(err.message || 'Upload failed'));
    }
    next();
  });
}

export const routeLibraryRoutes = Router();

routeLibraryRoutes.use(authenticate);

/** Middleware to resolve channel → space, verify membership, and check channel type */
async function requireRouteLibraryAccess(req: Request, _res: Response, next: NextFunction) {
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

    // Verify channel is route_library
    const channel = await db('channels').where('id', channelId).first();
    if (!channel || channel.type !== 'route_library') {
      return next(new BadRequestError('Channel is not a route library'));
    }

    (req as any).spaceId = spaceId;
    const chanPerms = await computeChannelPermissions(spaceId, channelId, userId);
    (req as any).channelPerms = chanPerms;
    next();
  } catch (err) {
    next(err);
  }
}

// List route items (paginated, filterable, sortable)
routeLibraryRoutes.get(
  '/:channelId/routes',
  requireRouteLibraryAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = validation.routesQuerySchema.parse(req.query);
      const items = await routeLibraryService.listRouteItems(req.params.channelId, {
        ...parsed,
        userId: req.user!.userId,
      });
      res.json(items);
    } catch (err) {
      next(err);
    }
  },
);

// Upload GPX + create route item
routeLibraryRoutes.post(
  '/:channelId/routes/upload',
  requireRouteLibraryAccess,
  handleRouteUpload,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const perms = (req as any).channelPerms as bigint;
      if (!hasPermission(perms, Permissions.SEND_MESSAGES)) {
        return next(new ForbiddenError('You do not have permission to post in this route library'));
      }
      if (!hasPermission(perms, Permissions.ATTACH_FILES)) {
        return next(new ForbiddenError('You do not have permission to upload files'));
      }

      const file = req.file;
      if (!file) {
        return next(new BadRequestError('A GPX file is required'));
      }

      // Parse GPX
      const gpxMeta = await parseGpxFile(file.path);
      if (!gpxMeta) {
        return next(new BadRequestError('Failed to parse GPX file. Ensure it contains valid track data.'));
      }

      const data = {
        name: req.body.name || gpxMeta.trackName || file.originalname.replace(/\.gpx$/i, ''),
        description: req.body.description,
        categoryId: req.body.categoryId,
        isPublic: req.body.isPublic === 'true' || req.body.isPublic === true,
        activityType: req.body.activityType || null,
      };

      const result = await routeLibraryService.createRouteItem(
        req.params.channelId,
        req.user!.userId,
        data,
        gpxMeta,
        {
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          url: `/uploads/${file.filename}`,
        },
      );

      await routeLibraryService.emitRouteItemCreated(req.params.channelId, result.id);
      const fullItem = await routeLibraryService.getRouteItem(result.id, req.user!.userId);
      res.status(201).json(fullItem);
    } catch (err) {
      next(err);
    }
  },
);

// Create route from existing GPX attachment
routeLibraryRoutes.post(
  '/:channelId/routes/from-attachment',
  requireRouteLibraryAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const perms = (req as any).channelPerms as bigint;
      if (!hasPermission(perms, Permissions.SEND_MESSAGES)) {
        return next(new ForbiddenError('You do not have permission to post in this route library'));
      }
      if (!hasPermission(perms, Permissions.ATTACH_FILES)) {
        return next(new ForbiddenError('You do not have permission to upload files'));
      }

      const parsed = validation.createRouteFromAttachmentSchema.parse(req.body);
      const result = await routeLibraryService.createRouteFromExistingFile(
        req.params.channelId,
        req.user!.userId,
        {
          name: parsed.name,
          description: parsed.description,
          categoryId: parsed.categoryId,
          isPublic: parsed.isPublic,
          activityType: parsed.activityType,
        },
        parsed.attachmentUrl,
      );

      await routeLibraryService.emitRouteItemCreated(req.params.channelId, result.id);
      const fullItem = await routeLibraryService.getRouteItem(result.id, req.user!.userId);
      res.status(201).json(fullItem);
    } catch (err) {
      next(err);
    }
  },
);

// Delete route item
routeLibraryRoutes.delete(
  '/:channelId/routes/:routeId',
  requireRouteLibraryAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const perms = (req as any).channelPerms as bigint;
      const canManage = hasPermission(perms, Permissions.MANAGE_MESSAGES);
      await routeLibraryService.deleteRouteItem(req.params.routeId, req.user!.userId, canManage);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

// Star a route
routeLibraryRoutes.post(
  '/:channelId/routes/:routeId/star',
  requireRouteLibraryAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await routeLibraryService.starRoute(req.user!.userId, req.params.routeId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

// Unstar a route
routeLibraryRoutes.delete(
  '/:channelId/routes/:routeId/star',
  requireRouteLibraryAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await routeLibraryService.unstarRoute(req.user!.userId, req.params.routeId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);
