import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { validate } from '../../middleware/validate.js';
import { validation, Permissions } from '@gud/shared';
import { requirePermission, requireMember } from '../rbac/rbac.middleware.js';
import * as channelsService from './channels.service.js';
import * as readsService from './reads.service.js';

export const channelsRoutes = Router();

channelsRoutes.use(authenticate);

// Create channel
channelsRoutes.post(
  '/:spaceId/channels',
  requirePermission(Permissions.MANAGE_CHANNELS),
  validate(validation.createChannelSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const channel = await channelsService.createChannel(req.params.spaceId, req.body);
      res.status(201).json(channel);
    } catch (err) {
      next(err);
    }
  },
);

// List channels (filtered by user permissions)
channelsRoutes.get(
  '/:spaceId/channels',
  requireMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const channels = await channelsService.listChannelsForUser(req.params.spaceId, req.user!.userId);
      res.json(channels);
    } catch (err) {
      next(err);
    }
  },
);

// Bulk reorder channels
channelsRoutes.put(
  '/:spaceId/channels/reorder',
  requirePermission(Permissions.MANAGE_CHANNELS),
  validate(validation.reorderChannelsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const channels = await channelsService.reorderChannels(req.params.spaceId, req.body.channels);
      res.json(channels);
    } catch (err) {
      next(err);
    }
  },
);

// Update channel
channelsRoutes.patch(
  '/:spaceId/channels/:channelId',
  requirePermission(Permissions.MANAGE_CHANNELS),
  validate(validation.updateChannelSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const channel = await channelsService.updateChannel(req.params.spaceId, req.params.channelId, req.body);
      res.json(channel);
    } catch (err) {
      next(err);
    }
  },
);

// Delete channel
channelsRoutes.delete(
  '/:spaceId/channels/:channelId',
  requirePermission(Permissions.MANAGE_CHANNELS),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await channelsService.deleteChannel(req.params.spaceId, req.params.channelId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

// ─── Channel Permission Overrides ───

// Get overrides for a channel
channelsRoutes.get(
  '/:spaceId/channels/:channelId/overrides',
  requirePermission(Permissions.MANAGE_CHANNELS),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const overrides = await channelsService.getChannelOverrides(req.params.channelId);
      res.json(overrides);
    } catch (err) {
      next(err);
    }
  },
);

// Set override for a role on a channel
channelsRoutes.put(
  '/:spaceId/channels/:channelId/overrides/:roleId',
  requirePermission(Permissions.MANAGE_CHANNELS),
  validate(validation.channelOverrideSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const overrides = await channelsService.setChannelOverride(
        req.params.channelId,
        req.params.roleId,
        req.body.allow,
        req.body.deny,
      );
      res.json(overrides);
    } catch (err) {
      next(err);
    }
  },
);

// Delete override for a role on a channel
channelsRoutes.delete(
  '/:spaceId/channels/:channelId/overrides/:roleId',
  requirePermission(Permissions.MANAGE_CHANNELS),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await channelsService.deleteChannelOverride(req.params.channelId, req.params.roleId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

// ─── Channel Mutes ───

// Get muted channels in a space
channelsRoutes.get(
  '/:spaceId/channels/muted',
  requireMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const muted = await channelsService.getMutedChannels(req.params.spaceId, req.user!.userId);
      res.json(muted);
    } catch (err) {
      next(err);
    }
  },
);

// Mute a channel
channelsRoutes.put(
  '/:spaceId/channels/:channelId/mute',
  requireMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await channelsService.muteChannel(req.params.channelId, req.user!.userId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

// Unmute a channel
channelsRoutes.delete(
  '/:spaceId/channels/:channelId/mute',
  requireMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await channelsService.unmuteChannel(req.params.channelId, req.user!.userId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Unread Tracking ───

// Mark channel as read
channelsRoutes.post(
  '/:spaceId/channels/:channelId/read',
  requireMember,
  validate(validation.markReadSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await readsService.markRead(req.params.channelId, req.user!.userId, req.body.messageId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

// Get unread counts for all channels in a space
channelsRoutes.get(
  '/:spaceId/channels/unreads',
  requireMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const channels = await channelsService.listChannelsForUser(req.params.spaceId, req.user!.userId);
      const channelIds = channels.map((c: any) => c.id);
      const unreads = await readsService.getUnreadCounts(req.user!.userId, channelIds);

      const result: Record<string, { unreadCount: number; mentionCount: number }> = {};
      for (const [channelId, counts] of unreads) {
        result[channelId] = counts;
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);
