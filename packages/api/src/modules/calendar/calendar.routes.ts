import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { validate } from '../../middleware/validate.js';
import { validation, Permissions } from '@crabac/shared';
import { requirePermission, requireMember } from '../rbac/rbac.middleware.js';
import * as calendarService from './calendar.service.js';

export const calendarRoutes = Router();
calendarRoutes.use(authenticate);

// ─── Categories ───

calendarRoutes.get(
  '/:spaceId/calendar/categories',
  requireMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await calendarService.listCategories(req.params.spaceId);
      res.json(categories);
    } catch (err) {
      next(err);
    }
  },
);

calendarRoutes.post(
  '/:spaceId/calendar/categories',
  requirePermission(Permissions.MANAGE_CALENDAR),
  validate(validation.createCalendarCategorySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = await calendarService.createCategory(req.params.spaceId, req.body);
      res.status(201).json(category);
    } catch (err) {
      next(err);
    }
  },
);

calendarRoutes.patch(
  '/:spaceId/calendar/categories/:id',
  requirePermission(Permissions.MANAGE_CALENDAR),
  validate(validation.updateCalendarCategorySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = await calendarService.updateCategory(req.params.id, req.body);
      res.json(category);
    } catch (err) {
      next(err);
    }
  },
);

calendarRoutes.delete(
  '/:spaceId/calendar/categories/:id',
  requirePermission(Permissions.MANAGE_CALENDAR),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await calendarService.deleteCategory(req.params.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

// ─── Events ───

calendarRoutes.get(
  '/:spaceId/calendar/events',
  requireMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { from, to } = req.query as { from: string; to: string };
      const events = await calendarService.listEvents(req.params.spaceId, from, to);
      res.json(events);
    } catch (err) {
      next(err);
    }
  },
);

calendarRoutes.get(
  '/:spaceId/calendar/events/:id',
  requireMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = await calendarService.getEvent(req.params.id);
      res.json(event);
    } catch (err) {
      next(err);
    }
  },
);

calendarRoutes.post(
  '/:spaceId/calendar/events',
  requirePermission(Permissions.MANAGE_CALENDAR),
  validate(validation.createCalendarEventSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = await calendarService.createEvent(req.params.spaceId, req.user!.userId, req.body);
      res.status(201).json(event);
    } catch (err) {
      next(err);
    }
  },
);

calendarRoutes.patch(
  '/:spaceId/calendar/events/:id',
  requirePermission(Permissions.MANAGE_CALENDAR),
  validate(validation.updateCalendarEventSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = await calendarService.updateEvent(req.params.id, req.body);
      res.json(event);
    } catch (err) {
      next(err);
    }
  },
);

calendarRoutes.delete(
  '/:spaceId/calendar/events/:id',
  requirePermission(Permissions.MANAGE_CALENDAR),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await calendarService.deleteEvent(req.params.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
