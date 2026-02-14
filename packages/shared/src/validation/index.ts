import { z } from 'zod';

// Auth
export const registerSchema = z.object({
  email: z.string().email().max(255),
  username: z.string().min(2).max(32).regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  displayName: z.string().min(1).max(64),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// Users
export const updateUserSchema = z.object({
  displayName: z.string().min(1).max(64).optional(),
  avatarUrl: z.string().url().max(512).nullable().optional(),
  baseColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
});

// Spaces
export const createSpaceSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  description: z.string().max(1000).optional(),
});

export const updateSpaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).nullable().optional(),
  iconUrl: z.string().url().max(512).nullable().optional(),
});

export const joinSpaceSchema = z.object({
  code: z.string().min(1).max(16),
});

// Channels
export const createChannelSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Channel name can only contain lowercase letters, numbers, and hyphens'),
  topic: z.string().max(1024).optional(),
  type: z.enum(['text', 'announcement', 'read_only', 'forum']).optional(),
  isPrivate: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  categoryId: z.string().optional(),
});

export const updateChannelSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  topic: z.string().max(1024).nullable().optional(),
  type: z.enum(['text', 'announcement', 'read_only', 'forum']).optional(),
  isPublic: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

// Messages
export const createMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  replyToId: z.string().optional(),
});

export const updateMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});

export const messagesQuerySchema = z.object({
  before: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// Roles
export const createRoleSchema = z.object({
  name: z.string().min(1).max(64),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  permissions: z.string().optional(),
  position: z.number().int().min(0).optional(),
});

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  permissions: z.string().optional(),
  position: z.number().int().min(0).optional(),
});

export const setMemberRolesSchema = z.object({
  roleIds: z.array(z.string()).min(0),
});

// Channel Categories
export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  position: z.number().int().min(0).optional(),
});

// Channel/Category Reorder
export const reorderChannelsSchema = z.object({
  channels: z.array(z.object({
    channelId: z.string().min(1),
    position: z.number().int().min(0),
    categoryId: z.string().nullable().optional(),
  })).min(1).max(200),
});

export const reorderCategoriesSchema = z.object({
  categories: z.array(z.object({
    categoryId: z.string().min(1),
    position: z.number().int().min(0),
  })).min(1).max(50),
});

// Unread Tracking
export const markReadSchema = z.object({
  messageId: z.string(),
});

// Invites
export const createInviteSchema = z.object({
  maxUses: z.number().int().min(1).optional(),
  expiresInHours: z.number().int().min(1).max(720).optional(),
});

// Channel Permission Overrides
export const channelOverrideSchema = z.object({
  allow: z.string().regex(/^\d+$/, 'Must be a numeric string'),
  deny: z.string().regex(/^\d+$/, 'Must be a numeric string'),
});

// Portals
export const createPortalSchema = z.object({
  channelId: z.string().min(1),
  targetSpaceId: z.string().min(1),
});

export const submitPortalInviteSchema = z.object({
  channelId: z.string().min(1),
  targetSpaceId: z.string().min(1),
});

// Friends
export const sendFriendRequestSchema = z.object({
  userId: z.string().min(1),
});

// Group DMs
export const createGroupDMSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  participantIds: z.array(z.string().min(1)).min(1).max(9),
});

export const updateConversationSchema = z.object({
  name: z.string().min(1).max(100),
});

// Direct Messages
export const createDMSchema = z.object({
  content: z.string().min(1).max(4000),
});

export const dmQuerySchema = z.object({
  before: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// Email Verification
export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

// Magic Links
export const magicLinkSendSchema = z.object({
  email: z.string().email(),
});

export const magicLinkRedeemSchema = z.object({
  token: z.string().min(1),
});

// MFA
export const mfaVerifySchema = z.object({
  mfaToken: z.string().min(1),
  code: z.string().min(1).max(20),
});

export const totpConfirmSchema = z.object({
  code: z.string().length(6).regex(/^\d+$/),
});

export const totpDisableSchema = z.object({
  password: z.string().min(1),
});

// User Preferences
export const updateUserPreferencesSchema = z.object({
  distanceUnits: z.enum(['metric', 'imperial']).optional(),
});

// Forum Threads
export const createThreadSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(4000),
});

export const updateThreadSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  isPinned: z.boolean().optional(),
  isLocked: z.boolean().optional(),
});

export const createThreadPostSchema = z.object({
  content: z.string().min(1).max(4000),
  replyToId: z.string().optional(),
});

export const threadsQuerySchema = z.object({
  before: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  sort: z.enum(['latest', 'newest']).default('latest'),
});

// Space Admin Settings
export const updateSpaceAdminSettingsSchema = z.object({
  allowPublicBoards: z.boolean().optional(),
  allowAnonymousBrowsing: z.boolean().optional(),
  calendarEnabled: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  requireVerifiedEmail: z.boolean().optional(),
  baseColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
});

// Space Tags
export const updateSpaceTagsSchema = z.object({
  tags: z.array(z.string().min(1).max(50)).max(10),
});

// Public Spaces Directory
export const publicSpacesQuerySchema = z.object({
  search: z.string().max(100).optional(),
  tag: z.string().max(50).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// Calendar
export const createCalendarCategorySchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const updateCalendarCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const createCalendarEventSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(4000).nullable().optional(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  eventTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  categoryId: z.string().nullable().optional(),
});

export const updateCalendarEventSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).nullable().optional(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  eventTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  categoryId: z.string().nullable().optional(),
});

export const calendarEventsQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// Board Auth
export const boardRegisterSchema = z.object({
  spaceSlug: z.string().min(1),
  email: z.string().email().max(255),
  username: z.string().min(2).max(32).regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  displayName: z.string().min(1).max(64),
  password: z.string().min(8).max(128),
});

export const boardLoginSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
});
