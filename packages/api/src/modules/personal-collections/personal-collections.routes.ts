import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate } from '../auth/auth.middleware.js';
import { validation, Permissions, hasPermission } from '@crabac/shared';
import { computeChannelPermissions } from '../rbac/rbac.service.js';
import { getChannelSpaceId } from '../channels/channels.service.js';
import * as spacesService from '../spaces/spaces.service.js';
import * as service from './personal-collections.service.js';
import * as activitiesService from './personal-activities.service.js';
import * as postsService from './user-posts.service.js';
import * as calendarService from '../calendar/calendar.service.js';
import * as blogService from '../blog/blog.service.js';
import * as newsletterService from '../newsletter/newsletter.service.js';
import { BadRequestError, ForbiddenError } from '../../lib/errors.js';
import { config } from '../../config.js';
import { parseGpxFile } from '../messages/gpx.service.js';
import { eventBus } from '../../lib/event-bus.js';
import { canViewProfile } from './privacy.service.js';
import { fetchElevations } from './elevation.service.js';
import { routeThrough, type RoutingProfile } from './routing.service.js';

// Multer config (shared with galleries)
const storage = multer.diskStorage({
  destination: config.uploadsDir,
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

const BLOCKED_EXTENSIONS = new Set(['.html', '.htm', '.svg', '.xml', '.xhtml', '.js', '.mjs', '.cjs', '.php', '.asp', '.aspx', '.jsp', '.sh', '.bat', '.cmd', '.ps1', '.exe', '.dll', '.msi']);

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) {
      cb(new Error('File type not allowed'));
    } else {
      cb(null, true);
    }
  },
});

function handleUpload(fieldName: string, maxCount: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    upload.array(fieldName, maxCount)(req, res, (err: any) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') return next(new BadRequestError('File too large (max 100MB)'));
        if (err.code === 'LIMIT_FILE_COUNT') return next(new BadRequestError('Too many files'));
        return next(new BadRequestError(err.message || 'Upload failed'));
      }
      next();
    });
  };
}

export const personalCollectionsRoutes = Router();

// All routes require authentication
personalCollectionsRoutes.use(authenticate);

// ─── Bulk Visibility ───

personalCollectionsRoutes.post(
  '/me/collections/bulk-visibility',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { visibility } = validation.bulkUpdateVisibilitySchema.parse(req.body);
      const result = await service.bulkUpdateVisibility(req.user!.userId, visibility);
      res.json(result);
    } catch (err) { next(err); }
  },
);

// ─── Own Gallery ───

