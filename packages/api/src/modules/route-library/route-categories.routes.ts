import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { Permissions } from '@crabac/shared';
import { requirePermission, requireMember } from '../rbac/rbac.middleware.js';
import { validate } from '../../middleware/validate.js';
import { validation } from '@crabac/shared';
import * as routeLibraryService from './route-library.service.js';

export const routeCategoriesRoutes = Router();

routeCategoriesRoutes.use(authenticate);

// List route categories
routeCategoriesRoutes.get(
  '/:spaceId/route-categories',
  requireMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await routeLibraryService.listRouteCategories(req.params.spaceId);
      res.json(categories);
    } catch (err) {
      next(err);
    }
  },
);

// Create route category
routeCategoriesRoutes.post(
  '/:spaceId/route-categories',
  requirePermission(Permissions.MANAGE_ROUTE_CATEGORIES),
  validate(validation.createRouteCategorySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = await routeLibraryService.createRouteCategory(req.params.spaceId, req.body.name);
      res.status(201).json(category);
    } catch (err) {
      next(err);
    }
  },
);

// Delete route category
routeCategoriesRoutes.delete(
  '/:spaceId/route-categories/:categoryId',
  requirePermission(Permissions.MANAGE_ROUTE_CATEGORIES),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await routeLibraryService.deleteRouteCategory(req.params.categoryId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);
