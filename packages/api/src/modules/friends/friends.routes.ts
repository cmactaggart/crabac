import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { validate } from '../../middleware/validate.js';
import { validation } from '@crabac/shared';
import * as friendsService from './friends.service.js';

export const friendsRoutes = Router();

friendsRoutes.use(authenticate);

// List accepted friends
friendsRoutes.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const friends = await friendsService.listFriends(req.user!.userId);
      res.json(friends);
    } catch (err) {
      next(err);
    }
  },
);

// List received pending requests
friendsRoutes.get(
  '/requests/pending',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requests = await friendsService.listPendingRequests(req.user!.userId);
      res.json(requests);
    } catch (err) {
      next(err);
    }
  },
);

// List sent pending requests
friendsRoutes.get(
  '/requests/sent',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requests = await friendsService.listSentRequests(req.user!.userId);
      res.json(requests);
    } catch (err) {
      next(err);
    }
  },
);

// Send friend request
friendsRoutes.post(
  '/requests',
  validate(validation.sendFriendRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await friendsService.sendFriendRequest(req.user!.userId, req.body.userId);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// Accept friend request
friendsRoutes.post(
  '/requests/:friendshipId/accept',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await friendsService.acceptFriendRequest(req.user!.userId, req.params.friendshipId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// Decline friend request
friendsRoutes.post(
  '/requests/:friendshipId/decline',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await friendsService.declineFriendRequest(req.user!.userId, req.params.friendshipId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

// Remove friend
friendsRoutes.delete(
  '/:friendshipId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await friendsService.removeFriend(req.user!.userId, req.params.friendshipId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

// Get friendship status with a specific user
friendsRoutes.get(
  '/status/:userId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = await friendsService.getFriendshipStatus(req.user!.userId, req.params.userId);
      res.json(status);
    } catch (err) {
      next(err);
    }
  },
);
