import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate } from '../auth/auth.middleware.js';
import { validate } from '../../middleware/validate.js';
import { validation } from '@crabac/shared';
import { config } from '../../config.js';
import * as usersService from './users.service.js';
import * as mutesService from './mutes.service.js';
import * as blocksService from './blocks.service.js';
import * as preferencesService from './preferences.service.js';
import * as profileLinksService from './profile-links.service.js';

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

usersRoutes.delete('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { password } = req.body;
    if (!password) {
      res.status(400).json({ error: 'Password is required' });
      return;
    }
    await usersService.deleteAccount(req.user!.userId, password);
    res.json({ success: true });
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

// ─── Blocks ───

usersRoutes.get('/blocks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const blocks = await blocksService.getBlocks(req.user!.userId);
    res.json(blocks);
  } catch (err) {
    next(err);
  }
});

usersRoutes.put('/blocks/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await blocksService.blockUser(req.user!.userId, req.params.userId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

usersRoutes.delete('/blocks/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await blocksService.unblockUser(req.user!.userId, req.params.userId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── Search ───

usersRoutes.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (q.length < 2) {
      res.json([]);
      return;
    }
    const results = await usersService.searchUsers(q, req.user!.userId);
    res.json(results);
  } catch (err) {
    next(err);
  }
});

// ─── Profile Links ───

usersRoutes.get('/me/profile-links', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const links = await profileLinksService.listProfileLinks(req.user!.userId);
    res.json(links);
  } catch (err) { next(err); }
});

usersRoutes.post(
  '/me/profile-links',
  validate(validation.createProfileLinkSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const link = await profileLinksService.createProfileLink(req.user!.userId, req.body);
      res.status(201).json(link);
    } catch (err) { next(err); }
  },
);

usersRoutes.patch(
  '/me/profile-links/:linkId',
  validate(validation.updateProfileLinkSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const link = await profileLinksService.updateProfileLink(req.params.linkId, req.user!.userId, req.body);
      res.json(link);
    } catch (err) { next(err); }
  },
);

usersRoutes.delete('/me/profile-links/:linkId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await profileLinksService.deleteProfileLink(req.params.linkId, req.user!.userId);
    res.json({ success: true });
  } catch (err) { next(err); }
});

usersRoutes.put(
  '/me/profile-links/reorder',
  validate(validation.reorderProfileLinksSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const links = await profileLinksService.reorderProfileLinks(req.user!.userId, req.body.linkIds);
      res.json(links);
    } catch (err) { next(err); }
  },
);

// ─── Managed Social Spaces ───

usersRoutes.get('/me/managed-social-spaces', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { db } = await import('../../database/connection.js');
    const { computePermissions } = await import('../rbac/rbac.service.js');
    const { Permissions, hasPermission } = await import('@crabac/shared');

    // Get all spaces user is a member of with social_enabled
    const spaces = await db('space_members')
      .join('spaces', 'space_members.space_id', 'spaces.id')
      .join('space_settings', 'space_members.space_id', 'space_settings.space_id')
      .where('space_members.user_id', req.user!.userId)
      .where('space_settings.social_enabled', true)
      .select(
        'spaces.id', 'spaces.name', 'spaces.slug', 'spaces.icon_url',
        'space_settings.base_color', 'space_settings.accent_color',
      );

    // Filter by MANAGE_SOCIAL permission
    const result: any[] = [];
    for (const space of spaces) {
      const perms = await computePermissions(String(space.id), req.user!.userId);
      if (hasPermission(perms, Permissions.MANAGE_SOCIAL)) {
        result.push({
          id: String(space.id),
          name: space.name,
          slug: space.slug,
          iconUrl: space.icon_url || null,
          baseColor: space.base_color || null,
          accentColor: space.accent_color || null,
        });
      }
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── Username Lookup ───

usersRoutes.get('/by-username/:username', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await usersService.getUserByUsername(req.params.username);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    // Check if viewer can see this profile
    const { canViewProfile } = await import('../personal-collections/privacy.service.js');
    const canView = await canViewProfile(user.id, req.user!.userId);
    const prefs = await preferencesService.getPreferences(user.id);
    const profileLinks = await profileLinksService.listProfileLinks(user.id);
    res.json({ ...user, canViewProfile: canView, newsletterEnabled: prefs.newsletterEnabled, profileLinks });
  } catch (err) {
    next(err);
  }
});

// ─── Profile Resolution (user-first, then space) ───

usersRoutes.get('/profiles/:handle', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const handle = req.params.handle;
    const { db } = await import('../../database/connection.js');

    // Try user first (case-insensitive)
    const user = await usersService.getUserByUsername(handle);
    if (user) {
      const { canViewProfile } = await import('../personal-collections/privacy.service.js');
      const canView = await canViewProfile(user.id, req.user!.userId);
      const prefs = await preferencesService.getPreferences(user.id);
      const links = await profileLinksService.listProfileLinks(user.id);
      res.json({
        type: 'user',
        ...user,
        canViewProfile: canView,
        newsletterEnabled: prefs.newsletterEnabled,
        profileLinks: links,
      });
      return;
    }

    // Try space slug where social_enabled
    const space = await db('spaces')
      .leftJoin('space_settings', 'spaces.id', 'space_settings.space_id')
      .whereRaw('LOWER(spaces.slug) = LOWER(?)', [handle])
      .where('space_settings.social_enabled', true)
      .select(
        'spaces.id', 'spaces.name', 'spaces.slug', 'spaces.description',
        'spaces.icon_url', 'spaces.owner_id',
        'space_settings.base_color', 'space_settings.accent_color',
        'space_settings.text_color',
      )
      .first();

    if (space) {
      const memberCount = await db('space_members')
        .where('space_id', space.id)
        .count('* as count')
        .first();

      res.json({
        type: 'space',
        id: String(space.id),
        name: space.name,
        slug: space.slug,
        description: space.description,
        iconUrl: space.icon_url || null,
        ownerId: String(space.owner_id),
        baseColor: space.base_color || null,
        accentColor: space.accent_color || null,
        textColor: space.text_color || null,
        memberCount: Number(memberCount?.count || 0),
      });
      return;
    }

    res.status(404).json({ error: 'Profile not found' });
  } catch (err) {
    next(err);
  }
});

// ─── Public Profile Links ───

usersRoutes.get('/:userId/profile-links', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const links = await profileLinksService.listProfileLinks(req.params.userId);
    res.json(links);
  } catch (err) { next(err); }
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
