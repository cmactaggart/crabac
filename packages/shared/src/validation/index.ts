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
  bio: z.string().max(255).nullable().optional(),
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
  type: z.enum(['text', 'announcement', 'read_only', 'forum', 'media_gallery', 'route_library']).optional(),
  isPrivate: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  categoryId: z.string().optional(),
  memberIds: z.array(z.string()).optional(),
  roleOverrides: z.array(z.string()).optional(),
});

export const updateChannelSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  topic: z.string().max(1024).nullable().optional(),
  type: z.enum(['text', 'announcement', 'read_only', 'forum', 'media_gallery', 'route_library']).optional(),
  isPublic: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

// Messages
export const createMessageSchema = z.object({
  content: z.string().min(1).max(50000),
  replyToId: z.string().optional(),
});

export const updateMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});

export const messagesQuerySchema = z.object({
  before: z.string().optional(),
  after: z.string().optional(),
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

export const addGroupDMMembersSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(9),
});

// Direct Messages
export const createDMSchema = z.object({
  content: z.string().min(1).max(50000),
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
  defaultVisibility: z.enum(['public', 'private', 'friends', 'spaces']).optional(),
  profileVisibility: z.enum(['public', 'private', 'friends', 'spaces']).optional(),
  activitiesVisibility: z.enum(['public', 'private', 'friends', 'spaces']).nullable().optional(),
  onboardingCompleted: z.boolean().optional(),
  newsletterEnabled: z.boolean().optional(),
});

// Bulk Visibility
export const bulkUpdateVisibilitySchema = z.object({
  visibility: z.enum(['public', 'private', 'friends', 'spaces']),
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
  allowPublicGalleries: z.boolean().optional(),
  allowPublicCalendar: z.boolean().optional(),
  allowPublicRoutes: z.boolean().optional(),
  allowAnonymousBrowsing: z.boolean().optional(),
  calendarEnabled: z.boolean().optional(),
  blogEnabled: z.boolean().optional(),
  allowPublicBlog: z.boolean().optional(),
  newsletterEnabled: z.boolean().optional(),
  allowPublicNewsletter: z.boolean().optional(),
  allowPublicNewsletterSubscription: z.boolean().optional(),
  newsletterTrackingEnabled: z.boolean().optional(),
  socialEnabled: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  requireVerifiedEmail: z.boolean().optional(),
  baseColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  publicTheme: z.string().max(50).nullable().optional(),
  webhooksEnabled: z.boolean().optional(),
  publicNavLinks: z.array(z.object({
    label: z.string().min(1).max(100),
    url: z.string().url().max(500),
  })).max(20).optional(),
  publicNavDisabledFeatures: z.array(
    z.enum(['boards', 'gallery', 'routes', 'calendar', 'blog', 'newsletter']),
  ).optional(),
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
  isPublic: z.boolean().optional(),
  location: z.string().max(500).nullable().optional(),
  activityType: z.enum(['ride', 'run', 'walk']).nullable().optional(),
  routeId: z.string().nullable().optional(),
  imageUrl: z.string().max(512).nullable().optional(),
});

export const updateCalendarEventSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).nullable().optional(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  eventTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  categoryId: z.string().nullable().optional(),
  isPublic: z.boolean().optional(),
  location: z.string().max(500).nullable().optional(),
  activityType: z.enum(['ride', 'run', 'walk']).nullable().optional(),
  routeId: z.string().nullable().optional(),
  imageUrl: z.string().max(512).nullable().optional(),
});

export const calendarEventsQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// Recurring Events
export const recurrenceRuleSchema = z.object({
  freq: z.enum(['weekly', 'monthly']),
  interval: z.number().int().min(1).max(52),
  byDay: z.array(z.enum(['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'])).min(1),
  bySetPos: z.number().int().min(1).max(5).optional(),
  dtstart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const createEventSeriesSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(4000).nullable().optional(),
  eventTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  categoryId: z.string().nullable().optional(),
  isPublic: z.boolean().optional(),
  location: z.string().max(500).nullable().optional(),
  activityType: z.enum(['ride', 'run', 'walk']).nullable().optional(),
  routeId: z.string().nullable().optional(),
  imageUrl: z.string().max(512).nullable().optional(),
  recurrenceRule: recurrenceRuleSchema,
});

