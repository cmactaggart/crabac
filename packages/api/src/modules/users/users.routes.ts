import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate } from '../auth/auth.middleware.js';
import { validate } from '../../middleware/validate.js';
import { validation } from '@crabac/shared';
import { config } from '../../config.js';
import * as usersService from './users.service.js';
import * as mutesService from './mutes.service.js';
import * as preferencesService from './preferences.service.js';

export const usersRoutes = Router();

// Configure multer disk storage
const storage = multer.diskStorage({
  destination: config.uploadsDir,
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

usersRoutes.use(authenticate);

usersRoutes.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await usersService.getUser(req.user!.userId);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

usersRoutes.patch(
  '/me',
  validate(validation.updateUserSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await usersService.updateUser(req.user!.userId, req.body);
      res.json(user);
    } catch (err) {
      next(err);
    }
  },
);

usersRoutes.post(
  '/me/avatar',
  upload.single('avatar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const avatarUrl = `/uploads/${req.file.filename}`;
      const user = await usersService.updateUser(req.user!.userId, { avatarUrl });
      res.json(user);
    } catch (err) {
      next(err);
    }
  },
);

// ─── Preferences ───

usersRoutes.get('/preferences', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prefs = await preferencesService.getPreferences(req.user!.userId);
    res.json(prefs);
  } catch (err) {
    next(err);
  }
});

usersRoutes.put(
  '/preferences',
  validate(validation.updateUserPreferencesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const prefs = await preferencesService.updatePreferences(req.user!.userId, req.body);
      res.json(prefs);
    } catch (err) {
      next(err);
    }
  },
);

// ─── Mutes ───

usersRoutes.get('/mutes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mutedUserIds = await mutesService.getMutedUsers(req.user!.userId);
    res.json(mutedUserIds);
  } catch (err) {
    next(err);
  }
});

usersRoutes.put('/mutes/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await mutesService.muteUser(req.user!.userId, req.params.userId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

usersRoutes.delete('/mutes/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await mutesService.unmuteUser(req.user!.userId, req.params.userId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── Public Profile ───

usersRoutes.get('/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await usersService.getPublicUser(req.params.userId);
    res.json(user);
  } catch (err) {
    next(err);
  }
});