personalCollectionsRoutes.get(
  '/me/collections/gallery',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = validation.personalCollectionsQuerySchema.parse(req.query);
      const items = await service.listPersonalGalleryItems(
        req.user!.userId,
        req.user!.userId,
        { before: query.before, limit: query.limit, visibility: query.visibility },
      );
      res.json(items);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.post(
  '/me/collections/gallery/upload',
  handleUpload('files', 20),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const uploadedFiles = (req.files as Express.Multer.File[]) || [];
      if (uploadedFiles.length === 0) return next(new BadRequestError('At least one file is required'));

      // Enforce 10MB for non-video
      const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.ogg', '.ogv', '.avi', '.mkv']);
      for (const file of uploadedFiles) {
        const ext = path.extname(file.originalname).toLowerCase();
        const isVideo = file.mimetype.startsWith('video/') || VIDEO_EXTENSIONS.has(ext);
        if (!isVideo && file.size > 10 * 1024 * 1024) {
          return next(new BadRequestError(`File "${file.originalname}" exceeds 10MB limit`));
        }
      }

      const body = validation.createPersonalGalleryItemSchema.parse(req.body);
      const item = await service.createPersonalGalleryItem(req.user!.userId, body);

      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        await service.createPersonalGalleryAttachment(item.id, {
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          url: `/uploads/${file.filename}`,
        }, i);
      }

      const fullItem = await service.getPersonalGalleryItem(item.id);
      res.status(201).json(fullItem);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.patch(
  '/me/collections/gallery/:itemId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = validation.updatePersonalGalleryItemSchema.parse(req.body);
      const item = await service.updatePersonalGalleryItem(req.params.itemId, req.user!.userId, data);
      res.json(item);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.delete(
  '/me/collections/gallery/:itemId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await service.deletePersonalGalleryItem(req.params.itemId, req.user!.userId);
      res.json({ success: true });
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.post(
  '/me/collections/gallery/:itemId/copy',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { channelId } = validation.copyToChannelSchema.parse(req.body);
      const userId = req.user!.userId;

      // Verify membership and permissions
      const spaceId = await getChannelSpaceId(channelId);
      const isMember = await spacesService.isMember(spaceId, userId);
      if (!isMember) return next(new ForbiddenError('Not a member of this space'));

      const perms = await computeChannelPermissions(spaceId, channelId, userId);
      if (!hasPermission(perms, Permissions.SEND_MESSAGES) || !hasPermission(perms, Permissions.ATTACH_FILES)) {
        return next(new ForbiddenError('Missing permissions in target channel'));
      }

      const result = await service.copyGalleryToChannel(req.params.itemId, channelId, userId);

      // Emit event so gallery updates in realtime
      const { emitGalleryItemCreated } = await import('../galleries/galleries.service.js');
      await emitGalleryItemCreated(channelId, result.id);

      res.status(201).json(result);
    } catch (err) { next(err); }
  },
);

// ─── Route Builder Helpers ───

personalCollectionsRoutes.post(
  '/me/collections/routes/elevation',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { coordinates } = validation.elevationQuerySchema.parse(req.body);
      const elevations = await fetchElevations(coordinates as [number, number][]);
      res.json({ elevations });
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.post(
  '/me/collections/routes/route',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { waypoints, profile } = validation.routingQuerySchema.parse(req.body);
      const result = await routeThrough(
        waypoints as [number, number][],
        (profile || 'bike') as RoutingProfile,
      );
      res.json(result);
    } catch (err) { next(err); }
  },
);

// ─── Own Routes ───