export const updateEventSeriesSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).nullable().optional(),
  eventTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  categoryId: z.string().nullable().optional(),
  isPublic: z.boolean().optional(),
  location: z.string().max(500).nullable().optional(),
  activityType: z.enum(['ride', 'run', 'walk']).nullable().optional(),
  routeId: z.string().nullable().optional(),
  imageUrl: z.string().max(512).nullable().optional(),
  recurrenceRule: recurrenceRuleSchema.optional(),
  updateMode: z.enum(['all', 'future']).default('all'),
});

// Blog
export const createBlogPostSchema = z.object({
  title: z.string().min(1).max(500),
  summary: z.string().max(140).nullable().optional(),
  content: z.string().min(1).max(100000),
  status: z.enum(['draft', 'published']).default('draft'),
  isPublic: z.boolean().optional(),
});

export const updateBlogPostSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  summary: z.string().max(140).nullable().optional(),
  content: z.string().min(1).max(100000).optional(),
  status: z.enum(['draft', 'published']).optional(),
  isPublic: z.boolean().optional(),
});

export const blogPostsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  before: z.string().optional(),
  status: z.enum(['draft', 'published']).optional(),
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

// Route Library
export const createRouteSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  categoryId: z.string().optional(),
  isPublic: z.boolean().optional(),
  activityType: z.enum(['ride', 'run', 'walk']).nullable().optional(),
});

export const createRouteCategorySchema = z.object({
  name: z.string().min(1).max(100),
});

export const routesQuerySchema = z.object({
  before: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  search: z.string().max(200).optional(),
  category: z.string().optional(),
  author: z.string().max(200).optional(),
  type: z.enum(['ride', 'run', 'walk']).optional(),
  sort: z.enum(['name', 'distance', 'elevation', 'flatness', 'newest']).default('newest'),
  order: z.enum(['asc', 'desc']).default('desc'),
  starred: z.coerce.boolean().optional(),
});

// RSVP
export const rsvpSchema = z.object({
  status: z.enum(['going', 'maybe', 'not_going']),
});

// Route from attachment
export const createRouteFromAttachmentSchema = z.object({
  attachmentUrl: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  categoryId: z.string().optional(),
  activityType: z.enum(['ride', 'run', 'walk']).nullable().optional(),
  isPublic: z.boolean().optional(),
});

// Mobile Bundles (OTA Updates)
export const uploadMobileBundleSchema = z.object({
  platform: z.enum(['ios', 'android']),
  nativeVersion: z.string().min(1).max(20).regex(/^\d+\.\d+\.\d+$/, 'Must be a valid semver (e.g. 1.0.0)'),
  isRequired: z.coerce.boolean().optional().default(false),
  releaseNotes: z.string().max(4000).optional(),
});

export const mobileBundleUpdateCheckSchema = z.object({
  platform: z.enum(['ios', 'android']),
  nativeVersion: z.string().min(1).max(20).regex(/^\d+\.\d+\.\d+$/, 'Must be a valid semver'),
  currentBundleVersion: z.coerce.number().int().min(0),
});

