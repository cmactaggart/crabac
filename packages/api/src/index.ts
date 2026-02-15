import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { errorHandler } from './middleware/error-handler.js';
import { apiLimiter } from './middleware/rate-limiter.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { usersRoutes } from './modules/users/users.routes.js';
import { spacesRoutes } from './modules/spaces/spaces.routes.js';
import { channelsRoutes } from './modules/channels/channels.routes.js';
import { categoriesRoutes } from './modules/channels/categories.routes.js';
import { messagesRoutes } from './modules/messages/messages.routes.js';
import { rbacRoutes } from './modules/rbac/rbac.routes.js';
import { inviteRoutes } from './modules/spaces/invites.routes.js';
import { dmRoutes } from './modules/dm/dm.routes.js';
import { mfaRoutes } from './modules/auth/mfa.routes.js';
import { adminRoutes, announcementRoutes } from './modules/admin/admin.routes.js';
import { portalsRoutes } from './modules/portals/portals.routes.js';
import { notificationsRoutes } from './modules/notifications/notifications.routes.js';
import { authenticate } from './modules/auth/auth.middleware.js';
import * as messagesService from './modules/messages/messages.service.js';
import * as dmService from './modules/dm/dm.service.js';
import * as spacesService from './modules/spaces/spaces.service.js';
import { NotFoundError, ForbiddenError } from './lib/errors.js';
import { createSocketServer } from './websocket/socket-server.js';
import { registerMessageGateway } from './modules/messages/messages.gateway.js';
import { registerDMGateway } from './modules/dm/dm.gateway.js';
import { registerNotificationGateway } from './modules/notifications/notifications.gateway.js';
import { friendsRoutes } from './modules/friends/friends.routes.js';
import { registerFriendsGateway } from './modules/friends/friends.gateway.js';
import { forumsRoutes } from './modules/forums/forums.routes.js';
import { calendarRoutes } from './modules/calendar/calendar.routes.js';
import { registerForumGateway } from './modules/forums/forums.gateway.js';
import { galleriesRoutes } from './modules/galleries/galleries.routes.js';
import { registerGalleryGateway } from './modules/galleries/galleries.gateway.js';
import { boardsRoutes } from './modules/boards/boards.routes.js';
import { boardAuthRoutes } from './modules/boards/board-auth.routes.js';
import { publicSpacesRoutes } from './modules/spaces/public-spaces.routes.js';
import { publicBoardLimiter, publicBoardPostLimiter } from './middleware/rate-limiter.js';
import { redis } from './lib/redis.js';
import { loadPlugins, getLoadedPlugins } from './plugins/loader.js';
import { db } from './database/connection.js';
import { eventBus } from './lib/event-bus.js';

const app = express();
const httpServer = createServer(app);

// Trust the first proxy (Caddy) so req.ip reflects the real client IP
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());
app.use('/api', apiLimiter);

// Serve uploaded files with security headers
const SAFE_INLINE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
app.use('/uploads', (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'");
  res.setHeader('X-Frame-Options', 'DENY');
  // Force download for anything that isn't a safe raster image (SVGs can contain JS)
  const ext = req.path.split('.').pop()?.toLowerCase();
  const mime = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  }[ext || ''];
  if (!mime || !SAFE_INLINE_TYPES.has(mime)) {
    res.setHeader('Content-Disposition', 'attachment');
  }
  next();
}, express.static(config.uploadsDir));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/spaces', publicSpacesRoutes);
app.use('/api/spaces', spacesRoutes);
app.use('/api/spaces', channelsRoutes);
app.use('/api/spaces', categoriesRoutes);
app.use('/api/channels', messagesRoutes);
app.use('/api/spaces', rbacRoutes);
app.use('/api/spaces', inviteRoutes);
app.use('/api/conversations', dmRoutes);
app.use('/api/mfa', mfaRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/spaces', portalsRoutes);
app.use('/api/portals', portalsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/spaces', forumsRoutes);
app.use('/api/spaces', calendarRoutes);
app.use('/api/channels', galleriesRoutes);
app.use('/api/boards', publicBoardLimiter, boardsRoutes);
app.use('/api/boards/auth', boardAuthRoutes);

// Unified message lookup (for embeds)
app.get('/api/messages/:messageId', authenticate, async (req, res, next) => {
  const { messageId } = req.params;
  const userId = req.user!.userId;

  // Try channel message first
  try {
    const message = await messagesService.getMessageById(messageId);
    const isMember = await spacesService.isMember(message.spaceId, userId);
    if (!isMember) return next(new ForbiddenError('Not a member of this space'));
    res.json({ type: 'channel', ...message });
    return;
  } catch {
    // Not a channel message, try DM
  }

  try {
    const dm = await dmService.getMessageById(messageId);
    const isMember = await dmService.isConversationMember(dm.conversationId, userId);
    if (!isMember) return next(new ForbiddenError('Not a member of this conversation'));
    res.json({ type: 'dm', ...dm });
  } catch {
    next(new NotFoundError('Message'));
  }
});

// Plugins endpoint
app.get('/api/plugins', (_req, res) => {
  res.json({ plugins: getLoadedPlugins() });
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(errorHandler);

// Socket.io
createSocketServer(httpServer);
registerMessageGateway();
registerDMGateway();
registerNotificationGateway();
registerFriendsGateway();
registerForumGateway();
registerGalleryGateway();

// Load plugins, connect Redis, and start server
async function start() {
  await loadPlugins(app, eventBus, db);

  try {
    await redis.connect();
  } catch (err) {
    console.error('Failed to connect to Redis:', err);
  }

  httpServer.listen(config.port, () => {
    console.log(`API server running on port ${config.port}`);
  });
}

start();

export default app;