personalCollectionsRoutes.get(
  '/me/collections/routes',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = validation.personalCollectionsQuerySchema.parse(req.query);
      const items = await service.listPersonalRouteItems(
        req.user!.userId,
        req.user!.userId,
        { before: query.before, limit: query.limit, visibility: query.visibility },
      );
      res.json(items);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.post(
  '/me/collections/routes/upload',
  handleUpload('file', 1),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const uploadedFiles = (req.files as Express.Multer.File[]) || [];
      if (uploadedFiles.length === 0) return next(new BadRequestError('A GPX file is required'));

      const file = uploadedFiles[0];
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext !== '.gpx') return next(new BadRequestError('Only GPX files are supported'));

      const gpxMeta = await parseGpxFile(file.path);
      if (!gpxMeta) return next(new BadRequestError('Failed to parse GPX file'));

      const body = validation.createPersonalRouteSchema.parse(req.body);
      const result = await service.createPersonalRouteItem(
        req.user!.userId,
        body,
        gpxMeta,
        {
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          url: `/uploads/${file.filename}`,
        },
      );

      const item = await service.getPersonalRouteItem(result.id);
      res.status(201).json(item);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.patch(
  '/me/collections/routes/:itemId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = validation.updatePersonalRouteSchema.parse(req.body);
      const item = await service.updatePersonalRouteItem(req.params.itemId, req.user!.userId, data);
      res.json(item);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.delete(
  '/me/collections/routes/:itemId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await service.deletePersonalRouteItem(req.params.itemId, req.user!.userId);
      res.json({ success: true });
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.post(
  '/me/collections/routes/:itemId/copy',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { channelId } = validation.copyToChannelSchema.parse(req.body);
      const userId = req.user!.userId;

      const spaceId = await getChannelSpaceId(channelId);
      const isMember = await spacesService.isMember(spaceId, userId);
      if (!isMember) return next(new ForbiddenError('Not a member of this space'));

      const perms = await computeChannelPermissions(spaceId, channelId, userId);
      if (!hasPermission(perms, Permissions.SEND_MESSAGES) || !hasPermission(perms, Permissions.ATTACH_FILES)) {
        return next(new ForbiddenError('Missing permissions in target channel'));
      }

      const result = await service.copyRouteToChannel(req.params.itemId, channelId, userId);

      const { emitRouteItemCreated } = await import('../route-library/route-library.service.js');
      await emitRouteItemCreated(channelId, result.id);

      res.status(201).json(result);
    } catch (err) { next(err); }
  },
);

// ─── Own Activities ───

personalCollectionsRoutes.get(
  '/me/collections/activities',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = validation.personalActivitiesQuerySchema.parse(req.query);
      const items = await activitiesService.listPersonalActivityItems(
        req.user!.userId,
        req.user!.userId,
        { before: query.before, limit: query.limit, visibility: query.visibility, activityType: query.activityType },
      );
      res.json(items);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.get(
  '/me/collections/activities/stats',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = validation.activityStatsQuerySchema.parse(req.query);
      const stats = await activitiesService.getActivityStats(
        req.user!.userId,
        req.user!.userId,
        { period: query.period, year: query.year },
      );
      res.json(stats);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.post(
  '/me/collections/activities/upload',
  handleUpload('file', 1),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const uploadedFiles = (req.files as Express.Multer.File[]) || [];
      if (uploadedFiles.length === 0) return next(new BadRequestError('A GPX file is required'));

      const file = uploadedFiles[0];
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext !== '.gpx') return next(new BadRequestError('Only GPX files are supported'));

      const gpxMeta = await parseGpxFile(file.path);
      if (!gpxMeta) return next(new BadRequestError('Failed to parse GPX file'));

      const body = validation.createPersonalActivitySchema.parse(req.body);
      const result = await activitiesService.createPersonalActivityItem(
        req.user!.userId,
        body,
        gpxMeta,
        {
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          url: `/uploads/${file.filename}`,
        },
      );

      const item = await activitiesService.getPersonalActivityItem(result.id);
      res.status(201).json(item);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.get(
  '/me/collections/activities/:itemId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await activitiesService.getPersonalActivityItem(req.params.itemId);
      res.json(item);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.patch(
  '/me/collections/activities/:itemId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = validation.updatePersonalActivitySchema.parse(req.body);
      const item = await activitiesService.updatePersonalActivityItem(req.params.itemId, req.user!.userId, data);
      res.json(item);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.delete(
  '/me/collections/activities/:itemId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await activitiesService.deletePersonalActivityItem(req.params.itemId, req.user!.userId);
      res.json({ success: true });
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.post(
  '/me/collections/activities/:itemId/save-as-route',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const route = await activitiesService.saveActivityAsRoute(req.params.itemId, req.user!.userId);
      res.status(201).json(route);
    } catch (err) { next(err); }
  },
);

// ─── Own Event Categories ───

personalCollectionsRoutes.get(
  '/me/collections/events/categories',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await service.listPersonalEventCategories(req.user!.userId);
      res.json(categories);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.post(
  '/me/collections/events/categories',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = validation.createPersonalEventCategorySchema.parse(req.body);
      const category = await service.createPersonalEventCategory(req.user!.userId, data);
      res.status(201).json(category);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.patch(
  '/me/collections/events/categories/:categoryId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = validation.updatePersonalEventCategorySchema.parse(req.body);
      const category = await service.updatePersonalEventCategory(req.params.categoryId, req.user!.userId, data);
      res.json(category);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.delete(
  '/me/collections/events/categories/:categoryId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await service.deletePersonalEventCategory(req.params.categoryId, req.user!.userId);
      res.json({ success: true });
    } catch (err) { next(err); }
  },
);

// ─── Own Events ───

personalCollectionsRoutes.get(
  '/me/collections/events',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = validation.personalEventsQuerySchema.parse(req.query);
      const items = await service.listPersonalEvents(
        req.user!.userId,
        req.user!.userId,
        { from: query.from, to: query.to, limit: query.limit, visibility: query.visibility },
      );
      res.json(items);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.post(
  '/me/collections/events',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = validation.createPersonalEventSchema.parse(req.body);
      const event = await service.createPersonalEvent(req.user!.userId, data);
      res.status(201).json(event);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.patch(
  '/me/collections/events/:eventId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = validation.updatePersonalEventSchema.parse(req.body);
      const event = await service.updatePersonalEvent(req.params.eventId, req.user!.userId, data);
      res.json(event);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.delete(
  '/me/collections/events/:eventId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await service.deletePersonalEvent(req.params.eventId, req.user!.userId);
      res.json({ success: true });
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.post(
  '/me/collections/events/:eventId/copy',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { spaceId, channelId } = validation.copyToSpaceSchema.parse(req.body);
      const userId = req.user!.userId;

      const isMember = await spacesService.isMember(spaceId, userId);
      if (!isMember) return next(new ForbiddenError('Not a member of this space'));

      const result = await service.copyEventToSpace(req.params.eventId, spaceId, userId, channelId);
      res.status(201).json(result);
    } catch (err) { next(err); }
  },
);

// ─── Personal Event Meeting Rooms ───

personalCollectionsRoutes.post(
  '/me/collections/events/:eventId/room/join',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientDate = req.body.date as string | undefined;
      const result = await service.joinPersonalEventRoom(req.params.eventId, req.user!.userId, clientDate);
      res.json(result);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.post(
  '/me/collections/events/:eventId/room/leave',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await service.leavePersonalEventRoom(req.params.eventId, req.user!.userId);
      res.status(204).end();
    } catch (err) { next(err); }
  },
);

// ─── Own Summary ───

personalCollectionsRoutes.get(
  '/me/collections/summary',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const summary = await service.getCollectionsSummary(req.user!.userId, req.user!.userId);
      res.json(summary);
    } catch (err) { next(err); }
  },
);

// ─── Aggregated Upcoming Events ───

personalCollectionsRoutes.get(
  '/me/events/upcoming',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const events = await calendarService.listUpcomingEventsForUser(req.user!.userId, limit);
      res.json(events);
    } catch (err) { next(err); }
  },
);

// ─── Aggregated Recent Blog & Newsletter Posts ───

personalCollectionsRoutes.get(
  '/me/posts/recent',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 30);
      const [blogPosts, newsletters] = await Promise.all([
        blogService.listRecentPostsForUser(req.user!.userId, limit),
        newsletterService.listRecentNewslettersForUser(req.user!.userId, limit),
      ]);

      // Merge and sort by ID descending (most recent first)
      const items = [
        ...blogPosts.map((p: any) => ({ ...p, itemType: 'blog' as const })),
        ...newsletters.map((n: any) => ({ ...n, itemType: 'newsletter' as const })),
      ].sort((a, b) => (b.id > a.id ? 1 : b.id < a.id ? -1 : 0))
       .slice(0, limit);

      res.json(items);
    } catch (err) { next(err); }
  },
);

