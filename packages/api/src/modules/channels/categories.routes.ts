import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { validate } from '../../middleware/validate.js';
import { validation, Permissions } from '@gud/shared';
import { requirePermission, requireMember } from '../rbac/rbac.middleware.js';
import * as categoriesService from './categories.service.js';

export const categoriesRoutes = Router();

categoriesRoutes.use(authenticate);

// List categories
categoriesRoutes.get(
  '/:spaceId/categories',
  requireMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await categoriesService.listCategories(req.params.spaceId);
      res.json(categories);
    } catch (err) {
      next(err);
    }
  },
);

// Create category
categoriesRoutes.post(
  '/:spaceId/categories',
  requirePermission(Permissions.MANAGE_CHANNELS),
  validate(validation.createCategorySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = await categoriesService.createCategory(req.params.spaceId, req.body);
      res.status(201).json(category);
    } catch (err) {
      next(err);
    }
  },
);

// Bulk reorder categories
categoriesRoutes.put(
  '/:spaceId/categories/reorder',
  requirePermission(Permissions.MANAGE_CHANNELS),
  validate(validation.reorderCategoriesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await categoriesService.reorderCategories(req.params.spaceId, req.body.categories);
      res.json(categories);
    } catch (err) {
      next(err);
    }
  },
);

// Update category
categoriesRoutes.patch(
  '/:spaceId/categories/:categoryId',
  requirePermission(Permissions.MANAGE_CHANNELS),
  validate(validation.updateCategorySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = await categoriesService.updateCategory(req.params.categoryId, req.body);
      res.json(category);
    } catch (err) {
      next(err);
    }
  },
);

// Delete category
categoriesRoutes.delete(
  '/:spaceId/categories/:categoryId',
  requirePermission(Permissions.MANAGE_CHANNELS),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await categoriesService.deleteCategory(req.params.categoryId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
