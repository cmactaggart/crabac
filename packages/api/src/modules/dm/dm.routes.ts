import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { validate } from '../../middleware/validate.js';
import { validation } from '@crabac/shared';
import * as dmService from './dm.service.js';
import { ForbiddenError } from '../../lib/errors.js';

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
      const messages = await dmService.listMessages(req.params.conversationId, { before, limit });
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

      await dmService.deleteMessage(
        req.params.conversationId,
        req.params.messageId,
        req.user!.userId,
      );
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
