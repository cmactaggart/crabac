import crypto from 'crypto';
import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { GUEST_PERMISSIONS } from '@crabac/shared';
import { redis } from '../../lib/redis.js';
import { io } from '../../websocket/socket-server.js';

export async function getSpaceAdminSettings(spaceId: string) {
  let settings = await db('space_settings').where('space_id', spaceId).first();

  if (!settings) {
    // Return defaults
    return {
      spaceId,
      allowPublicBoards: false,
      allowPublicGalleries: false,
      allowPublicCalendar: false,
      allowPublicRoutes: false,
      allowAnonymousBrowsing: false,
      calendarEnabled: false,
      blogEnabled: false,
      allowPublicBlog: false,
      isPublic: false,
      requireVerifiedEmail: false,
      isFeatured: false,
      baseColor: null,
      accentColor: null,
      textColor: null,
      webhooksEnabled: false,
      webhookSecret: null,
    };
  }

  return formatSettings(settings);
}

export async function updateSpaceAdminSettings(
  spaceId: string,
  data: {
    allowPublicBoards?: boolean;
    allowPublicGalleries?: boolean;
    allowPublicCalendar?: boolean;
    allowPublicRoutes?: boolean;
    allowPublicBlog?: boolean;
    allowAnonymousBrowsing?: boolean;
    calendarEnabled?: boolean;
    blogEnabled?: boolean;
    isPublic?: boolean;
    requireVerifiedEmail?: boolean;
    baseColor?: string | null;
    accentColor?: string | null;
    textColor?: string | null;
    webhooksEnabled?: boolean;
  },
) {
  const existing = await db('space_settings').where('space_id', spaceId).first();

  if (existing) {
    const updates: Record<string, any> = {};
    if (data.allowPublicBoards !== undefined) updates.allow_public_boards = data.allowPublicBoards;
    if (data.allowPublicGalleries !== undefined) updates.allow_public_galleries = data.allowPublicGalleries;
    if (data.allowPublicCalendar !== undefined) updates.allow_public_calendar = data.allowPublicCalendar;
    if (data.allowPublicRoutes !== undefined) updates.allow_public_routes = data.allowPublicRoutes;
    if (data.allowAnonymousBrowsing !== undefined) updates.allow_anonymous_browsing = data.allowAnonymousBrowsing;
    if (data.calendarEnabled !== undefined) updates.calendar_enabled = data.calendarEnabled;
    if (data.blogEnabled !== undefined) updates.blog_enabled = data.blogEnabled;
    if (data.allowPublicBlog !== undefined) updates.allow_public_blog = data.allowPublicBlog;
    if (data.isPublic !== undefined) updates.is_public = data.isPublic;
    if (data.requireVerifiedEmail !== undefined) updates.require_verified_email = data.requireVerifiedEmail;
    if (data.baseColor !== undefined) updates.base_color = data.baseColor;
    if (data.accentColor !== undefined) updates.accent_color = data.accentColor;
    if (data.textColor !== undefined) updates.text_color = data.textColor;
    if (data.webhooksEnabled !== undefined) {
      updates.webhooks_enabled = data.webhooksEnabled;
      // Auto-generate secret when webhooks are first enabled and no secret exists
      if (data.webhooksEnabled && !existing.webhook_secret) {
        updates.webhook_secret = crypto.randomBytes(32).toString('hex');
      }
    }

    if (Object.keys(updates).length > 0) {
      await db('space_settings').where('space_id', spaceId).update(updates);
    }
  } else {
    const webhookSecret = data.webhooksEnabled ? crypto.randomBytes(32).toString('hex') : null;
    await db('space_settings').insert({
      space_id: spaceId,
      allow_public_boards: data.allowPublicBoards ?? false,
      allow_public_galleries: data.allowPublicGalleries ?? false,
      allow_public_calendar: data.allowPublicCalendar ?? false,
      allow_public_routes: data.allowPublicRoutes ?? false,
      allow_anonymous_browsing: data.allowAnonymousBrowsing ?? false,
      calendar_enabled: data.calendarEnabled ?? false,
      blog_enabled: data.blogEnabled ?? false,
      allow_public_blog: data.allowPublicBlog ?? false,
      is_public: data.isPublic ?? false,
      require_verified_email: data.requireVerifiedEmail ?? false,
      base_color: data.baseColor ?? null,
      accent_color: data.accentColor ?? null,
      text_color: data.textColor ?? null,
      webhooks_enabled: data.webhooksEnabled ?? false,
      webhook_secret: webhookSecret,
    });
  }

  // Handle public toggle side effects
  if (data.isPublic === true) {
    await ensureGuestRole(spaceId);
  } else if (data.isPublic === false) {
    await clearGuestSessions(spaceId);
  }

  return getSpaceAdminSettings(spaceId);
}

/**
 * Auto-create a Guest role when space is made public (if one doesn't exist).
 */
async function ensureGuestRole(spaceId: string) {
  const existing = await db('roles')
    .where({ space_id: spaceId, is_guest: true })
    .first();
  if (existing) return;

  const id = snowflake.generate();
  await db('roles').insert({
    id,
    space_id: spaceId,
    name: 'Guest',
    position: -1,
    permissions: GUEST_PERMISSIONS.toString(),
    is_system: true,
    is_default: false,
    is_guest: true,
  });
}

/**
 * Clear all guest sessions when space is made private.
 */
async function clearGuestSessions(spaceId: string) {
  try {
    const guestKey = `space:${spaceId}:guests`;
    await redis.del(guestKey);
    if (io) {
      io.to(`space:${spaceId}`).emit('space:guests_cleared', { spaceId });
    }
  } catch {
    // Redis may not be connected during tests
  }
}

export async function rotateWebhookSecret(spaceId: string) {
  const newSecret = crypto.randomBytes(32).toString('hex');
  const existing = await db('space_settings').where('space_id', spaceId).first();
  if (existing) {
    await db('space_settings').where('space_id', spaceId).update({ webhook_secret: newSecret });
  } else {
    await db('space_settings').insert({
      space_id: spaceId,
      webhook_secret: newSecret,
    });
  }
  return getSpaceAdminSettings(spaceId);
}

function formatSettings(row: any) {
  return {
    spaceId: row.space_id,
    allowPublicBoards: row.allow_public_boards,
    allowPublicGalleries: !!row.allow_public_galleries,
    allowPublicCalendar: !!row.allow_public_calendar,
    allowPublicRoutes: !!row.allow_public_routes,
    allowAnonymousBrowsing: row.allow_anonymous_browsing,
    calendarEnabled: !!row.calendar_enabled,
    blogEnabled: !!row.blog_enabled,
    allowPublicBlog: !!row.allow_public_blog,
    isPublic: !!row.is_public,
    requireVerifiedEmail: !!row.require_verified_email,
    isFeatured: !!row.is_featured,
    baseColor: row.base_color || null,
    accentColor: row.accent_color || null,
    textColor: row.text_color || null,
    webhooksEnabled: !!row.webhooks_enabled,
    webhookSecret: row.webhook_secret || null,
  };
}
