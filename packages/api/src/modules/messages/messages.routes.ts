import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate } from '../auth/auth.middleware.js';
import { validate } from '../../middleware/validate.js';
import { validation, Permissions, hasPermission } from '@crabac/shared';
import { computeChannelPermissions } from '../rbac/rbac.service.js';
import { getChannelSpaceId } from '../channels/channels.service.js';
import * as spacesService from '../spaces/spaces.service.js';
import { db } from '../../database/connection.js';
import * as messagesService from './messages.service.js';
import { parseGpxFile } from './gpx.service.js';
import { ForbiddenError, BadRequestError } from '../../lib/errors.js';
import { config } from '../../config.js';

// Configure multer for file attachments
const attachmentStorage = multer.diskStorage({
  destination: config.uploadsDir,
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

const BLOCKED_EXTENSIONS = new Set(['.html', '.htm', '.svg', '.xml', '.xhtml', '.js', '.mjs', '.cjs', '.php', '.asp', '.aspx', '.jsp', '.sh', '.bat', '.cmd', '.ps1', '.exe', '.dll', '.msi']);

const attachmentUpload = multer({
  storage: attachmentStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) {
      cb(new Error('File type not allowed'));
    } else {
      cb(null, true);
    }
  },
});

export const messagesRoutes = Router();

messagesRoutes.use(authenticate);

/** Middleware to resolve channel → space and verify membership (including portal access) */
async function requireChannelAccess(req: Request, _res: Response, next: NextFunction) {
  try {
    const channelId = req.params.channelId;
    const spaceId = await getChannelSpaceId(channelId);
    const userId = req.user!.userId;
    let isMember = await spacesService.isMember(spaceId, userId);

    if (!isMember) {
      // Check if user has portal access: channel is portaled into a space the user IS in
      const portal = await db('portals')
        .where('channel_id', channelId)
        .first();
      if (portal) {
        isMember = await spacesService.isMember(String(portal.target_space_id), userId);
      }
      if (!isMember) return next(new ForbiddenError('You are not a member of this space'));
      // For portal users, store that they're accessing via portal
      (req as any).isPortalAccess = true;
      (req as any).portalTargetSpaceId = String(portal.target_space_id);
    }

    (req as any).spaceId = spaceId;
    // Compute channel-level permissions for the user
    const chanPerms = await computeChannelPermissions(spaceId, channelId, userId);
    (req as any).channelPerms = chanPerms;
    next();
  } catch (err) {
    next(err);
  }
}

// Get messages (cursor pagination)
messagesRoutes.get(
  '/:channelId/messages',
  requireChannelAccess,
  validate(validation.messagesQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { before, limit } = req.query as any;
      const messages = await messagesService.listMessages(req.params.channelId, { before, limit });
      res.json(messages);
    } catch (err) {
      next(err);
    }
  },
);

// Send message
messagesRoutes.post(
  '/:channelId/messages',
  requireChannelAccess,
  validate(validation.createMessageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const perms = (req as any).channelPerms as bigint;
      if (!hasPermission(perms, Permissions.SEND_MESSAGES)) {
        return next(new ForbiddenError('You do not have permission to send messages'));
      }
      const message = await messagesService.createMessage(req.params.channelId, req.user!.userId, req.body);
      res.status(201).json(message);
    } catch (err) {
      next(err);
    }
  },
);

// Edit message
messagesRoutes.patch(
  '/:channelId/messages/:messageId',
  requireChannelAccess,
  validate(validation.updateMessageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const message = await messagesService.updateMessage(
        req.params.channelId,
        req.params.messageId,
        req.user!.userId,
        req.body.content,
      );
      res.json(message);
    } catch (err) {
      next(err);
    }
  },
);

// Delete message
messagesRoutes.delete(
  '/:channelId/messages/:messageId',
  requireChannelAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const perms = (req as any).channelPerms as bigint;
      const canManage = hasPermission(perms, Permissions.MANAGE_MESSAGES);
      await messagesService.deleteMessage(
        req.params.channelId,
        req.params.messageId,
        req.user!.userId,
        canManage,
      );
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

// ─── Reactions ───

// Add reaction
messagesRoutes.put(
  '/:channelId/messages/:messageId/reactions/:emoji',
  requireChannelAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const perms = (req as any).channelPerms as bigint;
      if (!hasPermission(perms, Permissions.ADD_REACTIONS)) {
        return next(new ForbiddenError('You do not have permission to add reactions'));
      }
      const emoji = decodeURIComponent(req.params.emoji);
      const reactions = await messagesService.addReaction(
        req.params.channelId,
        req.params.messageId,
        req.user!.userId,
        emoji,
      );
      res.json(reactions);
    } catch (err) {
      next(err);
    }
  },
);

