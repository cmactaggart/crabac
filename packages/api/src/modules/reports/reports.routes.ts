import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { validate } from '../../middleware/validate.js';
import { validation, Permissions } from '@crabac/shared';
import { requirePermission } from '../rbac/rbac.middleware.js';
import { requireAdmin } from '../admin/admin.middleware.js';
import * as reportsService from './reports.service.js';

export const reportsRoutes = Router();

reportsRoutes.use(authenticate);

// Create a report (any authenticated user)
reportsRoutes.post(
  '/',
  validate(validation.createReportSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await reportsService.createReport(req.user!.userId, req.body);
      res.status(201).json(report);
    } catch (err) {
      next(err);
    }
  },
);

// List all reports (global admin only)
reportsRoutes.get(
  '/',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = req.query.status as string | undefined;
      const reports = await reportsService.listAllReports(status);
      res.json(reports);
    } catch (err) {
      next(err);
    }
  },
);

// Update report status (global admin only)
reportsRoutes.patch(
  '/:id',
  requireAdmin,
  validate(validation.updateReportSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await reportsService.updateReportStatus(
        req.params.id,
        req.body.status,
        req.user!.userId,
      );
      res.json(report);
    } catch (err) {
      next(err);
    }
  },
);
