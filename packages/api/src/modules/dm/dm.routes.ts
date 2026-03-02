import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate } from '../auth/auth.middleware.js';
import { validate } from '../../middleware/validate.js';
import { validation } from '@crabac/shared';
import * as dmService from './dm.service.js';
import * as blocksService from '../users/blocks.service.js';
import { config } from '../../config.js';
import { ForbiddenError, BadRequestError } from '../../lib/errors.js';
import { parseGpxFile } from '../messages/gpx.service.js';

// Configure multer for DM file attachments (same config as messages)
const attachmentStorage = multer.diskStorage({
  destination: config.uploadsDir,
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

const BLOCKED_EXTENSIONS = new Set(['.html', '.htm', '.svg', '.xml', '.xhtml', '.js', '.mjs', '.cjs', '.php', '.asp', '.aspx', '.jsp', '.sh', '.bat', '.cmd', '.ps1', '.exe', '.dll', '.msi']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.ogg', '.ogv', '.avi', '.mkv']);

const attachmentUpload = multer({
  storage: attachmentStorage,
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

function handleMulterUpload(req: Request, res: Response, next: NextFunction) {
  attachmentUpload.array('files', 20)(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return next(new BadRequestError('File too large (max 100MB for video, 10MB for other files)'));
      if (err.code === 'LIMIT_FILE_COUNT') return next(new BadRequestError('Too many files (max 20)'));
      return next(new BadRequestError(err.message || 'Upload failed'));
    }
    next();
  });
}

export const dmRoutes = Router();

dmRoutes.use(authenticate);

// Get DM unread counts
dmRoutes.get(
  '/unreads',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const unreads = await dmService.getDMUnreadCounts(req.user!.userId);
      res.json(unreads);
    } catch (err) {
      next(err);
    }
  },
);

// List all conversations for the current user
dmRoutes.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const conversations = await dmService.listConversations(req.user!.userId);
      res.json(conversations);
    } catch (err) {
      next(err);
    }
  },
);

// List message requests (pending DMs)
dmRoutes.get(
  '/requests',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requests = await dmService.listMessageRequests(req.user!.userId);
      res.json(requests);
    } catch (err) {
      next(err);
    }
  },
);

// Create or get existing conversation with a user
dmRoutes.post(
  '/with/:userId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const targetUserId = req.params.userId;
      if (targetUserId === req.user!.userId) {
        return next(new ForbiddenError('Cannot create a conversation with yourself'));
      }
      const blocked = await blocksService.isBlocked(req.user!.userId, targetUserId);
      if (blocked) {
        return next(new ForbiddenError('Cannot message this user'));
      }
      const conversation = await dmService.findOrCreateConversation(req.user!.userId, targetUserId);
      res.json(conversation);
    } catch (err) {
      next(err);
    }
  },
);

// Create group DM
dmRoutes.post(
  '/groups',
  validate(validation.createGroupDMSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const conversation = await dmService.createGroupDM(
        req.user!.userId,
        req.body.participantIds,
        req.body.name,
      );
      res.status(201).json(conversation);
    } catch (err) {
      next(err);
    }
  },
);

// Accept message request
dmRoutes.post(
  '/:conversationId/accept',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const conversation = await dmService.acceptMessageRequest(
        req.params.conversationId,
        req.user!.userId,
      );
      res.json(conversation);
    } catch (err) {
      next(err);
    }
  },
);

