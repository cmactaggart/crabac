import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import * as followsService from './follows.service.js';

export const followsRoutes = Router();

followsRoutes.use(authenticate);

// Feed: aggregated posts from followed users + friends + self
// Must be before /:userId routes
followsRoutes.get(
  '/feed',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const before = req.query.before as string | undefined;
      const limit = Math.min(Number(req.query.limit) || 10, 50);
      const posts = await followsService.getFeed(req.user!.userId, { before, limit });
      res.json(posts);
    } catch (err) {
      next(err);
    }
  },
);

// Get follow status with a user
followsRoutes.get(
  '/status/:userId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = await followsService.getFollowStatus(req.user!.userId, req.params.userId);
      res.json(status);
    } catch (err) {
      next(err);
    }
  },
);

// Get follow counts for a user
followsRoutes.get(
  '/counts/:userId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const counts = await followsService.getFollowCounts(req.params.userId);
      res.json(counts);
    } catch (err) {
      next(err);
    }
  },
);

// Get followers list
followsRoutes.get(
  '/:userId/followers',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const followers = await followsService.getFollowers(req.params.userId);
      res.json(followers);
    } catch (err) {
      next(err);
    }
  },
);

// Get following list
followsRoutes.get(
  '/:userId/following',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const following = await followsService.getFollowing(req.params.userId);
      res.json(following);
    } catch (err) {
      next(err);
    }
  },
);

// Follow a user
followsRoutes.post(
  '/:userId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await followsService.followUser(req.user!.userId, req.params.userId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

// Unfollow a user
followsRoutes.delete(
  '/:userId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await followsService.unfollowUser(req.user!.userId, req.params.userId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