export const mobileBundlesQuerySchema = z.object({
  platform: z.enum(['ios', 'android']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// Moderation: Space Bans
export const spaceBanSchema = z.object({
  reason: z.string().max(1000).optional(),
});

// Moderation: Global App Bans
export const appBanSchema = z.object({
  reason: z.string().max(1000).optional(),
});

// Moderation: Reports
export const createReportSchema = z.object({
  reportedUserId: z.string().min(1),
  spaceId: z.string().optional(),
  channelId: z.string().optional(),
  messageId: z.string().optional(),
  dmMessageId: z.string().optional(),
  conversationId: z.string().optional(),
  galleryItemId: z.string().optional(),
  routeId: z.string().optional(),
  forumPostId: z.string().optional(),
  postId: z.string().optional(),
  reason: z.string().min(1).max(2000),
});

export const updateReportSchema = z.object({
  status: z.enum(['resolved', 'dismissed']),
});

// Workflow Condition Tree (recursive AND/OR)
const conditionRuleSchema = z.object({
  type: z.enum([
    'user_has_role', 'channel_is', 'message_contains', 'message_equals',
    'command_arg_equals', 'card_field_equals', 'card_field_not_null', 'invite_code_is',
    'button_is', 'webhook_payload_equals',
  ]),
  config: z.record(z.any()),
  negate: z.boolean().optional(),
});

type ConditionGroupInput = {
  operator: 'AND' | 'OR';
  rules: Array<{ type: string; config: Record<string, any>; negate?: boolean } | ConditionGroupInput>;
};

const conditionGroupSchema: z.ZodType<ConditionGroupInput> = z.lazy(() =>
  z.object({
    operator: z.enum(['AND', 'OR']),
    rules: z.array(z.union([conditionRuleSchema, conditionGroupSchema])).min(1).max(50),
  }),
);

// Workflow action
const workflowActionSchema = z.object({
  type: z.enum([
    'send_message', 'send_admin_message', 'add_role', 'remove_role',
    'copy_images_to_gallery', 'copy_routes_to_library',
    'show_card', 'update_card', 'dismiss_card', 'send_webhook',
  ]),
  config: z.record(z.any()),
});

// Workflows
export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  triggerType: z.enum([
    'member_joined', 'message_created', 'image_uploaded',
    'gpx_uploaded', 'slash_command', 'card_interaction', 'webhook',
  ]),
  triggerConfig: z.record(z.any()).nullable().optional(),
  conditions: conditionGroupSchema.nullable().optional(),
  actions: z.array(workflowActionSchema).min(1).max(20),
  enabled: z.boolean().optional(),
});

export const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  triggerType: z.enum([
    'member_joined', 'message_created', 'image_uploaded',
    'gpx_uploaded', 'slash_command', 'card_interaction', 'webhook',
  ]).optional(),
  triggerConfig: z.record(z.any()).nullable().optional(),
  conditions: conditionGroupSchema.nullable().optional(),
  actions: z.array(workflowActionSchema).min(1).max(20).optional(),
  enabled: z.boolean().optional(),
});

// Custom Commands
export const createCustomCommandSchema = z.object({
  name: z.string().min(1).max(32).regex(/^[a-z0-9-]+$/, 'Command name must be lowercase alphanumeric with hyphens'),
  description: z.string().min(1).max(200),
  args: z.array(z.object({
    name: z.string().min(1).max(32),
    type: z.enum(['text', 'number', 'user', 'channel', 'role', 'boolean']),
    required: z.boolean(),
    description: z.string().max(200),
  })).max(10).nullable().optional(),
});

export const updateCustomCommandSchema = z.object({
  name: z.string().min(1).max(32).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().min(1).max(200).optional(),
  args: z.array(z.object({
    name: z.string().min(1).max(32),
    type: z.enum(['text', 'number', 'user', 'channel', 'role', 'boolean']),
    required: z.boolean(),
    description: z.string().max(200),
  })).max(10).nullable().optional(),
});

export const invokeCommandSchema = z.object({
  channelId: z.string().min(1),
  args: z.record(z.any()).optional(),
});

// Card Templates
export const createCardTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  titleTemplate: z.string().min(1).max(500),
  bodyTemplate: z.string().max(4000).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  fields: z.array(z.object({
    key: z.string().min(1).max(50),
    label: z.string().min(1).max(100),
    type: z.enum(['text', 'select', 'role', 'user', 'channel']),
    options: z.array(z.string().max(100)).max(20).optional(),
  })).max(10).nullable().optional(),
  buttons: z.array(z.object({
    id: z.string().min(1).max(50),
    label: z.string().min(1).max(50),
    style: z.enum(['primary', 'secondary', 'danger']),
  })).max(5).nullable().optional(),
});

export const updateCardTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  titleTemplate: z.string().min(1).max(500).optional(),
  bodyTemplate: z.string().max(4000).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  fields: z.array(z.object({
    key: z.string().min(1).max(50),
    label: z.string().min(1).max(100),
    type: z.enum(['text', 'select', 'role', 'user', 'channel']),
    options: z.array(z.string().max(100)).max(20).optional(),
  })).max(10).nullable().optional(),
  buttons: z.array(z.object({
    id: z.string().min(1).max(50),
    label: z.string().min(1).max(50),
    style: z.enum(['primary', 'secondary', 'danger']),
  })).max(5).nullable().optional(),
});