// Decline message request
dmRoutes.post(
  '/:conversationId/decline',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await dmService.declineMessageRequest(
        req.params.conversationId,
        req.user!.userId,
      );
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

// Leave group DM
dmRoutes.delete(
  '/:conversationId/members/me',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await dmService.leaveGroupDM(req.params.conversationId, req.user!.userId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

// Rename group DM
dmRoutes.patch(
  '/:conversationId',
  validate(validation.updateConversationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const conversation = await dmService.renameGroupDM(
        req.params.conversationId,
        req.user!.userId,
        req.body.name,
      );
      res.json(conversation);
    } catch (err) {
      next(err);
    }
  },
);

// Mark conversation as read
dmRoutes.put(
  '/:conversationId/read',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isMember = await dmService.isConversationMember(req.params.conversationId, req.user!.userId);
      if (!isMember) return next(new ForbiddenError('Not a member of this conversation'));

      const { messageId } = req.body;
      if (!messageId || typeof messageId !== 'string') {
        return res.status(400).json({ error: 'messageId is required' });
      }
      await dmService.markDMRead(req.params.conversationId, req.user!.userId, messageId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

// Get messages in a conversation
dmRoutes.get(
  '/:conversationId/messages',
  validate(validation.dmQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isMember = await dmService.isConversationMember(req.params.conversationId, req.user!.userId);
      if (!isMember) return next(new ForbiddenError('Not a member of this conversation'));

      const { before, limit } = req.query as any;
      const blockedUserIds = await blocksService.getBlockedUserIds(req.user!.userId);
      const messages = await dmService.listMessages(req.params.conversationId, { before, limit, blockedUserIds });
      res.json(messages);
    } catch (err) {
      next(err);
    }
  },
);

// Send a message in a conversation
dmRoutes.post(
  '/:conversationId/messages',
  validate(validation.createDMSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isMember = await dmService.isConversationMember(req.params.conversationId, req.user!.userId);
      if (!isMember) return next(new ForbiddenError('Not a member of this conversation'));

      // Check blocks for DM conversations
      const conv = await dmService.getConversation(req.params.conversationId, req.user!.userId);
      if (conv && conv.type === 'dm') {
        const otherParticipant = conv.participants.find((p: any) => p.id !== req.user!.userId);
        if (otherParticipant) {
          const blocked = await blocksService.isBlocked(req.user!.userId, otherParticipant.id);
          if (blocked) {
            return next(new ForbiddenError('Cannot message this user'));
          }
        }
      }

      const message = await dmService.sendMessage(
        req.params.conversationId,
        req.user!.userId,
        req.body.content,
      );
      res.status(201).json(message);
    } catch (err) {
      next(err);
    }
  },
);

// ─── Reactions ───

// Add reaction to DM
dmRoutes.put(
  '/:conversationId/messages/:messageId/reactions/:emoji',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isMember = await dmService.isConversationMember(req.params.conversationId, req.user!.userId);
      if (!isMember) return next(new ForbiddenError('Not a member of this conversation'));

      const emoji = decodeURIComponent(req.params.emoji);
      const reactions = await dmService.addDMReaction(
        req.params.conversationId,
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

// Remove reaction from DM
dmRoutes.delete(
  '/:conversationId/messages/:messageId/reactions/:emoji',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isMember = await dmService.isConversationMember(req.params.conversationId, req.user!.userId);
      if (!isMember) return next(new ForbiddenError('Not a member of this conversation'));

      const emoji = decodeURIComponent(req.params.emoji);
      const reactions = await dmService.removeDMReaction(
        req.params.conversationId,
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

// ─── File Upload ───

// Send DM with file attachments
dmRoutes.post(
  '/:conversationId/messages/upload',
  handleMulterUpload,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isMember = await dmService.isConversationMember(req.params.conversationId, req.user!.userId);
      if (!isMember) return next(new ForbiddenError('Not a member of this conversation'));

      // Check blocks for DM conversations
      const conv = await dmService.getConversation(req.params.conversationId, req.user!.userId);
      if (conv && conv.type === 'dm') {
        const otherParticipant = conv.participants.find((p: any) => p.id !== req.user!.userId);
        if (otherParticipant) {
          const blocked = await blocksService.isBlocked(req.user!.userId, otherParticipant.id);
          if (blocked) return next(new ForbiddenError('Cannot message this user'));
        }
      }

      const uploadedFiles = (req.files as Express.Multer.File[]) || [];
      for (const file of uploadedFiles) {
        const ext = path.extname(file.originalname).toLowerCase();
        const isVideo = file.mimetype.startsWith('video/') || VIDEO_EXTENSIONS.has(ext);
        if (!isVideo && file.size > 10 * 1024 * 1024) {
          return next(new BadRequestError(`File "${file.originalname}" exceeds 10MB limit for non-video files`));
        }
      }

      const content = req.body.content || '';
      if (!content && uploadedFiles.length === 0) {
        return next(new BadRequestError('Message must have content or at least one file'));
      }

      const message = await dmService.sendMessage(
        req.params.conversationId,
        req.user!.userId,
        content,
        { skipEvent: true },
      );

      for (const file of uploadedFiles) {
        let metadata: Record<string, any> | null = null;
        if (file.originalname.toLowerCase().endsWith('.gpx')) {
          const gpx = await parseGpxFile(file.path);
          if (gpx) metadata = { gpx };
        }
        await dmService.createDMAttachment(message.id, {
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          url: `/uploads/${file.filename}`,
        }, metadata);
      }

      await dmService.emitDMCreated(req.params.conversationId, message.id);

      // Re-fetch with attachments for the REST response
      const msgs = await dmService.listMessages(req.params.conversationId, { limit: 1 });
      const fullMessage = msgs.find((m: any) => m.id === message.id) || message;

      res.status(201).json(fullMessage);
    } catch (err) {
      next(err);
    }
  },
);

// Add attachments to existing DM
dmRoutes.post(
  '/:conversationId/messages/:messageId/attachments',
  handleMulterUpload,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isMember = await dmService.isConversationMember(req.params.conversationId, req.user!.userId);
      if (!isMember) return next(new ForbiddenError('Not a member of this conversation'));

      const uploadedFiles = (req.files as Express.Multer.File[]) || [];
      for (const file of uploadedFiles) {
        const ext = path.extname(file.originalname).toLowerCase();
        const isVideo = file.mimetype.startsWith('video/') || VIDEO_EXTENSIONS.has(ext);
        if (!isVideo && file.size > 10 * 1024 * 1024) {
          return next(new BadRequestError(`File "${file.originalname}" exceeds 10MB limit for non-video files`));
        }
      }

      if (uploadedFiles.length === 0) return next(new BadRequestError('No files provided'));

      for (const file of uploadedFiles) {
        let metadata: Record<string, any> | null = null;
        if (file.originalname.toLowerCase().endsWith('.gpx')) {
          const gpx = await parseGpxFile(file.path);
          if (gpx) metadata = { gpx };
        }
        await dmService.createDMAttachment(req.params.messageId, {
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          url: `/uploads/${file.filename}`,
        }, metadata);
      }

      await dmService.emitDMCreated(req.params.conversationId, req.params.messageId);
      res.status(200).json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

// Edit a DM
dmRoutes.patch(
  '/:conversationId/messages/:messageId',
  validate(validation.createDMSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isMember = await dmService.isConversationMember(req.params.conversationId, req.user!.userId);
      if (!isMember) return next(new ForbiddenError('Not a member of this conversation'));

      const message = await dmService.editMessage(
        req.params.conversationId,
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

// Delete a DM
dmRoutes.delete(
  '/:conversationId/messages/:messageId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isMember = await dmService.isConversationMember(req.params.conversationId, req.user!.userId);
      if (!isMember) return next(new ForbiddenError('Not a member of this conversation'));

      const isAdmin = config.adminEmails.includes(req.user!.email);
      await dmService.deleteMessage(
        req.params.conversationId,
        req.params.messageId,
        req.user!.userId,
        isAdmin,
      );
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
