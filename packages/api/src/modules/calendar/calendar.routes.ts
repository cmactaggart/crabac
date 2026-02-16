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
      const events = await calendarService.listEvents(req.params.spaceId, from, to, req.user!.userId);
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
      const event = await calendarService.getEvent(req.params.id, req.user!.userId);
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

// ─── Series ───

calendarRoutes.post(
  '/:spaceId/calendar/series',
  requirePermission(Permissions.MANAGE_CALENDAR),
  validate(validation.createEventSeriesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const series = await calendarService.createSeries(req.params.spaceId, req.user!.userId, req.body);
      res.status(201).json(series);
    } catch (err) {
      next(err);
    }
  },
);

calendarRoutes.get(
  '/:spaceId/calendar/series',
  requireMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const series = await calendarService.listSeries(req.params.spaceId);
      res.json(series);
    } catch (err) {
      next(err);
    }
  },
);

calendarRoutes.patch(
  '/:spaceId/calendar/series/:seriesId',
  requirePermission(Permissions.MANAGE_CALENDAR),
  validate(validation.updateEventSeriesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const series = await calendarService.updateSeries(req.params.seriesId, req.body);
      res.json(series);
    } catch (err) {
      next(err);
    }
  },
);

calendarRoutes.delete(
  '/:spaceId/calendar/series/:seriesId',
  requirePermission(Permissions.MANAGE_CALENDAR),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await calendarService.deleteSeries(req.params.seriesId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

calendarRoutes.patch(
  '/:spaceId/calendar/events/:id/override',
  requirePermission(Permissions.MANAGE_CALENDAR),
  validate(validation.updateCalendarEventSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = await calendarService.overrideOccurrence(req.params.id, req.body);
      res.json(event);
    } catch (err) {
      next(err);
    }
  },
);

calendarRoutes.post(
  '/:spaceId/calendar/events/:id/cancel',
  requirePermission(Permissions.MANAGE_CALENDAR),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = await calendarService.cancelOccurrence(req.params.id);
      res.json(event);
    } catch (err) {
      next(err);
    }
  },
);

// ─── RSVP ───

calendarRoutes.post(
  '/:spaceId/calendar/events/:eventId/rsvp',
  requireMember,
  validate(validation.rsvpSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await calendarService.upsertRsvp(req.params.eventId, req.user!.userId, req.body.status);
      const event = await calendarService.getEvent(req.params.eventId, req.user!.userId);
      res.json(event);
    } catch (err) {
      next(err);
    }
  },
);

calendarRoutes.delete(
  '/:spaceId/calendar/events/:eventId/rsvp',
  requireMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await calendarService.removeRsvp(req.params.eventId, req.user!.userId);
      const event = await calendarService.getEvent(req.params.eventId, req.user!.userId);
      res.json(event);
    } catch (err) {
      next(err);
    }
  },
);

calendarRoutes.get(
  '/:spaceId/calendar/events/:eventId/rsvps',
  requireMember,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rsvps = await calendarService.listRsvps(req.params.eventId);
      res.json(rsvps);
    } catch (err) {
      next(err);
    }
  },
);
