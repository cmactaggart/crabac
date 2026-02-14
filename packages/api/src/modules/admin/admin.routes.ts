import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { requireAdmin } from './admin.middleware.js';
import * as adminService from './admin.service.js';

export const adminRoutes = Router();
export const announcementRoutes = Router();

// --- Admin-only routes ---
adminRoutes.use(authenticate, requireAdmin);

adminRoutes.get('/spaces', async (_req, res, next) => {
  try {
    const spaces = await adminService.listAllSpaces();
    res.json(spaces);
  } catch (err) { next(err); }
});

adminRoutes.get('/users', async (_req, res, next) => {
  try {
    const users = await adminService.listAllUsers();
    res.json(users);
  } catch (err) { next(err); }
});

adminRoutes.get('/announcements', async (_req, res, next) => {
  try {
    const announcements = await adminService.listAnnouncements();
    res.json(announcements);
  } catch (err) { next(err); }
});

adminRoutes.post('/announcements', async (req, res, next) => {
  try {
    const { title, content } = req.body;
    const announcement = await adminService.createAnnouncement(title, content);
    res.status(201).json(announcement);
  } catch (err) { next(err); }
});

adminRoutes.patch('/announcements/:id', async (req, res, next) => {
  try {
    const announcement = await adminService.updateAnnouncement(req.params.id, req.body);
    res.json(announcement);
  } catch (err) { next(err); }
});

adminRoutes.delete('/announcements/:id', async (req, res, next) => {
  try {
    await adminService.deleteAnnouncement(req.params.id);
    res.status(204).end();
  } catch (err) { next(err); }
});

// Featured toggle
adminRoutes.post('/spaces/:spaceId/feature', async (req, res, next) => {
  try {
    const result = await adminService.toggleFeatured(req.params.spaceId);
    res.json(result);
  } catch (err) { next(err); }
});

// Predefined tags CRUD
adminRoutes.get('/tags', async (_req, res, next) => {
  try {
    const tags = await adminService.listPredefinedTags();
    res.json(tags);
  } catch (err) { next(err); }
});

adminRoutes.post('/tags', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: { message: 'name is required' } });
      return;
    }
    const tag = await adminService.createPredefinedTag(name.trim());
    res.status(201).json(tag);
  } catch (err) { next(err); }
});

adminRoutes.delete('/tags/:id', async (req, res, next) => {
  try {
    await adminService.deletePredefinedTag(req.params.id);
    res.status(204).end();
  } catch (err) { next(err); }
});

// --- Public (auth-only) routes for announcements ---
announcementRoutes.get('/active', authenticate, async (_req, res, next) => {
  try {
    const announcements = await adminService.getActiveAnnouncements();
    res.json(announcements);
  } catch (err) { next(err); }
});

announcementRoutes.get('/unseen', authenticate, async (req, res, next) => {
  try {
    const announcements = await adminService.getUnseenAnnouncements(req.user!.userId);
    res.json(announcements);
  } catch (err) { next(err); }
});

announcementRoutes.post('/dismiss', authenticate, async (req, res, next) => {
  try {
    const { lastSeenId } = req.body;
    if (!lastSeenId) {
      res.status(400).json({ error: { message: 'lastSeenId is required' } });
      return;
    }
    await adminService.dismissAnnouncements(req.user!.userId, lastSeenId);
    res.json({ ok: true });
  } catch (err) { next(err); }
});
