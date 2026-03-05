import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import * as followsService from './follows.service.js';
import { searchSocialPosts } from '../search/search.service.js';
import { getPost as getPostById, listSpacePosts } from '../personal-collections/user-posts.service.js';
import { resolveVisibleLevels } from '../personal-collections/privacy.service.js';
import { validation } from '@crabac/shared';

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

// Search social posts (full-text + hashtag), respecting visibility
followsRoutes.get(
  '/feed/search',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = (req.query.q as string || '').trim();
      const hashtag = req.query.hashtag as string | undefined;
      const before = req.query.before as string | undefined;
      const limit = Math.min(Number(req.query.limit) || 25, 50);
      const viewerId = req.user!.userId;

      if (!q && !hashtag) {
        res.json([]);
        return;
      }

      // Search with all non-private visibility levels (we'll filter per-author below)
      const hits = await searchSocialPosts(q || '*', {
        hashtag,
        before,
        limit: limit * 2, // fetch extra to account for post-filtering
        visibilityLevels: ['public', 'friends', 'spaces'],
      });
      if (hits.length === 0) {
        res.json([]);
        return;
      }

      // Group hits by author to batch-resolve visibility
      const authorIds = [...new Set(hits.map((h) => h.userId))];
      const visibilityByAuthor = new Map<string, Set<string>>();
      await Promise.all(
        authorIds.map(async (authorId) => {
          const levels = await resolveVisibleLevels(authorId, viewerId);
          visibilityByAuthor.set(authorId, levels);
        }),
      );

      // Filter hits by what the viewer can actually see
      const visibleHits = hits.filter((hit) => {
        const allowed = visibilityByAuthor.get(hit.userId);
        return allowed && allowed.has(hit.visibility);
      }).slice(0, limit);

      if (visibleHits.length === 0) {
        res.json([]);
        return;
      }

      // Hydrate full post objects
      const posts = await Promise.all(
        visibleHits.map(async (hit) => {
          try {
            return await getPostById(hit.id);
          } catch {
            return null;
          }
        }),
      );

      res.json(posts.filter(Boolean));
    } catch (err) {
      next(err);
    }
  },
);

// Get single post by ID (for detail view)
followsRoutes.get(
  '/posts/:postId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const post = await getPostById(req.params.postId);

      // Space posts are always public
      if (post.spaceId) {
        res.json(post);
        return;
      }

      // Check visibility
      const visibleLevels = await resolveVisibleLevels(post.userId, req.user!.userId);
      if (!visibleLevels.has(post.visibility as any)) {
        res.status(404).json({ error: 'Post not found' });
        return;
      }

      res.json(post);
    } catch (err) {
      next(err);
    }
  },
);

// Get posts for a space's social profile
followsRoutes.get(
  '/spaces/:spaceId/posts',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = validation.userPostsQuerySchema.parse(req.query);
      const posts = await listSpacePosts(req.params.spaceId, {
        before: query.before,
        limit: query.limit,
      });
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