// ─── Own Posts ───

personalCollectionsRoutes.get(
  '/me/posts',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = validation.userPostsQuerySchema.parse(req.query);
      const posts = await postsService.listPosts(
        req.user!.userId,
        req.user!.userId,
        { before: query.before, limit: query.limit },
      );
      res.json(posts);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.post(
  '/me/posts',
  handleUpload('files', 20),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const uploadedFiles = (req.files as Express.Multer.File[]) || [];

      // Parse JSON arrays from form data
      let taggedUserIds: string[] = [];
      let existingGalleryItemIds: string[] = [];
      let existingRouteItemIds: string[] = [];

      try { if (req.body.taggedUserIds) taggedUserIds = JSON.parse(req.body.taggedUserIds); } catch {}
      try { if (req.body.existingGalleryItemIds) existingGalleryItemIds = JSON.parse(req.body.existingGalleryItemIds); } catch {}
      try { if (req.body.existingRouteItemIds) existingRouteItemIds = JSON.parse(req.body.existingRouteItemIds); } catch {}

      const body = validation.createUserPostSchema.parse({
        ...req.body,
        taggedUserIds,
        existingGalleryItemIds,
        existingRouteItemIds,
      });

      // Must have body or at least one attachment/existing item
      if (!body.body?.trim() && uploadedFiles.length === 0 && !existingGalleryItemIds.length && !existingRouteItemIds.length) {
        return next(new BadRequestError('Post must have text or at least one attachment'));
      }

      // Extract spaceId from body/form data
      const spaceId = req.body.spaceId || body.spaceId;
      const post = await postsService.createPost(req.user!.userId, { ...body, spaceId }, uploadedFiles);
      res.status(201).json(post);
    } catch (err) { next(err); }
  },
);