// Card Interactions
export const cardInteractionSchema = z.object({
  buttonId: z.string().min(1).max(50).optional(),
  fields: z.record(z.string().max(1000)).optional(),
});

// Workflow Execution Logs Query
export const workflowExecutionsQuerySchema = z.object({
  workflowId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().optional(),
});

// ─── Personal Collections ───

export const personalVisibilityEnum = z.enum(['public', 'private', 'friends', 'spaces']);

export const createPersonalGalleryItemSchema = z.object({
  caption: z.string().max(2000).nullable().optional(),
  visibility: personalVisibilityEnum.default('private'),
});

export const updatePersonalGalleryItemSchema = z.object({
  caption: z.string().max(2000).nullable().optional(),
  visibility: personalVisibilityEnum.optional(),
});

export const elevationQuerySchema = z.object({
  coordinates: z.array(z.tuple([z.number(), z.number()])).min(1).max(100),
});

export const routingQuerySchema = z.object({
  waypoints: z.array(z.tuple([z.number(), z.number()])).min(2).max(50),
  profile: z.enum(['bike', 'foot']).optional().default('bike'),
});

export const createPersonalRouteSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  visibility: personalVisibilityEnum.default('private'),
  activityType: z.enum(['ride', 'run', 'walk']).nullable().optional(),
});

export const updatePersonalRouteSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  visibility: personalVisibilityEnum.optional(),
  activityType: z.enum(['ride', 'run', 'walk']).nullable().optional(),
});

export const createPersonalEventCategorySchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#5865f2'),
});

export const updatePersonalEventCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const createPersonalEventSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  eventTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:mm').nullable().optional(),
  location: z.string().max(500).nullable().optional(),
  visibility: personalVisibilityEnum.default('private'),
  activityType: z.enum(['ride', 'run', 'walk']).nullable().optional(),
  categoryId: z.string().nullable().optional(),
  routeId: z.string().nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
});

export const updatePersonalEventSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
  eventTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:mm').nullable().optional(),
  location: z.string().max(500).nullable().optional(),
  visibility: personalVisibilityEnum.optional(),
  activityType: z.enum(['ride', 'run', 'walk']).nullable().optional(),
  categoryId: z.string().nullable().optional(),
  routeId: z.string().nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
});

export const personalCollectionsQuerySchema = z.object({
  before: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  visibility: personalVisibilityEnum.optional(),
});

export const personalEventsQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  visibility: personalVisibilityEnum.optional(),
});

export const copyToChannelSchema = z.object({
  channelId: z.string().min(1),
});

export const copyToSpaceSchema = z.object({
  spaceId: z.string().min(1),
  channelId: z.string().min(1).optional(),
});

// ─── Personal Activities ───

export const activityTypeEnum = z.enum(['run', 'bike', 'walk', 'hike']);

export const createPersonalActivitySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(5000).nullable().optional(),
  activityType: activityTypeEnum,
  visibility: personalVisibilityEnum.default('private'),
  startedAt: z.string().nullable().optional(),
});

export const updatePersonalActivitySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).nullable().optional(),
  visibility: personalVisibilityEnum.optional(),
});

export const personalActivitiesQuerySchema = z.object({
  before: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  visibility: personalVisibilityEnum.optional(),
  activityType: activityTypeEnum.optional(),
});

