import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { validate } from '../../middleware/validate.js';
import { validation } from '@crabac/shared';
import * as spacesService from './spaces.service.js';
import { db } from '../../database/connection.js';

export const publicSpacesRoutes = Router();

// Get space by slug (NO auth required — for public share link landing pages)
publicSpacesRoutes.get(
  '/by-slug/:slug',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const space = await spacesService.getSpaceBySlug(req.params.slug);
      // Return limited info — full details require membership or public access
      res.json({
        id: space.id,
        name: space.name,
        slug: space.slug,
        description: space.description,
        iconUrl: space.iconUrl,
        isPublic: space.isPublic,
      });
    } catch (err) {
      next(err);
    }
  },
);

// --- Auth-required endpoints below ---

// List public spaces (search, tag filter, pagination)
publicSpacesRoutes.get(
  '/directory',
  authenticate,
  validate(validation.publicSpacesQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { search, tag, limit, offset } = req.query as any;
      const spaces = await spacesService.listPublicSpaces({
        search,
        tag,
        limit: Number(limit) || 20,
        offset: Number(offset) || 0,
      });
      res.json(spaces);
    } catch (err) {
      next(err);
    }
  },
);

// Featured public spaces
publicSpacesRoutes.get(
  '/directory/featured',
  authenticate,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const spaces = await spacesService.listPublicSpaces({
        limit: 10,
        offset: 0,
      });
      // Filter to only featured
      res.json(spaces.filter((s: any) => s.isFeatured));
    } catch (err) {
      next(err);
    }
  },
);

// All tags in use + predefined tags
publicSpacesRoutes.get(
  '/directory/tags',
  authenticate,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      // Get predefined tags
      const predefined = await db('predefined_tags')
        .select('name', 'slug')
        .orderBy('name');

      // Get tags currently in use on public spaces
      const inUse = await db('space_tags')
        .join('space_settings', 'space_tags.space_id', 'space_settings.space_id')
        .where('space_settings.is_public', true)
        .select('space_tags.tag', 'space_tags.tag_slug')
        .groupBy('space_tags.tag_slug', 'space_tags.tag')
        .orderBy('space_tags.tag');

      res.json({
        predefined: predefined.map((t: any) => ({ name: t.name, slug: t.slug })),
        inUse: inUse.map((t: any) => ({ name: t.tag, slug: t.tag_slug })),
      });
    } catch (err) {
      next(err);
    }
  },
);