// ─── Pin/Unpin Posts ───

personalCollectionsRoutes.put(
  '/me/posts/:postId/pin',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const post = await postsService.pinPost(req.params.postId, req.user!.userId);
      res.json(post);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.delete(
  '/me/posts/:postId/pin',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const post = await postsService.unpinPost(req.params.postId, req.user!.userId);
      res.json(post);
    } catch (err) { next(err); }
  },
);

// ─── Repost (must be before :postId routes) ───

personalCollectionsRoutes.post(
  '/me/posts/repost',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = validation.createRepostSchema.parse(req.body);
      const post = await postsService.createRepost(req.user!.userId, data.originalPostId, {
        visibility: data.visibility,
        body: data.body,
      });
      res.status(201).json(post);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.patch(
  '/me/posts/:postId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = validation.updateUserPostSchema.parse(req.body);
      const post = await postsService.updatePost(req.params.postId, req.user!.userId, data);
      res.json(post);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.delete(
  '/me/posts/:postId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await postsService.deletePost(req.params.postId, req.user!.userId);
      res.json({ success: true });
    } catch (err) { next(err); }
  },
);

// ─── Share Post to DM ───

personalCollectionsRoutes.post(
  '/me/posts/:postId/share-to-dm',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationId } = req.body;
      if (!conversationId) return next(new BadRequestError('conversationId is required'));
      const userId = req.user!.userId;

      const dmService = await import('../dm/dm.service.js');
      const isMember = await dmService.isConversationMember(conversationId, userId);
      if (!isMember) return next(new ForbiddenError('Not a member of this conversation'));

      const message = await postsService.sharePostToDM(req.params.postId, userId, conversationId);
      res.status(201).json(message);
    } catch (err) { next(err); }
  },
);

// ─── Share Gallery to DM ───

personalCollectionsRoutes.post(
  '/me/collections/galleries/:itemId/share-to-dm',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationId } = req.body;
      if (!conversationId) return next(new BadRequestError('conversationId is required'));
      const userId = req.user!.userId;

      const dmService = await import('../dm/dm.service.js');
      const isMember = await dmService.isConversationMember(conversationId, userId);
      if (!isMember) return next(new ForbiddenError('Not a member of this conversation'));

      const message = await service.shareGalleryToDM(req.params.itemId, userId, conversationId);
      res.status(201).json(message);
    } catch (err) { next(err); }
  },
);

// ─── Share Route to DM ───

