import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate } from '../auth/auth.middleware.js';
import { validate } from '../../middleware/validate.js';
import { validation } from '@crabac/shared';
import { config } from '../../config.js';
import { requirePermission, requireMember, requireMemberOrPublicAccess } from '../rbac/rbac.middleware.js';
import { Permissions } from '@crabac/shared';
import { computePermissions } from '../rbac/rbac.service.js';
import { hasPermission } from '@crabac/shared';
import { db } from '../../database/connection.js';
import * as spacesService from './spaces.service.js';
import * as messagesService from '../messages/messages.service.js';
import * as spaceSettingsService from './space-settings.service.js';
import * as spaceAdminSettingsService from './space-admin-settings.service.js';

export const spacesRoutes = Router();

// Configure multer for space icon uploads
const storage = multer.diskStorage({
  destination: config.uploadsDir,
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

spacesRoutes.use(authenticate);

// Create space
spacesRoutes.post(
  '/',
  validate(validation.createSpaceSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const space = await spacesService.createSpace(req.user!.userId, req.body);
      res.status(201).json(space);
    } catch (err) {
      next(err);
    }
  },
);

// List user's spaces
spacesRoutes.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const spaces = await spacesService.listUserSpaces(req.user!.userId);
    res.json(spaces);
  } catch (err) {
    next(err);
  }
});

// Join space via invite code (convenience endpoint - no spaceId needed)
spacesRoutes.post(
  '/join',
  validate(validation.joinSpaceSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const space = await spacesService.joinViaInvite(req.user!.userId, req.body.code);
      res.json(space);
    } catch (err) {
      next(err);
    }
  },
);

// Join space via invite code (with spaceId in URL)
spacesRoutes.post(
  '/:spaceId/join',
  validate(validation.joinSpaceSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const space = await spacesService.joinViaInvite(req.user!.userId, req.body.code);
      res.json(space);
    } catch (err) {
      next(err);
    }
  },
);

// Get space details (member or public access)
spacesRoutes.get(
  '/:spaceId',
  requireMemberOrPublicAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const space = await spacesService.getSpace(req.params.spaceId);
      res.json(space);
    } catch (err) {
      next(err);
    }
  },
);

// Update space
spacesRoutes.patch(
  '/:spaceId',
  requirePermission(Permissions.MANAGE_SPACE),
  validate(validation.updateSpaceSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const space = await spacesService.updateSpace(req.params.spaceId, req.body);
      res.json(space);
    } catch (err) {
      next(err);
    }
  },
);

// Upload space icon
spacesRoutes.post(
  '/:spaceId/icon',
  requirePermission(Permissions.MANAGE_SPACE),
  upload.single('icon'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const iconUrl = `/uploads/${req.file.filename}`;
      const space = await spacesService.updateSpace(req.params.spaceId, { iconUrl });
      res.json(space);
    } catch (err) {
      next(err);
    }
  },
);

// Delete space (owner only)
spacesRoutes.delete(
  '/:spaceId',
  requireMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await spacesService.deleteSpace(req.params.spaceId, req.user!.userId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

// List members (member or public access)
spacesRoutes.get(
  '/:spaceId/members',
  requireMemberOrPublicAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const members = await spacesService.getMembers(req.params.spaceId);
      res.json(members);
    } catch (err) {
      next(err);
    }
  },
);

// Kick member
spacesRoutes.delete(
  '/:spaceId/members/:userId',
  requirePermission(Permissions.MANAGE_MEMBERS),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await spacesService.kickMember(req.params.spaceId, req.params.userId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

// Leave space
spacesRoutes.post(
  '/:spaceId/leave',
  requireMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await spacesService.leaveSpace(req.params.spaceId, req.user!.userId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

// Search messages in space
spacesRoutes.get(
  '/:spaceId/search',
  requireMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { q, channelId, before, limit } = req.query as any;
      if (!q || typeof q !== 'string' || q.trim().length === 0) {
        return res.json([]);
      }
      const results = await messagesService.searchMessages(req.params.spaceId, q.trim(), {
        channelId,
        before,
        limit: Math.min(parseInt(limit) || 25, 50),
      });
      res.json(results);
    } catch (err) {
      next(err);
    }
  },
);

// Get a member's roles in a space
spacesRoutes.get(
  '/:spaceId/members/:userId/roles',
  requireMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userPerms = await computePermissions(req.params.spaceId, req.user!.userId);
      if (!hasPermission(userPerms, Permissions.VIEW_ROLES)) {
        res.status(403).json({ error: 'Missing VIEW_ROLES permission' });
        return;
      }

      const roles = await db('member_roles')
        .join('roles', 'member_roles.role_id', 'roles.id')
        .where({
          'member_roles.space_id': req.params.spaceId,
          'member_roles.user_id': req.params.userId,
        })
        .select('roles.id', 'roles.name', 'roles.color', 'roles.position')
        .orderBy('roles.position', 'asc');

      res.json({ roles: roles.map((r: any) => ({ ...r, id: String(r.id) })) });
    } catch (err) {
      next(err);
    }
  },
);

// Get my space notification settings
spacesRoutes.get(
  '/:spaceId/settings/me',
  requireMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await spaceSettingsService.getSettings(req.params.spaceId, req.user!.userId);
      res.json(settings);
    } catch (err) {
      next(err);
    }
  },
);

// Update my space notification settings
spacesRoutes.put(
  '/:spaceId/settings/me',
  requireMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await spaceSettingsService.updateSettings(
        req.params.spaceId,
        req.user!.userId,
        req.body,
      );
      res.json(settings);
    } catch (err) {
      next(err);
    }
  },
);

// Get space admin settings (public boards, etc.)
spacesRoutes.get(
  '/:spaceId/admin-settings',
  requirePermission(Permissions.MANAGE_SPACE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await spaceAdminSettingsService.getSpaceAdminSettings(req.params.spaceId);
      res.json(settings);
    } catch (err) {
      next(err);
    }
  },
);

// Update space admin settings
spacesRoutes.put(
  '/:spaceId/admin-settings',
  requirePermission(Permissions.MANAGE_SPACE),
  validate(validation.updateSpaceAdminSettingsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await spaceAdminSettingsService.updateSpaceAdminSettings(
        req.params.spaceId,
        req.body,
      );
      res.json(settings);
    } catch (err) {
      next(err);
    }
  },
);

// Join a public space (auth required, no membership required)
spacesRoutes.post(
  '/:spaceId/join-public',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const space = await spacesService.joinPublicSpace(req.user!.userId, req.params.spaceId);
      res.json(space);
    } catch (err) {
      next(err);
    }
  },
);

// Get space tags (member or public access)
spacesRoutes.get(
  '/:spaceId/tags',
  requireMemberOrPublicAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tags = await spacesService.getSpaceTags(req.params.spaceId);
      res.json(tags);
    } catch (err) {
      next(err);
    }
  },
);

// Update space tags
spacesRoutes.put(
  '/:spaceId/tags',
  requirePermission(Permissions.MANAGE_SPACE),
  validate(validation.updateSpaceTagsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tags = await spacesService.updateSpaceTags(req.params.spaceId, req.body.tags);
      res.json(tags);
    } catch (err) {
      next(err);
    }
  },
);
