import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { validation } from '@crabac/shared';
import { authenticate } from '../auth/auth.middleware.js';
import { requireAdmin } from '../admin/admin.middleware.js';
import { mobileUpdateCheckLimiter } from '../../middleware/rate-limiter.js';
import { BadRequestError } from '../../lib/errors.js';
import { config } from '../../config.js';
import * as mobileService from './mobile.service.js';

// Multer config — store in temp location, service moves to bundles/
const bundleUpload = multer({
  dest: path.join(config.uploadsDir, 'tmp'),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB max
});

export const mobileRoutes = Router();

const adminOnly = [authenticate, requireAdmin];

// ── Public routes (no auth — app may not be logged in during update) ──

// Update check
mobileRoutes.get(
  '/update-check',
  mobileUpdateCheckLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = validation.mobileBundleUpdateCheckSchema.parse(req.query);
      const result = await mobileService.checkForUpdate(
        parsed.platform,
        parsed.nativeVersion,
        parsed.currentBundleVersion,
      );
      if (!result) {
        res.status(204).end();
        return;
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// Download bundle
mobileRoutes.get(
  '/bundles/:id/download',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const bundle = await mobileService.getBundleById(req.params.id);
      const filePath = mobileService.getBundleFilePath(bundle);

      if (!fs.existsSync(filePath)) {
        return next(new BadRequestError('Bundle file not found on disk'));
      }

      res.setHeader('X-Bundle-Checksum', bundle.checksum);
      res.setHeader('Content-Length', bundle.fileSize);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    } catch (err) {
      next(err);
    }
  },
);

// ── Admin routes ──

// Upload new bundle
mobileRoutes.post(
  '/bundles',
  ...adminOnly,
  bundleUpload.single('bundle'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return next(new BadRequestError('Bundle file is required'));
      }

      const parsed = validation.uploadMobileBundleSchema.parse(req.body);
      const bundle = await mobileService.uploadBundle(
        parsed.platform,
        parsed.nativeVersion,
        parsed.isRequired,
        parsed.releaseNotes,
        req.file,
        req.user!.userId,
      );
      res.status(201).json(bundle);
    } catch (err) {
      // Clean up temp file on error
      if (req.file?.path) {
        fs.unlink(req.file.path, () => {});
      }
      next(err);
    }
  },
);

// List bundles
mobileRoutes.get(
  '/bundles',
  ...adminOnly,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = validation.mobileBundlesQuerySchema.parse(req.query);
      const result = await mobileService.listBundles(parsed);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// Deactivate bundle
mobileRoutes.delete(
  '/bundles/:id',
  ...adminOnly,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const bundle = await mobileService.deactivateBundle(req.params.id);
      res.json(bundle);
    } catch (err) {
      next(err);
    }
  },
);

// Reactivate bundle
mobileRoutes.post(
  '/bundles/:id/activate',
  ...adminOnly,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const bundle = await mobileService.activateBundle(req.params.id);
      res.json(bundle);
    } catch (err) {
      next(err);
    }
  },
);