personalCollectionsRoutes.post(
  '/me/collections/routes/:itemId/share-to-dm',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationId } = req.body;
      if (!conversationId) return next(new BadRequestError('conversationId is required'));
      const userId = req.user!.userId;

      const dmService = await import('../dm/dm.service.js');
      const isMember = await dmService.isConversationMember(conversationId, userId);
      if (!isMember) return next(new ForbiddenError('Not a member of this conversation'));

      const message = await service.shareRouteToDM(req.params.itemId, userId, conversationId);
      res.status(201).json(message);
    } catch (err) { next(err); }
  },
);

// ─── Share Event to DM ───

personalCollectionsRoutes.post(
  '/me/collections/events/:eventId/share-to-dm',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationId } = req.body;
      if (!conversationId) return next(new BadRequestError('conversationId is required'));
      const userId = req.user!.userId;

      const dmService = await import('../dm/dm.service.js');
      const isMember = await dmService.isConversationMember(conversationId, userId);
      if (!isMember) return next(new ForbiddenError('Not a member of this conversation'));

      const message = await service.shareEventToDM(req.params.eventId, userId, conversationId);
      res.status(201).json(message);
    } catch (err) { next(err); }
  },
);

// ─── Share Post to Channel ───

personalCollectionsRoutes.post(
  '/me/posts/:postId/share-to-channel',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { channelId, content } = validation.sharePostToChannelSchema.parse(req.body);
      const userId = req.user!.userId;

      // Verify membership and permissions
      const spaceId = await getChannelSpaceId(channelId);
      const isMember = await spacesService.isMember(spaceId, userId);
      if (!isMember) return next(new ForbiddenError('Not a member of this space'));

      const perms = await computeChannelPermissions(spaceId, channelId, userId);
      if (!hasPermission(perms, Permissions.SEND_MESSAGES)) {
        return next(new ForbiddenError('Missing SEND_MESSAGES permission'));
      }

      const message = await postsService.sharePostToChannel(req.params.postId, userId, channelId, content);
      res.status(201).json(message);
    } catch (err) { next(err); }
  },
);

// ─── Own Post Reactions ───

personalCollectionsRoutes.put(
  '/me/posts/:postId/reactions/:emoji',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reactions = await postsService.addPostReaction(req.params.postId, req.user!.userId, decodeURIComponent(req.params.emoji));
      res.json(reactions);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.delete(
  '/me/posts/:postId/reactions/:emoji',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reactions = await postsService.removePostReaction(req.params.postId, req.user!.userId, decodeURIComponent(req.params.emoji));
      res.json(reactions);
    } catch (err) { next(err); }
  },
);

// ─── Own Post Comments ───

personalCollectionsRoutes.get(
  '/me/posts/:postId/comments',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = validation.postCommentsQuerySchema.parse(req.query);
      const comments = await postsService.listComments(req.params.postId, { before: query.before, limit: query.limit });
      res.json(comments);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.post(
  '/me/posts/:postId/comments',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { body, parentCommentId, spaceId } = validation.createPostCommentSchema.parse(req.body);
      const comment = await postsService.createComment(req.params.postId, req.user!.userId, body, parentCommentId, spaceId);
      res.status(201).json(comment);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.delete(
  '/me/posts/:postId/comments/:commentId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await postsService.deleteComment(req.params.commentId, req.user!.userId);
      res.json({ success: true });
    } catch (err) { next(err); }
  },
);

// ─── Comment Reactions ───

personalCollectionsRoutes.put(
  '/posts/comments/:commentId/reactions/:emoji',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reactions = await postsService.addCommentReaction(req.params.commentId, req.user!.userId, decodeURIComponent(req.params.emoji));
      res.json(reactions);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.delete(
  '/posts/comments/:commentId/reactions/:emoji',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reactions = await postsService.removeCommentReaction(req.params.commentId, req.user!.userId, decodeURIComponent(req.params.emoji));
      res.json(reactions);
    } catch (err) { next(err); }
  },
);

// ─── Profile Access Gate (for /:userId/* routes) ───
// Only match numeric snowflake IDs to avoid intercepting /me, /preferences, /mutes, etc.