export const activityStatsQuerySchema = z.object({
  period: z.enum(['ytd', 'year', 'previous_year', 'month', 'week', 'all']).default('ytd'),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

// ─── User Posts ───

export const createUserPostSchema = z.object({
  body: z.string().max(10000).nullable().optional(),
  visibility: personalVisibilityEnum.default('private'),
  taggedUserIds: z.array(z.string()).max(20).optional(),
  existingGalleryItemIds: z.array(z.string()).max(20).optional(),
  existingRouteItemIds: z.array(z.string()).max(10).optional(),
  spaceId: z.string().optional(),
});

export const updateUserPostSchema = z.object({
  body: z.string().max(10000).nullable().optional(),
  visibility: personalVisibilityEnum.optional(),
});

export const userPostsQuerySchema = z.object({
  before: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const createPostCommentSchema = z.object({
  body: z.string().min(1).max(4000),
  parentCommentId: z.string().optional(),
  spaceId: z.string().optional(),
});

export const postCommentsQuerySchema = z.object({
  before: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const createRepostSchema = z.object({
  originalPostId: z.string().min(1),
  visibility: personalVisibilityEnum,
  body: z.string().max(10000).nullable().optional(),
});

export const sharePostToChannelSchema = z.object({
  channelId: z.string().min(1),
  content: z.string().max(4000).optional(),
});

// ─── Newsletter ───

const textBlockSchema = z.object({ type: z.literal('text'), content: z.string().max(50000) });
const imageBlockSchema = z.object({ type: z.literal('image'), url: z.string().max(512), caption: z.string().max(500).nullable().optional(), alt: z.string().max(500).nullable().optional() });
const imageGalleryBlockSchema = z.object({ type: z.literal('image_gallery'), images: z.array(z.object({ url: z.string().max(512), caption: z.string().max(500).nullable().optional(), alt: z.string().max(500).nullable().optional() })).max(20) });
const quoteBlockSchema = z.object({ type: z.literal('quote'), content: z.string().max(2000), attribution: z.string().max(200).nullable().optional() });
const dividerBlockSchema = z.object({ type: z.literal('divider') });
const embedBlockSchema = z.object({ type: z.literal('embed'), url: z.string().url().max(512), title: z.string().max(200).nullable().optional() });
const sectionHeadingBlockSchema = z.object({ type: z.literal('section_heading'), content: z.string().max(200) });

export const newsletterBlockSchema = z.discriminatedUnion('type', [
  textBlockSchema, imageBlockSchema, imageGalleryBlockSchema,
  quoteBlockSchema, dividerBlockSchema, embedBlockSchema, sectionHeadingBlockSchema,
]);

export const createNewsletterSchema = z.object({
  subject: z.string().min(1).max(500),
  summary: z.string().max(500).nullable().optional(),
  headerImageUrl: z.string().max(512).nullable().optional(),
  blocks: z.array(newsletterBlockSchema).max(100),
  status: z.enum(['draft', 'published']).default('draft'),
  isPublic: z.boolean().optional(),
});

export const updateNewsletterSchema = z.object({
  subject: z.string().min(1).max(500).optional(),
  summary: z.string().max(500).nullable().optional(),
  headerImageUrl: z.string().max(512).nullable().optional(),
  blocks: z.array(newsletterBlockSchema).max(100).optional(),
  status: z.enum(['draft', 'published']).optional(),
  isPublic: z.boolean().optional(),
});

export const newslettersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  before: z.string().optional(),
  status: z.enum(['draft', 'published']).optional(),
});

export const subscribeNewsletterSchema = z.object({
  sourceType: z.enum(['space', 'user']),
  sourceId: z.string().min(1),
  frequency: z.enum(['immediate', 'daily_digest', 'weekly_digest']).default('immediate'),
});

export const updateNewsletterSubscriptionSchema = z.object({
  frequency: z.enum(['immediate', 'daily_digest', 'weekly_digest']).optional(),
  isActive: z.boolean().optional(),
});

export const anonymousSubscribeSchema = z.object({
  email: z.string().email().max(255),
  sourceType: z.enum(['space', 'user']),
  sourceId: z.string().min(1),
  frequency: z.enum(['immediate', 'daily_digest', 'weekly_digest']).default('immediate'),
});

export const updateAnonymousPreferencesSchema = z.object({
  frequency: z.enum(['immediate', 'daily_digest', 'weekly_digest']).optional(),
  isActive: z.boolean().optional(),
});

// ─── Profile Links ───

export const createProfileLinkSchema = z.object({
  label: z.string().min(1).max(100),
  url: z.string().url().max(512),
});

export const updateProfileLinkSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  url: z.string().url().max(512).optional(),
});

export const reorderProfileLinksSchema = z.object({
  linkIds: z.array(z.string().min(1)).min(1).max(10),
});
