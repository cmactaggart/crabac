import { Router, type Request, type Response, type NextFunction } from 'express';
import path from 'path';
import { optionalAuthenticate, requirePublicBoard, requireBoardAuth, requireReadAccess } from './boards.middleware.js';
import * as boardsService from './boards.service.js';
import * as forumsService from '../forums/forums.service.js';
import * as calendarService from '../calendar/calendar.service.js';
import * as routeLibraryService from '../route-library/route-library.service.js';
import * as blogService from '../blog/blog.service.js';
import * as messagesService from '../messages/messages.service.js';
import { parseGpxFile } from '../messages/gpx.service.js';
import { handleMulterUpload, VIDEO_EXTENSIONS } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import { validation } from '@crabac/shared';
import { BadRequestError } from '../../lib/errors.js';

export const boardsRoutes = Router();

// All board routes use optional auth
boardsRoutes.use(optionalAuthenticate);

// ─── Public Calendar ───

// Get public calendar space info + categories
boardsRoutes.get(
  '/calendar/:spaceSlug',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await boardsService.getPublicCalendarSpace(req.params.spaceSlug);
      // Check anonymous access
      if (!req.user && !data.allowAnonymousBrowsing) {
        return res.status(401).json({ error: { message: 'Authentication required' } });
      }
      res.json({ space: data.space, categories: data.categories });
    } catch (err) {
      next(err);
    }
  },
);

// Get public calendar events
boardsRoutes.get(
  '/calendar/:spaceSlug/events',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await boardsService.getPublicCalendarSpace(req.params.spaceSlug);
      // Check anonymous access
      if (!req.user && !data.allowAnonymousBrowsing) {
        return res.status(401).json({ error: { message: 'Authentication required' } });
      }

      const { from, to } = req.query as { from?: string; to?: string };
      if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        return res.status(400).json({ error: { message: 'Invalid from/to date parameters' } });
      }

      // If authenticated user is a space member, show all events; otherwise public only
      let isMember = false;
      if (req.user) {
        isMember = await boardsService.isSpaceMember(String(data.space.id), req.user.userId);
      }

      const events = isMember
        ? await calendarService.listEvents(String(data.space.id), from, to, req.user?.userId)
        : await calendarService.listPublicEvents(String(data.space.id), from, to);

      res.json(events);
    } catch (err) {
      next(err);
    }
  },
);

// iCal feed for public calendar
boardsRoutes.get(
  '/calendar/:spaceSlug/feed.ics',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await boardsService.getPublicCalendarSpace(req.params.spaceSlug);

      // ICS feeds should work without auth for calendar app subscriptions
      const isMember = req.user
        ? await boardsService.isSpaceMember(String(data.space.id), req.user.userId)
        : false;

      // Fetch events for a wide window: 6 months back, 12 months forward
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString().split('T')[0];
      const to = new Date(now.getFullYear(), now.getMonth() + 12, 0).toISOString().split('T')[0];

      const events = isMember
        ? await calendarService.listEvents(String(data.space.id), from, to, req.user?.userId)
        : await calendarService.listPublicEvents(String(data.space.id), from, to);

      const ics = generateIcs(data.space, events);
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', `inline; filename="${data.space.slug}-calendar.ics"`);
      res.send(ics);
    } catch (err) {
      next(err);
    }
  },
);

// ─── Public Blog ───