// Remove reaction
messagesRoutes.delete(
  '/:channelId/messages/:messageId/reactions/:emoji',
  requireChannelAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const emoji = decodeURIComponent(req.params.emoji);
      const reactions = await messagesService.removeReaction(
        req.params.channelId,
        req.params.messageId,
        req.user!.userId,
        emoji,
      );
      res.json(reactions);
    } catch (err) {
      next(err);
    }
  },
);

// ─── Pinning ───

// Get pinned messages
messagesRoutes.get(
  '/:channelId/pins',
  requireChannelAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const messages = await messagesService.getPinnedMessages(req.params.channelId);
      res.json(messages);
    } catch (err) {
      next(err);
    }
  },
);

// Pin message
messagesRoutes.put(
  '/:channelId/messages/:messageId/pin',
  requireChannelAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const perms = (req as any).channelPerms as bigint;
      if (!hasPermission(perms, Permissions.MANAGE_MESSAGES)) {
        return next(new ForbiddenError('You do not have permission to pin messages'));
      }
      const message = await messagesService.pinMessage(req.params.channelId, req.params.messageId);
      res.json(message);
    } catch (err) {
      next(err);
    }
  },
);

// Unpin message
messagesRoutes.delete(
  '/:channelId/messages/:messageId/pin',
  requireChannelAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const perms = (req as any).channelPerms as bigint;
      if (!hasPermission(perms, Permissions.MANAGE_MESSAGES)) {
        return next(new ForbiddenError('You do not have permission to unpin messages'));
      }
      const message = await messagesService.unpinMessage(req.params.channelId, req.params.messageId);
      res.json(message);
    } catch (err) {
      next(err);
    }
  },
);

// ─── Threads ───

// Get thread (parent + replies)
messagesRoutes.get(
  '/:channelId/messages/:messageId/thread',
  requireChannelAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { before } = req.query as any;
      const thread = await messagesService.getThreadMessages(
        req.params.channelId,
        req.params.messageId,
        { before, limit: 50 },
      );
      res.json(thread);
    } catch (err) {
      next(err);
    }
  },
);

// ─── File Upload ───

// Send message with file attachments
messagesRoutes.post(
  '/:channelId/messages/upload',
  requireChannelAccess,
  attachmentUpload.array('files', 5),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const perms = (req as any).channelPerms as bigint;
      if (!hasPermission(perms, Permissions.SEND_MESSAGES)) {
        return next(new ForbiddenError('You do not have permission to send messages'));
      }
      if (!hasPermission(perms, Permissions.ATTACH_FILES)) {
        return next(new ForbiddenError('You do not have permission to attach files'));
      }

      const content = req.body.content || '';
      if (!content && (!req.files || (req.files as Express.Multer.File[]).length === 0)) {
        return next(new BadRequestError('Message must have content or at least one file'));
      }

      const channelId = req.params.channelId;

      // Skip the socket event during creation — we'll emit after attachments are added
      const message = await messagesService.createMessage(
        channelId,
        req.user!.userId,
        { content, replyToId: req.body.replyToId },
        { skipEvent: true },
      );

      const files = (req.files as Express.Multer.File[]) || [];
      for (const file of files) {
        let metadata: Record<string, any> | null = null;

        // Parse GPX files to extract track metadata + GeoJSON
        if (file.originalname.toLowerCase().endsWith('.gpx')) {
          const gpx = await parseGpxFile(file.path);
          if (gpx) metadata = { gpx };
        }

        await messagesService.createAttachment(
          message.id,
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

      // Now emit with the full message (including attachments) so all clients see it
      await messagesService.emitMessageCreated(channelId, message.id);

      // Re-fetch message with attachments for the REST response
      const messages = await messagesService.listMessages(channelId, { limit: 1 });
      const fullMessage = messages.find((m: any) => m.id === message.id) || message;

      res.status(201).json(fullMessage);
    } catch (err) {
      next(err);
    }
  },
);