personalCollectionsRoutes.use(
  '/:userId(\\d+)',
  async (req: Request, res: Response, next: NextFunction) => {
    // Skip own-content routes (handled by /me/* above)
    if (req.params.userId === req.user!.userId) return next();
    try {
      const canView = await canViewProfile(req.params.userId, req.user!.userId);
      if (!canView) {
        res.json({ profilePrivate: true });
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  },
);

// ─── Public Profile Collections ───

personalCollectionsRoutes.get(
  '/:userId/collections/summary',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const summary = await service.getCollectionsSummary(req.params.userId, req.user!.userId);
      res.json(summary);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.get(
  '/:userId/collections/gallery',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = validation.personalCollectionsQuerySchema.parse(req.query);
      const items = await service.listPersonalGalleryItems(
        req.params.userId,
        req.user!.userId,
        { before: query.before, limit: query.limit, visibility: query.visibility },
      );
      res.json(items);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.get(
  '/:userId/collections/routes',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = validation.personalCollectionsQuerySchema.parse(req.query);
      const items = await service.listPersonalRouteItems(
        req.params.userId,
        req.user!.userId,
        { before: query.before, limit: query.limit, visibility: query.visibility },
      );
      res.json(items);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.get(
  '/:userId/collections/activities',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = validation.personalActivitiesQuerySchema.parse(req.query);
      const items = await activitiesService.listPersonalActivityItems(
        req.params.userId,
        req.user!.userId,
        { before: query.before, limit: query.limit, visibility: query.visibility, activityType: query.activityType },
      );
      res.json(items);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.get(
  '/:userId/collections/activities/stats',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = validation.activityStatsQuerySchema.parse(req.query);
      const stats = await activitiesService.getActivityStats(
        req.params.userId,
        req.user!.userId,
        { period: query.period, year: query.year },
      );
      res.json(stats);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.get(
  '/:userId/collections/events',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = validation.personalEventsQuerySchema.parse(req.query);
      const items = await service.listPersonalEvents(
        req.params.userId,
        req.user!.userId,
        { from: query.from, to: query.to, limit: query.limit, visibility: query.visibility },
      );
      res.json(items);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.get(
  '/:userId/posts',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = validation.userPostsQuerySchema.parse(req.query);
      const posts = await postsService.listPosts(
        req.params.userId,
        req.user!.userId,
        { before: query.before, limit: query.limit },
      );
      res.json(posts);
    } catch (err) { next(err); }
  },
);

// ─── Other User's Post Reactions ───

personalCollectionsRoutes.put(
  '/:userId/posts/:postId/reactions/:emoji',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reactions = await postsService.addPostReaction(req.params.postId, req.user!.userId, decodeURIComponent(req.params.emoji));
      res.json(reactions);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.delete(
  '/:userId/posts/:postId/reactions/:emoji',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reactions = await postsService.removePostReaction(req.params.postId, req.user!.userId, decodeURIComponent(req.params.emoji));
      res.json(reactions);
    } catch (err) { next(err); }
  },
);

// ─── Other User's Post Comments ───

personalCollectionsRoutes.get(
  '/:userId/posts/:postId/comments',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = validation.postCommentsQuerySchema.parse(req.query);
      const comments = await postsService.listComments(req.params.postId, { before: query.before, limit: query.limit });
      res.json(comments);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.post(
  '/:userId/posts/:postId/comments',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { body, parentCommentId, spaceId } = validation.createPostCommentSchema.parse(req.body);
      const comment = await postsService.createComment(req.params.postId, req.user!.userId, body, parentCommentId, spaceId);
      res.status(201).json(comment);
    } catch (err) { next(err); }
  },
);

personalCollectionsRoutes.delete(
  '/:userId/posts/:postId/comments/:commentId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await postsService.deleteComment(req.params.commentId, req.user!.userId);
      res.json({ success: true });
    } catch (err) { next(err); }
  },
);