// RSS feed for public blog
boardsRoutes.get(
  '/blog/:spaceSlug/feed.xml',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const space = await boardsService.getPublicSpace(req.params.spaceSlug);
      const settings = await (await import('../../database/connection.js')).db('space_settings').where('space_id', space.id).first();
      if (!settings?.allow_public_blog) {
        return res.status(404).json({ error: { message: 'Blog not available' } });
      }
      const posts = await blogService.listPublicPosts(String(space.id), { limit: 50 });
      const { config } = await import('../../config.js');
      const blogUrl = `${config.appUrl}/blog/${space.slug}`;
      const feedUrl = `${config.apiUrl}/api/boards/blog/${space.slug}/feed.xml`;

      const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

      const items = posts.map((post: any) => {
        const postUrl = `${config.appUrl}/blog/${space.slug}/${post.id}`;
        return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
      <dc:creator>${escapeXml(post.author?.displayName || post.author?.username || 'Unknown')}</dc:creator>${post.summary ? `\n      <description>${escapeXml(post.summary)}</description>` : ''}
    </item>`;
      }).join('\n');

      const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(space.name)}</title>
    <link>${blogUrl}</link>
    <description>${escapeXml(space.description || `Blog posts from ${space.name}`)}</description>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml" />
    <language>en</language>
    <lastBuildDate>${posts.length > 0 ? new Date(posts[0].publishedAt).toUTCString() : new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

      res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
      res.send(rss);
    } catch (err) {
      next(err);
    }
  },
);

boardsRoutes.get(
  '/blog/:spaceSlug',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const space = await boardsService.getPublicSpace(req.params.spaceSlug);
      const settings = await (await import('../../database/connection.js')).db('space_settings').where('space_id', space.id).first();
      if (!settings?.allow_public_blog) {
        return res.status(404).json({ error: { message: 'Blog not available' } });
      }
      if (!req.user && (!settings || !settings.allow_anonymous_browsing)) {
        return res.status(401).json({ error: { message: 'Authentication required' } });
      }
      const { before, limit } = req.query as any;
      const posts = await blogService.listPublicPosts(String(space.id), {
        before,
        limit: Math.min(parseInt(limit) || 20, 50),
      });
      res.json({ space, posts });
    } catch (err) {
      next(err);
    }
  },
);

boardsRoutes.get(
  '/blog/:spaceSlug/:postId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const space = await boardsService.getPublicSpace(req.params.spaceSlug);
      const settings = await (await import('../../database/connection.js')).db('space_settings').where('space_id', space.id).first();
      if (!settings?.allow_public_blog) {
        return res.status(404).json({ error: { message: 'Blog not available' } });
      }
      if (!req.user && (!settings || !settings.allow_anonymous_browsing)) {
        return res.status(401).json({ error: { message: 'Authentication required' } });
      }
      const post = await blogService.getPublicPost(req.params.postId);
      res.json({ space, post });
    } catch (err) {
      next(err);
    }
  },
);

// Public site config (features, nav links, theme) for all public page types
boardsRoutes.get(
  '/site-config/:spaceSlug',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await boardsService.getPublicSiteConfig(req.params.spaceSlug);
      res.json(data);
    } catch (err) {
      next(err);
    }
  },
);

// List public channels for a space
boardsRoutes.get(
  '/:spaceSlug',
  requirePublicBoard,
  requireReadAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const space = (req as any).boardSpace;
      const channels = await boardsService.listPublicChannels(String(space.id));
      res.json({
        space: {
          id: space.id,
          name: space.name,
          slug: space.slug,
          description: space.description,
          iconUrl: space.icon_url,
          publicTheme: (req as any).boardSettings?.public_theme || null,
        },
        channels,
      });
    } catch (err) {
      next(err);
    }
  },
);

// List items in a public gallery channel (must be before /:channelName/:threadId)
boardsRoutes.get(
  '/:spaceSlug/:channelName/gallery',
  requirePublicBoard,
  requireReadAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const channel = (req as any).boardChannel;
      if (channel.type !== 'media_gallery') {
        return res.status(404).json({ error: { message: 'Not a gallery channel' } });
      }
      const { before, limit } = req.query as any;
      const items = await boardsService.listPublicGalleryItems(String(channel.id), {
        before,
        limit: Math.min(parseInt(limit) || 30, 100),
      });
      res.json(items);
    } catch (err) {
      next(err);
    }
  },
);

// ─── Public Route Library ───

// List ALL public routes across all route_library channels in a space
boardsRoutes.get(
  '/:spaceSlug/all-routes',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const space = await boardsService.getPublicSpace(req.params.spaceSlug);
      // Check read access
      const settings = await (await import('../../database/connection.js')).db('space_settings').where('space_id', space.id).first();
      if (!req.user && (!settings || !settings.allow_anonymous_browsing)) {
        return res.status(401).json({ error: { message: 'Authentication required' } });
      }
      const parsed = validation.routesQuerySchema.parse(req.query);
      const channelId = req.query.channelId as string | undefined;
      const data = await boardsService.listAllPublicRouteItems(String(space.id), {
        ...parsed,
        channelId,
        userId: req.user?.userId,
      });
      res.json(data);
    } catch (err) {
      next(err);
    }
  },
);

// List public route items
boardsRoutes.get(
  '/:spaceSlug/:channelName/routes',
  requirePublicBoard,
  requireReadAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const channel = (req as any).boardChannel;
      if (channel.type !== 'route_library') {
        return res.status(404).json({ error: { message: 'Not a route library channel' } });
      }
      const parsed = validation.routesQuerySchema.parse(req.query);
      const items = await boardsService.listPublicRouteItems(String(channel.id), {
        ...parsed,
        userId: req.user?.userId,
      });
      res.json(items);
    } catch (err) {
      next(err);
    }
  },
);

// Get public route categories for a space
boardsRoutes.get(
  '/:spaceSlug/:channelName/route-categories',
  requirePublicBoard,
  requireReadAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const space = (req as any).boardSpace;
      const categories = await boardsService.listPublicRouteCategories(String(space.id));
      res.json(categories);
    } catch (err) {
      next(err);
    }
  },
);

// Star a public route (requires auth)
boardsRoutes.post(
  '/:spaceSlug/:channelName/routes/:routeId/star',
  requirePublicBoard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: { message: 'Authentication required to star routes' } });
      }
      await routeLibraryService.starRoute(req.user.userId, req.params.routeId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

// Unstar a public route (requires auth)
boardsRoutes.delete(
  '/:spaceSlug/:channelName/routes/:routeId/star',
  requirePublicBoard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: { message: 'Authentication required' } });
      }
      await routeLibraryService.unstarRoute(req.user.userId, req.params.routeId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

// Create thread with attachments (requires auth) - must be before /:channelName/:threadId
boardsRoutes.post(
  '/:spaceSlug/:channelName/threads/upload',
  requirePublicBoard,
  requireBoardAuth,
  handleMulterUpload,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const channel = (req as any).boardChannel;
      const title = (req.body.title || '').trim();
      const content = (req.body.content || '').trim();
      if (!title || title.length > 200) {
        return next(new BadRequestError('Title is required and must be under 200 characters'));
      }
      if (!content || content.length > 4000) {
        return next(new BadRequestError('Content is required and must be under 4000 characters'));
      }

      const uploadedFiles = (req.files as Express.Multer.File[]) || [];
      for (const file of uploadedFiles) {
        const ext = path.extname(file.originalname).toLowerCase();
        const isVideo = file.mimetype.startsWith('video/') || VIDEO_EXTENSIONS.has(ext);
        if (!isVideo && file.size > 10 * 1024 * 1024) {
          return next(new BadRequestError(`File "${file.originalname}" exceeds 10MB limit`));
        }
      }

      const { thread, openingPostId } = await forumsService.createThread(
        String(channel.id),
        req.user!.userId,
        { title, content },
      );

      for (const file of uploadedFiles) {
        let metadata: Record<string, any> | null = null;
        if (file.originalname.toLowerCase().endsWith('.gpx')) {
          const gpx = await parseGpxFile(file.path);
          if (gpx) metadata = { gpx };
        }
        await messagesService.createAttachment(
          openingPostId,
          {
            filename: file.filename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            url: `/uploads/${file.filename}`,
          },
          metadata,
        );
      }

      res.status(201).json(thread);
    } catch (err) {
      next(err);
    }
  },
);

// Create post with attachments (requires auth)
boardsRoutes.post(
  '/:spaceSlug/:channelName/:threadId/posts/upload',
  requirePublicBoard,
  requireBoardAuth,
  handleMulterUpload,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const content = (req.body.content || '').trim();
      const uploadedFiles = (req.files as Express.Multer.File[]) || [];

      if (!content && uploadedFiles.length === 0) {
        return next(new BadRequestError('Post must have content or at least one file'));
      }
      if (content.length > 4000) {
        return next(new BadRequestError('Content must be under 4000 characters'));
      }

      for (const file of uploadedFiles) {
        const ext = path.extname(file.originalname).toLowerCase();
        const isVideo = file.mimetype.startsWith('video/') || VIDEO_EXTENSIONS.has(ext);
        if (!isVideo && file.size > 10 * 1024 * 1024) {
          return next(new BadRequestError(`File "${file.originalname}" exceeds 10MB limit`));
        }
      }

      const post = await forumsService.createThreadPost(
        req.params.threadId,
        req.user!.userId,
        { content, replyToId: req.body.replyToId },
      );

      for (const file of uploadedFiles) {
        let metadata: Record<string, any> | null = null;
        if (file.originalname.toLowerCase().endsWith('.gpx')) {
          const gpx = await parseGpxFile(file.path);
          if (gpx) metadata = { gpx };
        }
        await messagesService.createAttachment(
          post.id,
          {
            filename: file.filename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            url: `/uploads/${file.filename}`,
          },
          metadata,
        );
      }

      // Re-fetch post with attachments
      const posts = await forumsService.listThreadPosts(req.params.threadId, { limit: 50 });
      const fullPost = posts.find((p: any) => p.id === post.id) || post;
      res.status(201).json(fullPost);
    } catch (err) {
      next(err);
    }
  },
);

// Create thread (requires auth) - must be before /:channelName/:threadId
boardsRoutes.post(
  '/:spaceSlug/:channelName/threads',
  requirePublicBoard,
  requireBoardAuth,
  validate(validation.createThreadSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const channel = (req as any).boardChannel;
      const { thread } = await forumsService.createThread(
        String(channel.id),
        req.user!.userId,
        req.body,
      );
      res.status(201).json(thread);
    } catch (err) {
      next(err);
    }
  },
);

// List threads in a public board channel
boardsRoutes.get(
  '/:spaceSlug/:channelName',
  requirePublicBoard,
  requireReadAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const channel = (req as any).boardChannel;
      const { before, limit, sort } = req.query as any;
      const threads = await forumsService.listThreads(String(channel.id), {
        before,
        limit: Math.min(parseInt(limit) || 30, 100),
        sort: sort === 'newest' ? 'newest' : 'latest',
      });
      res.json(threads);
    } catch (err) {
      next(err);
    }
  },
);

// Get thread + posts
boardsRoutes.get(
  '/:spaceSlug/:channelName/:threadId',
  requirePublicBoard,
  requireReadAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const thread = await forumsService.getThread(req.params.threadId);
      const { before, limit } = req.query as any;
      const posts = await forumsService.listThreadPosts(req.params.threadId, {
        before,
        limit: Math.min(parseInt(limit) || 50, 100),
      });
      res.json({ thread, posts });
    } catch (err) {
      next(err);
    }
  },
);

// Create post in thread (requires auth)
boardsRoutes.post(
  '/:spaceSlug/:channelName/:threadId/posts',
  requirePublicBoard,
  requireBoardAuth,
  validate(validation.createThreadPostSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const post = await forumsService.createThreadPost(
        req.params.threadId,
        req.user!.userId,
        req.body,
      );
      res.status(201).json(post);
    } catch (err) {
      next(err);
    }
  },
);

// ─── ICS Helper ───

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function foldLine(line: string): string {
  // RFC 5545: lines must be <= 75 octets; fold with CRLF + space
  const parts: string[] = [];
  while (line.length > 75) {
    parts.push(line.substring(0, 75));
    line = ' ' + line.substring(75);
  }
  parts.push(line);
  return parts.join('\r\n');
}

function generateIcs(
  space: { id: any; name: string; slug: string },
  events: any[],
): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//crab.ac//${escapeIcs(space.name)}//EN`,
    `X-WR-CALNAME:${escapeIcs(space.name)}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const event of events) {
    const uid = `${event.id}@crab.ac`;
    const dateStr = (event.eventDate || '').replace(/-/g, '');

    let dtStart: string;
    let dtEnd: string;
    if (event.eventTime) {
      // Timed event — use DATETIME (treat as floating local time since we don't store timezone)
      const timePart = event.eventTime.replace(':', '') + '00';
      dtStart = `${dateStr}T${timePart}`;
      // Default to 2-hour duration
      const [h, m] = event.eventTime.split(':').map(Number);
      const endMinutes = h * 60 + m + 120;
      const eh = String(Math.floor(endMinutes / 60) % 24).padStart(2, '0');
      const em = String(endMinutes % 60).padStart(2, '0');
      dtEnd = `${dateStr}T${eh}${em}00`;
    } else {
      // All-day event
      dtStart = dateStr;
      // All-day DTEND is exclusive, so next day
      const d = new Date(event.eventDate + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      dtEnd = d.toISOString().split('T')[0].replace(/-/g, '');
    }

    lines.push('BEGIN:VEVENT');
    lines.push(foldLine(`UID:${uid}`));

    if (event.eventTime) {
      lines.push(foldLine(`DTSTART:${dtStart}`));
      lines.push(foldLine(`DTEND:${dtEnd}`));
    } else {
      lines.push(foldLine(`DTSTART;VALUE=DATE:${dtStart}`));
      lines.push(foldLine(`DTEND;VALUE=DATE:${dtEnd}`));
    }

    lines.push(foldLine(`SUMMARY:${escapeIcs(event.name)}`));

    if (event.description) {
      lines.push(foldLine(`DESCRIPTION:${escapeIcs(event.description)}`));
    }
    if (event.location) {
      lines.push(foldLine(`LOCATION:${escapeIcs(event.location)}`));
    }

    // Created/modified timestamps
    if (event.createdAt) {
      const stamp = new Date(event.createdAt).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
      lines.push(foldLine(`DTSTAMP:${stamp}`));
    }

    if (event.category?.name) {
      lines.push(foldLine(`CATEGORIES:${escapeIcs(event.category.name)}`));
    }

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
