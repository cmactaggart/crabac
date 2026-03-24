# crab.ac API Documentation

## API Version 0.17.0

Base URL: `https://app.crab.ac/api`

---

## Overview

The crab.ac API is a RESTful JSON API that powers a community chat / public comms / organization platform. All request and response bodies use JSON (`Content-Type: application/json`). IDs are snowflake bigints serialized as strings.

### Authentication

Most endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

Access tokens are short-lived JWTs obtained via login or token refresh. When a token expires, use the refresh endpoint to get a new one.

### Error Format

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Space not found"
  }
}
```

Some errors include a `data` field with machine-readable context (e.g. `data.existingCallId` when a call already exists).

Common HTTP status codes: `400` (validation), `401` (unauthenticated), `403` (forbidden), `404` (not found), `429` (rate limited).

### Permissions

Access control uses a bitfield RBAC system. Permissions are assigned to roles, and roles are assigned to space members. The space owner bypasses all permission checks. Key permissions:

| Permission | Description |
|------------|-------------|
| `VIEW_CHANNELS` | View channels and messages |
| `SEND_MESSAGES` | Send messages in channels |
| `MANAGE_MESSAGES` | Delete/pin others' messages |
| `MANAGE_CHANNELS` | Create, edit, delete channels |
| `MANAGE_ROLES` | Create, edit, delete roles |
| `MANAGE_MEMBERS` | Kick/ban members, assign roles |
| `MANAGE_SPACE` | Edit space settings |
| `CREATE_INVITES` | Create invite links |
| `MANAGE_INVITES` | View/delete invites |
| `ATTACH_FILES` | Upload file attachments |
| `ADD_REACTIONS` | Add emoji reactions |
| `MANAGE_CALENDAR` | Create/edit/delete calendar events, categories, and series |
| `CREATE_THREADS` | Create forum threads |
| `MANAGE_THREADS` | Pin/lock/delete threads |
| `MANAGE_ROUTE_CATEGORIES` | Create/delete route library categories |
| `MANAGE_BLOG` | Create/edit/delete blog posts and upload images |
| `MANAGE_NEWSLETTER` | Create/edit/delete newsletters, view analytics |
| `MANAGE_WORKFLOWS` | Create/edit/delete workflows, commands, and card templates |
| `MANAGE_SOCIAL` | Post to the social feed on behalf of a space |

### Ban Enforcement

Globally banned users (`user_bans`) receive `403 "Your account has been suspended"` on all authenticated endpoints. Space-banned users are prevented from joining the space via invite or public join.

### Block Filtering

When a user blocks another user, messages from blocked users are filtered out of both channel and DM message listings. Blocked users cannot initiate DMs.

---

## Auth

### POST /auth/register

Create a new account.

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | yes | Valid email, max 255 chars |
| `username` | string | yes | 2-32 chars, alphanumeric + `_-` |
| `displayName` | string | yes | 1-64 chars |
| `password` | string | yes | 8-128 chars |

**Response:** `{ accessToken, refreshToken, user }`

Username must not conflict with any existing space slug (case-insensitive).

### POST /auth/login

Log in with email/username and password.

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `login` | string | yes | Email or username |
| `password` | string | yes | Account password |

**Response:** `{ accessToken, refreshToken, user }` or `{ mfaRequired: true, mfaToken }` if TOTP is enabled.

### POST /auth/refresh

Refresh an expired access token.

**Body:** `{ refreshToken: string }`

**Response:** `{ accessToken, refreshToken }`

### POST /auth/logout

Invalidate a refresh token.

**Body:** `{ refreshToken: string }`

### POST /auth/verify-email

**Body:** `{ token: string }`

### POST /auth/resend-verification

Resend verification email. Requires auth.

### POST /auth/magic-link/send

Send a magic link login email.

**Body:** `{ email: string }`

### POST /auth/magic-link/redeem

Redeem a magic link token.

**Body:** `{ token: string }`

**Response:** `{ accessToken, refreshToken, user }`

### POST /auth/forgot-password

Request a password reset email. Always returns success regardless of whether the email exists (prevents email enumeration). Rate limited.

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | yes | Account email address |

**Response:** `{ success: true }`

### POST /auth/reset-password

Reset password using a token from the reset email. Invalidates all existing refresh tokens (logs out all devices). Rate limited.

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | string | yes | Reset token from email link |
| `password` | string | yes | New password, 8-128 chars |

**Response:** `{ success: true }`

**Errors:** `400` if token is invalid, expired, or already used.

### POST /auth/mfa/verify

Complete MFA challenge during login.

**Body:** `{ mfaToken: string, code: string }`

**Response:** `{ accessToken, refreshToken, user }`

---

## MFA (TOTP)

All endpoints require auth.

### POST /mfa/totp/setup

Get TOTP QR code and secret for setup.

**Response:** `{ secret, otpauthUrl, qrCode }`

### POST /mfa/totp/confirm

Confirm and enable TOTP.

**Body:** `{ code: string }` (6-digit code)

**Response:** `{ backupCodes: string[] }`

### POST /mfa/totp/disable

Disable TOTP.

**Body:** `{ password: string }`

### POST /mfa/totp/backup-codes

Regenerate backup codes.

**Body:** `{ password: string }`

**Response:** `{ backupCodes: string[] }`

---

## Users

### GET /users/me

Get current user profile. Requires auth.

**Response:** User object with `id`, `email`, `username`, `displayName`, `avatarUrl`, `bio`, `isAdmin`, `emailVerified`, `totpEnabled`, `baseColor`, `accentColor`, `status`, `createdAt`.

### DELETE /users/me

Delete own account. Requires auth.

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `password` | string | yes | Account password for confirmation |

**Response:** `{ success: true }`

### PATCH /users/me

Update current user profile. Requires auth.

**Body:**
| Field | Type | Required |
|-------|------|----------|
| `displayName` | string | no |
| `bio` | string \| null | no | Max 255 chars |
| `avatarUrl` | string \| null | no |
| `baseColor` | string \| null | no |
| `accentColor` | string \| null | no |

### POST /users/me/avatar

Upload user avatar. Requires auth. Multipart form data with `avatar` field.

**Response:** `{ avatarUrl }`

### GET /users/preferences

Get user preferences. Requires auth.

**Response:** `{ distanceUnits, defaultVisibility, profileVisibility, onboardingCompleted, newsletterEnabled, activitiesVisibility, followRequestPolicy, msgPrivacyAll, msgPrivacyFollowed, msgPrivacySpaces, msgPrivacyGroupDm }`

### PUT /users/preferences

Update user preferences. Requires auth.

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `distanceUnits` | string | no | `metric` or `us_customary` |
| `defaultVisibility` | string | no | `public`, `private`, `followers`, or `spaces` |
| `profileVisibility` | string | no | `public`, `private`, `followers`, or `spaces` |
| `onboardingCompleted` | boolean | no | |
| `newsletterEnabled` | boolean | no | Opt in to personal newsletter emails |
| `activitiesVisibility` | string \| null | no | `public`, `private`, `followers`, or `spaces` — controls whether other users can see your activities |
| `followRequestPolicy` | string | no | `accept_all`, `accept_mutual_spaces`, or `require_approval` |
| `msgPrivacyAll` | string | no | `accept_all`, `require_approval`, or `dont_allow` — default messaging policy for unknown users |
| `msgPrivacyFollowed` | string | no | `accept_all`, `require_approval`, or `dont_allow` — messaging policy for users you follow |
| `msgPrivacySpaces` | string | no | `accept_all`, `require_approval`, or `dont_allow` — messaging policy for shared-space members |
| `msgPrivacyGroupDm` | string | no | `accept_all`, `require_approval`, or `dont_allow` — messaging policy for group DM invitations |

Sub-settings (`msgPrivacyFollowed`, `msgPrivacySpaces`, `msgPrivacyGroupDm`) cannot be less restrictive than `msgPrivacyAll`. Returns `400` if violated.

### GET /users/mutes

List muted user IDs. Requires auth.

**Response:** `string[]`

### PUT /users/mutes/:userId

Mute a user. Requires auth.

### DELETE /users/mutes/:userId

Unmute a user. Requires auth.

### GET /users/muted-spaces

Get all space IDs the current user has muted. Requires auth.

**Response:** Array of space ID strings.

### GET /users/search

Search users by username or display name. Requires auth.

**Query:**
| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Search query (min 2 chars) |

**Response:** Array of `{ id, username, displayName, avatarUrl }` (max 20 results). Excludes the current user.

### GET /users/by-username/:username

Look up a user by username. Requires auth. Returns the user object with additional fields: `canViewProfile` boolean (whether the requesting user can see this profile's content), `newsletterEnabled` boolean, and `profileLinks` array.

### GET /users/profiles/:handle

Resolve a profile handle to either a user or a space. Looks up by username first, then by space slug (where `socialEnabled = true`). Requires auth.

**Response (user):**
```json
{
  "type": "user",
  "id": "...",
  "username": "...",
  "displayName": "...",
  "avatarUrl": "...",
  "baseColor": "...",
  "accentColor": "...",
  "canViewProfile": true,
  "newsletterEnabled": false,
  "profileLinks": []
}
```

**Response (space):**
```json
{
  "type": "space",
  "id": "...",
  "name": "...",
  "slug": "...",
  "description": "...",
  "iconUrl": "...",
  "memberCount": 42,
  "baseColor": "...",
  "accentColor": "...",
  "textColor": "...",
  "ownerId": "..."
}
```

### Profile Links

#### GET /users/me/profile-links

List own profile links. Requires auth.

**Response:** Array of `{ id, userId, label, url, position, createdAt }`

#### POST /users/me/profile-links

Create a profile link. Requires auth. Max 10 links per user.

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `label` | string | yes | Max 100 chars |
| `url` | string | yes | Max 512 chars |

#### PATCH /users/me/profile-links/:linkId

Update a profile link. Requires auth.

**Body:** `{ label?, url? }`

#### DELETE /users/me/profile-links/:linkId

Delete a profile link. Requires auth.

#### PUT /users/me/profile-links/reorder

Reorder profile links. Requires auth.

**Body:** `{ linkIds: string[] }`

#### GET /users/:userId/profile-links

List another user's profile links. Requires auth.

**Response:** Array of `{ id, userId, label, url, position, createdAt }`

---

### GET /users/me/managed-social-spaces

List spaces where the current user has `MANAGE_SOCIAL` permission and `socialEnabled` is true. Used for the identity switcher.

**Response:** Array of `{ id, name, slug, iconUrl, baseColor, accentColor }`

### GET /users/:userId

Get public profile for a user. Requires auth.

---

## User Blocks

All endpoints require auth.

### GET /users/blocks

List blocked users (both directions).

**Response:** `{ blockedByMe: string[], blockedMe: string[] }`

### PUT /users/blocks/:userId

Block a user. Also removes follow relationships in both directions and declines pending DM requests between the two users. Idempotent.

### DELETE /users/blocks/:userId

Unblock a user.

---

## Spaces

### POST /spaces

Create a new space. Requires auth. Slug must not conflict with any existing username (case-insensitive).

**Body:**
| Field | Type | Required |
|-------|------|----------|
| `name` | string | yes |
| `slug` | string | yes |
| `description` | string | no |

### GET /spaces

List the current user's spaces. Requires auth.

### GET /spaces/:spaceId

Get space details. Requires membership or public access.

### GET /spaces/:spaceId/embed

Get space embed metadata (for link previews). Requires membership or public access.

**Response:** `{ id, name, slug, description, iconUrl, memberCount, channelCount, baseColor, accentColor, textColor, isPublic }`

### PATCH /spaces/:spaceId

Update space. Requires `MANAGE_SPACE`.

**Body:** `{ name?, description?, iconUrl? }`

### POST /spaces/:spaceId/icon

Upload space icon. Requires `MANAGE_SPACE`. Multipart form data with `icon` field.

### DELETE /spaces/:spaceId

Delete space. Owner only.

### POST /spaces/join

Join a space via invite code.

**Body:** `{ code: string }`

### POST /spaces/:spaceId/join-public

Join a public space directly. Requires auth.

### POST /spaces/:spaceId/leave

Leave a space. Requires auth.

---

## Space Members

### GET /spaces/:spaceId/members

List space members. Requires membership or public access.

**Response:** Array of member objects with user info and roles.

### DELETE /spaces/:spaceId/members/:userId

Kick a member. Requires `MANAGE_MEMBERS`.

### GET /spaces/:spaceId/members/:userId/roles

Get a member's roles. Requires `VIEW_ROLES`.

---

## Space Admin Settings

### GET /spaces/:spaceId/admin-settings

Get space admin settings. Requires `MANAGE_SPACE`.

**Response:**
```json
{
  "spaceId": "...",
  "allowPublicBoards": false,
  "allowPublicGalleries": false,
  "allowPublicCalendar": false,
  "allowPublicRoutes": false,
  "allowPublicBlog": false,
  "allowPublicNewsletter": false,
  "allowPublicNewsletterSubscription": false,
  "newsletterTrackingEnabled": true,
  "socialEnabled": false,
  "allowAnonymousBrowsing": false,
  "calendarEnabled": false,
  "blogEnabled": false,
  "newsletterEnabled": false,
  "isPublic": false,
  "requireVerifiedEmail": false,
  "isFeatured": false,
  "baseColor": null,
  "accentColor": null,
  "textColor": null,
  "publicTheme": null,
  "webhooksEnabled": false,
  "webhookSecret": null,
  "publicNavLinks": [],
  "publicNavDisabledFeatures": []
}
```

### PUT /spaces/:spaceId/admin-settings

Update space admin settings. Requires `MANAGE_SPACE`.

**Body:** Any subset of the settings fields above (including `webhooksEnabled`). When enabling webhooks for the first time, a webhook secret is auto-generated.

Additional fields:
| Field | Type | Description |
|-------|------|-------------|
| `publicNavLinks` | array | Custom external links for the public page navbar. Each item: `{ label: string, url: string }`. Max 20. |
| `publicNavDisabledFeatures` | array | Feature keys to hide from the public page navbar (e.g. `["gallery", "blog"]`). Valid keys: `boards`, `gallery`, `routes`, `calendar`, `blog`, `newsletter`. |

### POST /spaces/:spaceId/admin-settings/rotate-webhook-secret

Rotate the webhook secret. Requires `MANAGE_SPACE`.

**Response:** Updated `SpaceAdminSettings` with new `webhookSecret`.

---

## Space Bans

### POST /spaces/:spaceId/bans/:userId

Ban a member from a space. Requires `MANAGE_MEMBERS`. Removes the user from the space, posts a system message to the admin channel.

**Body:**
| Field | Type | Required |
|-------|------|----------|
| `reason` | string | no |

**Response:** `201 { success: true }`

Returns `403` if targeting the space owner, `409` if already banned.

### DELETE /spaces/:spaceId/bans/:userId

Unban a user from a space. Requires `MANAGE_MEMBERS`.

### GET /spaces/:spaceId/bans

List all bans for a space. Requires `MANAGE_MEMBERS`.

**Response:** Array of `{ spaceId, userId, bannedBy, reason, createdAt, user: { id, username, displayName, avatarUrl } }`

---

## Space Reports

### POST /reports

Create a report. Requires auth. Cannot report yourself. Prevents duplicate active reports for the same content. If `spaceId` is set, posts a system message to the space's admin channel.

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reportedUserId` | string | yes | |
| `spaceId` | string | no | |
| `channelId` | string | no | |
| `messageId` | string | no | Channel message ID |
| `dmMessageId` | string | no | DM message ID |
| `conversationId` | string | no | DM conversation ID |
| `galleryItemId` | string | no | Gallery photo ID |
| `routeId` | string | no | Route item ID |
| `forumPostId` | string | no | Forum post (message) ID |
| `postId` | string | no | User post ID |
| `reason` | string | yes | 1-2000 chars |

The `contentType` field is auto-set based on which ID is present: `'gallery'`, `'route'`, `'forum_post'`, `'post'`, or `null` for messages/DMs.

**Response:** `201` Report object.

### GET /spaces/:spaceId/reports

List reports for a space. Requires `MANAGE_MEMBERS`.

**Query:** `status?` (filter by `pending`, `resolved`, `dismissed`)

**Response:** Array of Report objects with `messagePreview` (content preview for the reported item).

### PATCH /spaces/:spaceId/reports/:id

Resolve or dismiss a report. Requires `MANAGE_MEMBERS`.

**Body:** `{ status: 'resolved' | 'dismissed' }`

### GET /reports (Admin)

List all reports globally. Requires global admin.

**Query:** `status?`

### PATCH /reports/:id (Admin)

Resolve or dismiss a report. Requires global admin.

**Body:** `{ status: 'resolved' | 'dismissed' }`

---

## Space Member Settings

### GET /spaces/:spaceId/settings/me

Get notification settings for the current user in a space. Requires auth.

**Response:** `{ muteAll, muteMentions, muteEvents, muteBlog, ... }`

### PUT /spaces/:spaceId/settings/me

Update notification settings. Requires auth.

**Body:** Any subset of settings fields, including:
| Field | Type | Description |
|-------|------|-------------|
| `muteAll` | boolean | Mute all notifications from this space |
| `muteMentions` | boolean | Mute mention notifications |
| `muteEvents` | boolean | Mute calendar event notifications |
| `muteBlog` | boolean | Mute blog post notifications |

---

## Space Tags

### GET /spaces/:spaceId/tags

Get space tags. Requires membership or public access.

### PUT /spaces/:spaceId/tags

Update space tags. Requires `MANAGE_SPACE`.

**Body:** `{ tags: string[] }` (max 10 tags, each max 50 chars)

### Space Mutes

Muting a space suppresses all push notifications from that space (channel messages, mentions, events, etc.). Content is still visible — only push delivery is affected.

### GET /spaces/:spaceId/mute

Check if the current user has this space muted. Requires membership.

**Response:** `{ muted: boolean }`

### PUT /spaces/:spaceId/mute

Mute a space. Requires membership.

### DELETE /spaces/:spaceId/mute

Unmute a space. Requires membership.

---

## Space Search

### GET /spaces/:spaceId/search?q=...

Search messages in a space. Requires auth.

---

## Public Spaces Directory

### GET /spaces/by-slug/:slug

Get space info by slug. No auth required.

### GET /spaces/by-slug/:slug/embed

Get space embed metadata by slug (for link previews). No auth required.

**Response:** `{ id, name, slug, description, iconUrl, memberCount, channelCount, baseColor, accentColor, textColor, isPublic }`

### GET /spaces/directory

List public spaces. Requires auth.

**Query:**
| Param | Type | Default |
|-------|------|---------|
| `search` | string | - |
| `tag` | string | - |
| `limit` | number | 20 |
| `offset` | number | 0 |

### GET /spaces/directory/featured

Get featured public spaces. Requires auth.

### GET /spaces/directory/tags

Get all tags. Requires auth.

---

## Channels

### POST /spaces/:spaceId/channels

Create a channel. Requires `MANAGE_CHANNELS`.

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Lowercase alphanumeric + hyphens |
| `topic` | string | no | Max 1024 chars |
| `type` | string | no | `text`, `announcement`, `read_only`, `forum`, `media_gallery`, `route_library`, `voice` |
| `isPrivate` | boolean | no | Make channel private (hidden from non-members) |
| `isPublic` | boolean | no | For public board/gallery/route access |
| `categoryId` | string | no | |
| `memberIds` | string[] | no | User IDs to grant access (private channels only) |
| `roleOverrides` | string[] | no | Role IDs to grant VIEW_CHANNELS override (private channels only) |

When `isPrivate` is `true`, the creating user is automatically added as a channel member. Users in `memberIds` are added to the `channel_members` table. Roles in `roleOverrides` receive a channel permission override granting `VIEW_CHANNELS | SEND_MESSAGES | ATTACH_FILES | ADD_REACTIONS`.

### GET /spaces/:spaceId/channels

List channels. Requires membership or public access. Filtered by user's permission overrides. Private channels are only visible to administrators, direct channel members, and users with a role that has a `VIEW_CHANNELS` allow override on the channel.

### PUT /spaces/:spaceId/channels/reorder

Bulk reorder channels. Requires `MANAGE_CHANNELS`.

**Body:**
```json
{
  "channels": [
    { "channelId": "...", "position": 0, "categoryId": "..." }
  ]
}
```

### PATCH /spaces/:spaceId/channels/:channelId

Update channel. Requires `MANAGE_CHANNELS`.

**Body:** `{ name?, topic?, type?, isPublic?, isPrivate?, position? }`

When toggling `isPrivate` to `true`, the channel becomes hidden from non-members. When toggling to `false`, the channel becomes visible to all members again.

### DELETE /spaces/:spaceId/channels/:channelId

Delete channel. Requires `MANAGE_CHANNELS`.

---

## Channel Permission Overrides

### GET /spaces/:spaceId/channels/:channelId/overrides

List permission overrides for a channel. Requires `MANAGE_CHANNELS`.

### PUT /spaces/:spaceId/channels/:channelId/overrides/:roleId

Set permission override for a role on a channel. Requires `MANAGE_CHANNELS`.

**Body:** `{ allow: string, deny: string }` (numeric bitfield strings)

### DELETE /spaces/:spaceId/channels/:channelId/overrides/:roleId

Remove a permission override. Requires `MANAGE_CHANNELS`.

---

## Channel Members (Private Channels)

Manage per-user access to private channels. All endpoints require `MANAGE_CHANNELS`.

### GET /spaces/:spaceId/channels/:channelId/members

List direct members of a private channel.

**Response:** Array of `{ id, username, displayName, avatarUrl }`

### PUT /spaces/:spaceId/channels/:channelId/members/:userId

Add a user as a direct member of the channel. Idempotent (ignores conflicts).

**Response:** `{ success: true }`

### DELETE /spaces/:spaceId/channels/:channelId/members/:userId

Remove a user from the channel's direct member list.

**Response:** `{ success: true }`

---

## Channel Mutes

### GET /spaces/:spaceId/channels/muted

Get IDs of muted channels. Requires auth + membership.

### PUT /spaces/:spaceId/channels/:channelId/mute

Mute a channel.

### DELETE /spaces/:spaceId/channels/:channelId/mute

Unmute a channel.

---

## Unread Tracking

### POST /spaces/:spaceId/channels/:channelId/read

Mark a channel as read.

**Body:** `{ messageId: string }`

### GET /spaces/:spaceId/channels/unreads

Get unread counts for all channels in a space.

---

## Space Entry

### GET /spaces/:spaceId/enter

Combined endpoint that returns channels, categories, unread counts, and initial messages in a single response. Designed to eliminate the waterfall of sequential HTTP calls when entering a space. Requires membership or public access.

**Query:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `channelId` | string | no | Channel to load messages for. Defaults to the first non-admin channel. |

**Response:**
```json
{
  "channels": [Channel],
  "categories": [ChannelCategory],
  "unreads": {
    "<channelId>": { "unreadCount": 0, "mentionCount": 0 }
  },
  "messages": [Message],
  "channelId": "string | null"
}
```

- `channels` — same as `GET /spaces/:spaceId/channels` (filtered by user permissions)
- `categories` — same as `GET /spaces/:spaceId/categories`
- `unreads` — same as `GET /spaces/:spaceId/channels/unreads` (keyed by channel ID)
- `messages` — last 50 messages for the target channel (same format as `GET /channels/:channelId/messages`)
- `channelId` — the channel whose messages were loaded (useful when no `channelId` query param was provided)

---

## Channel Categories

### GET /spaces/:spaceId/categories

List channel categories. Requires membership.

### POST /spaces/:spaceId/categories

Create a category. Requires `MANAGE_CHANNELS`.

**Body:** `{ name: string }`

### PUT /spaces/:spaceId/categories/reorder

Bulk reorder categories. Requires `MANAGE_CHANNELS`.

**Body:**
```json
{
  "categories": [
    { "categoryId": "...", "position": 0 }
  ]
}
```

### PATCH /spaces/:spaceId/categories/:categoryId

Update category. Requires `MANAGE_CHANNELS`.

**Body:** `{ name?, position? }`

### DELETE /spaces/:spaceId/categories/:categoryId

Delete category. Requires `MANAGE_CHANNELS`.

---

## Messages

### GET /channels/:channelId/messages

Get messages with cursor pagination. Messages from blocked users are filtered out.

**Query:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `before` | string | - | Cursor for backward pagination |
| `after` | string | - | Cursor for forward pagination (returns ascending order) |
| `limit` | number | 50 | Max 100 |

### POST /channels/:channelId/messages

Send a message. Requires `SEND_MESSAGES`.

**Body:** `{ content: string, replyToId?: string }`

### PATCH /channels/:channelId/messages/:messageId

Edit a message. Author only.

**Body:** `{ content: string }`

### DELETE /channels/:channelId/messages/:messageId

Delete a message. Author can delete own; `MANAGE_MESSAGES` can delete others'.

### POST /channels/:channelId/messages/upload

Send a message with file attachments. Requires `SEND_MESSAGES` + `ATTACH_FILES`. Multipart form data.

### POST /channels/:channelId/messages/:messageId/attachments

Add attachments to an existing message. Requires `ATTACH_FILES`. Multipart form data.

---

## Reactions

### PUT /channels/:channelId/messages/:messageId/reactions/:emoji

Add a reaction. Requires `ADD_REACTIONS`.

### DELETE /channels/:channelId/messages/:messageId/reactions/:emoji

Remove your reaction.

---

## Pins

### GET /channels/:channelId/pins

Get pinned messages.

### PUT /channels/:channelId/messages/:messageId/pin

Pin a message. Requires `MANAGE_MESSAGES`.

### DELETE /channels/:channelId/messages/:messageId/pin

Unpin a message. Requires `MANAGE_MESSAGES`.

---

## Threads (Message Replies)

### GET /channels/:channelId/messages/:messageId/thread

Get thread messages for a parent message.

---

## Roles

### GET /spaces/:spaceId/roles

List roles. Requires `VIEW_CHANNELS`.

### POST /spaces/:spaceId/roles

Create a role. Requires `MANAGE_ROLES`.

**Body:** `{ name, color?, permissions?, position? }`

### PATCH /spaces/:spaceId/roles/:roleId

Update a role. Requires `MANAGE_ROLES`.

**Body:** `{ name?, color?, permissions?, position? }`

### DELETE /spaces/:spaceId/roles/:roleId

Delete a role. Requires `MANAGE_ROLES`.

### PUT /spaces/:spaceId/members/:userId/roles

Set a member's roles. Requires `MANAGE_MEMBERS`.

**Body:** `{ roleIds: string[] }`

---

## Invites

### GET /spaces/invites/:code/preview

Preview an invite. No auth required.

**Response:** `{ space: { name, slug, description, iconUrl, memberCount } }`

### POST /spaces/:spaceId/invites

Create an invite. Requires `CREATE_INVITES`.

**Body:** `{ maxUses?, expiresInHours? }`

### GET /spaces/:spaceId/invites

List invites. Requires `MANAGE_INVITES`.

### DELETE /spaces/:spaceId/invites/:inviteId

Delete an invite. Requires `MANAGE_INVITES`.

---

## Forum Threads

### GET /spaces/:spaceId/channels/:channelId/threads

List threads in a forum channel.

**Query:**
| Param | Type | Default |
|-------|------|---------|
| `before` | string | - |
| `limit` | number | 30 |
| `sort` | string | `latest` |

### POST /spaces/:spaceId/channels/:channelId/threads

Create a thread. Requires `CREATE_THREADS`.

**Body:** `{ title: string, content: string }`

### GET /spaces/:spaceId/channels/:channelId/threads/:threadId

Get a thread.

### PATCH /spaces/:spaceId/channels/:channelId/threads/:threadId

Update a thread. Requires `MANAGE_THREADS`.

**Body:** `{ title?, isPinned?, isLocked? }`

### DELETE /spaces/:spaceId/channels/:channelId/threads/:threadId

Delete a thread. Requires `MANAGE_THREADS`.

### GET /spaces/:spaceId/channels/:channelId/threads/:threadId/posts

List thread posts. Posts that reference another post via `replyToId` include a `replyTo` object with the referenced post's `id`, `content`, and `author` (id, username, displayName).

### POST /spaces/:spaceId/channels/:channelId/threads/:threadId/posts

Create a post in a thread. Requires `SEND_MESSAGES`.

**Body:** `{ content: string, replyToId?: string }`

When `replyToId` is provided, the response and real-time socket event include a `replyTo` object with the referenced post's content and author info.

---

## Calendar

### Calendar Categories

#### GET /spaces/:spaceId/calendar/categories

List calendar categories. Requires membership.

#### POST /spaces/:spaceId/calendar/categories

Create a category. Requires `MANAGE_CALENDAR`.

**Body:** `{ name: string, color: string }` (color is `#RRGGBB`)

#### PATCH /spaces/:spaceId/calendar/categories/:id

Update a category. Requires `MANAGE_CALENDAR`.

**Body:** `{ name?, color? }`

#### DELETE /spaces/:spaceId/calendar/categories/:id

Delete a category. Requires `MANAGE_CALENDAR`.

### Calendar Events

#### GET /spaces/:spaceId/calendar/events

List events by date range. Requires membership.

**Query:** `from=YYYY-MM-DD&to=YYYY-MM-DD`

#### GET /spaces/:spaceId/calendar/upcoming

List upcoming events starting from today. Requires membership.

**Query:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | 20 | Max 50 |

**Response:** Array of CalendarEvent objects ordered by date.

#### POST /spaces/:spaceId/calendar/events/upload-image

Upload a calendar event image. Requires `MANAGE_CALENDAR`. Multipart form data with `image` field (max 10MB, images only). Processed to 16:9 crop, max 1280x720 JPEG.

**Response:** `{ url: string }`

#### GET /spaces/:spaceId/calendar/events/:id

Get a single event. Requires membership.

**Response:** CalendarEvent object including `rsvpCounts`, `myRsvp`, linked `route`, and `category`.

#### POST /spaces/:spaceId/calendar/events

Create an event. Requires `MANAGE_CALENDAR`.

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Max 200 chars |
| `description` | string \| null | no | Max 4000 chars |
| `eventDate` | string | yes | `YYYY-MM-DD` |
| `eventTime` | string \| null | no | `HH:mm` |
| `categoryId` | string \| null | no | |
| `isPublic` | boolean | no | Visible on public calendar |
| `location` | string \| null | no | Max 500 chars |
| `activityType` | string \| null | no | `ride`, `run`, or `walk` |
| `routeId` | string \| null | no | Link to a route library item |

**Side effects:** Creating an event sends a `new_event` notification to all space members (excluding the creator) and triggers push notifications. If the space has `socialEnabled = true`, an auto-generated social post is created on behalf of the space with `metadata: { type: 'calendar_event', eventId, spaceId }`.

#### PATCH /spaces/:spaceId/calendar/events/:id

Update an event. Requires `MANAGE_CALENDAR`.

**Body:** Same fields as create, all optional.

#### DELETE /spaces/:spaceId/calendar/events/:id

Delete an event. Requires `MANAGE_CALENDAR`.

**Side effects:** Before deletion, all users who RSVP'd "going" or "maybe" receive an `event_cancelled` notification with push notification.

### Event RSVP

#### POST /spaces/:spaceId/calendar/events/:eventId/rsvp

RSVP to an event. Requires membership.

**Body:** `{ status: 'going' | 'maybe' | 'not_going' }`

**Response:** Updated CalendarEvent object.

**Side effects:** When a user RSVPs, the event creator receives an `event_rsvp` notification with push notification (unless the RSVP is from the creator themselves). The notification includes the RSVP user's name, status, and event details.

#### DELETE /spaces/:spaceId/calendar/events/:eventId/rsvp

Remove RSVP from an event. Requires membership.

**Response:** Updated CalendarEvent object.

#### GET /spaces/:spaceId/calendar/events/:eventId/rsvps

List all RSVPs for an event. Requires membership.

**Response:** Array of RSVP objects with user info.

### Recurring Event Series

#### POST /spaces/:spaceId/calendar/series

Create a recurring event series. Generates individual calendar event rows for each occurrence. Requires `MANAGE_CALENDAR`.

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Max 200 chars |
| `description` | string \| null | no | Max 4000 chars |
| `eventTime` | string \| null | no | `HH:mm` |
| `categoryId` | string \| null | no | |
| `isPublic` | boolean | no | |
| `location` | string \| null | no | Max 500 chars |
| `activityType` | string \| null | no | `ride`, `run`, or `walk` |
| `routeId` | string \| null | no | |
| `recurrenceRule` | object | yes | See Recurrence Rule below |

**Recurrence Rule:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `freq` | string | yes | `weekly` or `monthly` |
| `interval` | number | yes | 1-52, repeat interval |
| `byDay` | string[] | yes | Day codes: `SU`, `MO`, `TU`, `WE`, `TH`, `FR`, `SA` |
| `bySetPos` | number | no | 1-5, for monthly (e.g. 3 = 3rd Friday) |
| `dtstart` | string | yes | Start date `YYYY-MM-DD` |
| `until` | string | yes | End date `YYYY-MM-DD` |

**Examples:**
- Every 3 weeks on Friday: `{ "freq": "weekly", "interval": 3, "byDay": ["FR"], "dtstart": "2026-03-01", "until": "2026-06-30" }`
- 3rd Friday of each month: `{ "freq": "monthly", "interval": 1, "byDay": ["FR"], "bySetPos": 3, "dtstart": "2026-03-01", "until": "2026-12-31" }`

**Response:** EventSeries object.

#### GET /spaces/:spaceId/calendar/series

List all recurring event series. Requires membership.

**Response:** Array of EventSeries objects.

#### PATCH /spaces/:spaceId/calendar/series/:seriesId

Update a series. Requires `MANAGE_CALENDAR`.

**Body:** Same fields as create (all optional), plus:
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `updateMode` | string | `all` | `all` updates all occurrences, `future` updates only future ones |

#### DELETE /spaces/:spaceId/calendar/series/:seriesId

Delete a series and all its occurrences. Requires `MANAGE_CALENDAR`.

#### PATCH /spaces/:spaceId/calendar/events/:id/override

Override a single occurrence in a series. Marks it as `isOverride: true` and applies changes only to that event. Requires `MANAGE_CALENDAR`.

**Body:** Same as update event.

#### POST /spaces/:spaceId/calendar/events/:id/cancel

Cancel a single occurrence in a series. Sets `isCancelled: true` and notifies RSVP'd users. Requires `MANAGE_CALENDAR`.

### Meeting Rooms

Calendar events can have associated voice/video meeting rooms with a temporary text chat channel. Meeting rooms are created on first join and cleaned up when the last participant leaves.

#### GET /spaces/:spaceId/calendar/active-rooms

List active meeting rooms for events happening today. Requires membership.

**Query:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `date` | string | today | `YYYY-MM-DD`, override date for lookup |

**Response:** Array of active room objects with participant counts.

#### GET /spaces/:spaceId/calendar/my-active-room

Check if the current user is in an active meeting room in this space. Requires membership.

**Response:** `{ room }` (room object or `null`)

#### POST /spaces/:spaceId/calendar/events/:eventId/room/join

Join the meeting room for a calendar event. Creates the room and a temporary text channel if they don't exist yet. Requires membership.

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `date` | string | no | `YYYY-MM-DD`, override date |

**Response:** `{ call, token: { token, wsUrl }, channelId, meetingRoom }` — includes the LiveKit token for voice/video and the temporary channel ID for text chat.

#### POST /spaces/:spaceId/calendar/events/:eventId/room/leave

Leave the meeting room for a calendar event. If no participants remain, the room is closed, the temporary text channel and its messages are deleted, and the LiveKit room is destroyed.

**Response:** `204 No Content`

---

## Route Library

Route library channels (`type: 'route_library'`) store GPX routes with parsed metadata.

### Route Items

#### GET /channels/:channelId/routes

List route items in a route library channel. Requires membership.

**Query:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `before` | string | - | Cursor for pagination |
| `limit` | number | 30 | Max 100 |
| `search` | string | - | Search by name |
| `category` | string | - | Filter by category ID |
| `author` | string | - | Filter by author name |
| `type` | string | - | `ride`, `run`, or `walk` |
| `sort` | string | `newest` | `name`, `distance`, `elevation`, `flatness`, `newest` |
| `order` | string | `desc` | `asc` or `desc` |
| `starred` | boolean | - | Filter to starred routes only |

**Response:** Array of RouteItem objects with author info, category, and `starred` boolean.

#### POST /channels/:channelId/routes/upload

Upload a GPX file and create a route item. Requires `SEND_MESSAGES` + `ATTACH_FILES`. Multipart form data.

**Form fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | file | yes | `.gpx` file, max 50MB |
| `name` | string | no | Defaults to track name from GPX |
| `description` | string | no | Max 4000 chars |
| `categoryId` | string | no | |
| `isPublic` | boolean | no | |
| `activityType` | string | no | `ride`, `run`, or `walk` |

**Response:** RouteItem object with parsed GPX metadata (distance, elevation, bounds, geojson).

#### POST /channels/:channelId/routes/from-attachment

Create a route from an existing GPX attachment URL (e.g. from a message). Requires `SEND_MESSAGES` + `ATTACH_FILES`.

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `attachmentUrl` | string | yes | URL of existing GPX file (e.g. `/uploads/...`) |
| `name` | string | yes | Max 200 chars |
| `description` | string | no | Max 4000 chars |
| `categoryId` | string | no | |
| `isPublic` | boolean | no | |
| `activityType` | string | no | `ride`, `run`, or `walk` |

**Response:** RouteItem object.

#### DELETE /channels/:channelId/routes/:routeId

Delete a route item. Author can delete own; `MANAGE_MESSAGES` can delete others'.

#### POST /channels/:channelId/routes/:routeId/star

Star a route. Requires membership.

#### DELETE /channels/:channelId/routes/:routeId/star

Unstar a route. Requires membership.

### Route Categories

#### GET /spaces/:spaceId/route-categories

List route categories for a space. Requires membership.

**Response:** Array of `{ id, spaceId, name, createdAt }`.

#### POST /spaces/:spaceId/route-categories

Create a route category. Requires `MANAGE_ROUTE_CATEGORIES`.

**Body:** `{ name: string }` (max 100 chars)

#### DELETE /spaces/:spaceId/route-categories/:categoryId

Delete a route category. Requires `MANAGE_ROUTE_CATEGORIES`.

---

## Blog

Community blog feature. Enable via admin settings (`blogEnabled`). Blog posts are authored by members with `MANAGE_BLOG` permission.

### Blog Posts

#### GET /spaces/:spaceId/blog/posts

List blog posts. Requires membership. Returns published posts for all users; authors also see their own drafts.

**Query:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | 20 | Max 50 |
| `before` | string | - | Cursor for pagination |
| `status` | string | - | `draft` or `published` |

**Response:** Array of BlogPost objects with author info.

#### GET /spaces/:spaceId/blog/posts/:id

Get a single blog post. Requires membership.

**Response:** BlogPost object.

#### POST /spaces/:spaceId/blog/posts

Create a blog post. Requires `MANAGE_BLOG`.

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | yes | Max 500 chars |
| `summary` | string \| null | no | Max 140 chars |
| `content` | string | yes | Max 100,000 chars (Markdown) |
| `status` | string | no | `draft` (default) or `published` |
| `isPublic` | boolean | no | Visible on public blog |

**Side effects:** When a post is published (either created with `status: 'published'` or updated from `draft` to `published`), a `new_blog_post` notification is sent to all space members (excluding the author) with push notifications. The notification uses the space avatar as its image and text: "New blog post from {space name}: {post title}".

**Response:** BlogPost object.

#### PATCH /spaces/:spaceId/blog/posts/:id

Update a blog post. Author or `MANAGE_BLOG` required.

**Body:** Same fields as create, all optional.

#### DELETE /spaces/:spaceId/blog/posts/:id

Delete a blog post. Requires `MANAGE_BLOG`.

#### POST /spaces/:spaceId/blog/upload-image

Upload an image for use in blog post content. Requires `MANAGE_BLOG`. Multipart form data with `image` field (max 5MB, images only).

**Response:** `{ url: string }` — use in Markdown as `![alt](url)`.

---

## Gallery

### GET /channels/:channelId/gallery

List gallery items for a media gallery channel.

**Query:** `before=<id>&limit=<n>`

### POST /channels/:channelId/gallery/upload

Upload a gallery item. Requires `SEND_MESSAGES` + `ATTACH_FILES`. Multipart form data with `files` and optional `caption`.

### POST /channels/:channelId/gallery/:itemId/attachments

Add attachments to an existing gallery item. Requires `ATTACH_FILES`. Multipart form data.

### DELETE /channels/:channelId/gallery/:itemId

Delete a gallery item. Author can delete own; `MANAGE_MESSAGES` can delete others'.

---

## Portals

Portals allow a channel in one space to be mirrored into another.

### POST /spaces/:spaceId/portals

Create a portal. Requires `MANAGE_CHANNELS` in source space.

**Body:** `{ channelId: string, targetSpaceId: string }`

### POST /spaces/:spaceId/portal-invites

Submit a portal invite request.

**Body:** `{ channelId: string, targetSpaceId: string }`

### GET /spaces/:spaceId/portals

List portals. Requires membership.

### GET /spaces/:spaceId/portal-invites

List pending portal invites. Requires membership.

### POST /spaces/:spaceId/portal-invites/:inviteId/accept

Accept a portal invite.

### POST /spaces/:spaceId/portal-invites/:inviteId/reject

Reject a portal invite.

### DELETE /spaces/:spaceId/portals/:portalId

Remove a portal.

### GET /portals/eligible-spaces/:channelId

List spaces eligible for portaling a channel (all spaces the user belongs to except the source space). Requires auth.

**Response:** Array of Space objects.

---

## Direct Messages

### GET /conversations

List all conversations. Requires auth. Each conversation includes a `muted` boolean indicating whether the current user has muted it.

### GET /conversations/requests

List pending message requests. Requires auth.

### GET /conversations/unreads

Get DM unread counts. Requires auth. Muted conversations are excluded from unread counts.

### POST /conversations/with/:userId

Create or get a 1:1 conversation. Requires auth. Returns `403` if either user has blocked the other. The recipient's messaging privacy preferences determine whether the conversation starts as `accepted` or `pending`:
- If the recipient follows the sender, `msg_privacy_followed` applies
- Else if they share a space, `msg_privacy_spaces` applies
- Otherwise `msg_privacy_all` applies
- `dont_allow` returns `400`; `require_approval` creates a pending message request; `accept_all` creates an accepted conversation

### POST /conversations/groups

Create a group DM. Requires auth. Each participant's `msgPrivacyGroupDm` preference is checked: `dont_allow` returns `400`, `require_approval` adds them as pending, `accept_all` adds them as accepted.

**Body:** `{ name?: string, participantIds: string[] }` (1-9 participants)

### POST /conversations/:conversationId/accept

Accept a message request.

### POST /conversations/:conversationId/decline

Decline a message request.

### POST /conversations/:conversationId/members

Add members to a group DM. Requires auth.

**Body:** `{ userIds: string[] }`

**Response:** Updated conversation object.

### DELETE /conversations/:conversationId/members/me

Leave a group DM.

### PATCH /conversations/:conversationId

Rename a group DM.

**Body:** `{ name: string }`

### PUT /conversations/:conversationId/read

Mark conversation as read.

### PUT /conversations/:conversationId/mute

Mute a conversation. Muted conversations do not generate push notifications or count toward unread totals. The conversation's `muted` field will be `true` in list responses.

### DELETE /conversations/:conversationId/mute

Unmute a conversation.

### DELETE /conversations/:conversationId

Delete a 1:1 DM conversation. Permanently removes all messages, read tracking, and membership. Returns `400` for group conversations (use leave instead). Requires membership.

### GET /conversations/:conversationId/messages

Get messages. Messages from blocked users are filtered out.

**Query:** `before`, `limit`

### POST /conversations/:conversationId/messages

Send a DM. Returns `403` if the other participant has blocked you or vice versa.

**Body:** `{ content: string }`

### POST /conversations/:conversationId/messages/upload

Send a DM with file attachments. Multipart form data with `files` field (max 20 files, max 100MB each; non-video max 10MB).

**Form fields:**
| Field | Type | Required |
|-------|------|----------|
| `content` | string | no |

### POST /conversations/:conversationId/messages/:messageId/attachments

Add attachments to an existing DM. Multipart form data with `files` field.

### PATCH /conversations/:conversationId/messages/:messageId

Edit a DM.

### DELETE /conversations/:conversationId/messages/:messageId

Delete a DM. Author can delete own; global admins can delete any DM.

### PUT /conversations/:conversationId/messages/:messageId/reactions/:emoji

Add a reaction to a DM message. Requires auth.

### DELETE /conversations/:conversationId/messages/:messageId/reactions/:emoji

Remove your reaction from a DM message. Requires auth.

---

## Calls (Voice / Video)

Voice and video calling powered by LiveKit. Supports 1:1 DM calls, group DM calls, and persistent voice channels in spaces.

### Call Types

| Type | Description |
|------|-------------|
| `dm` | 1:1 or group DM call. Initiated by ringing participants. |
| `voice_channel` | Persistent space voice channel. Users join/leave freely (no ringing). |

### Call Status Flow

`ringing` → `active` → `ended`

Voice channel calls skip `ringing` and start as `active`.

### Call Participant Status

`ringing` → `joined` / `declined` / `missed` → `left`

### POST /calls/conversations/:conversationId/call

Initiate a call in a DM or group DM conversation. All accepted conversation members are added as participants with status `ringing` (initiator is `joined`). Returns the call object with a LiveKit token.

**Response:** `{ id, type, conversationId, roomName, status, participants, token: { token, wsUrl } }`

Fails with `400` if a call is already in progress for this conversation. The error includes `data.existingCallId` so the client can offer to join the existing call or end it and start a new one.

Calls that remain in `ringing` status for 60 seconds are automatically ended by the server — unanswered participants are marked as `missed`.

### GET /calls/conversations/:conversationId/call

Get the active call for a conversation, if any.

**Response:** `{ call }` (call object or `null`)

### POST /calls/:callId/respond

Accept or decline an incoming call.

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | string | yes | `accept` or `decline` |

**Response:** Call object. When accepting, includes `token: { token, wsUrl }` for connecting to the LiveKit room. The call transitions to `active` on first accept. If all non-initiator participants decline, the call ends automatically.

### POST /calls/:callId/leave

Leave an active call. For DM calls, the call ends automatically when fewer than 2 participants remain (i.e. when either party hangs up). For voice channels, the call ends only when completely empty.

### POST /calls/:callId/join

Join or rejoin an existing call. Works for participants who left, declined, or missed the call. Updates participant status to `joined` and returns a LiveKit token. If the call was still `ringing`, it transitions to `active`.

**Response:** Call object with `token: { token, wsUrl }`

### POST /calls/:callId/end

Force-end a call for all participants. The caller must be a participant. Terminates the call immediately — all ringing participants are marked as `missed`, the LiveKit room is destroyed, and `call:ended` is emitted to all participants. Use this to clear stale calls that can't be rejoined.

### GET /calls/:callId

Get a call's current state and participants.

### POST /calls/:callId/token

Get a fresh LiveKit token for an existing call (for reconnecting). Must be an active (`joined`) participant.

**Response:** `{ token, wsUrl }`

### POST /calls/channels/:channelId/join

Join a voice channel. The channel must have `type: voice`. Requires space membership and `VIEW_CHANNELS` permission. Creates a new call if none is active, or joins the existing one. Returns the call object with a LiveKit token.

**Response:** `{ id, type, channelId, spaceId, roomName, status, participants, token: { token, wsUrl } }`

### POST /calls/channels/:channelId/leave

Leave a voice channel. If no joined participants remain, the call ends.

### GET /calls/channels/:channelId/call

Get the active call for a voice channel (participants currently connected).

**Response:** `{ call }` (call object or `null`)

### Call Object

```json
{
  "id": "161454337128665088",
  "type": "dm",
  "conversationId": "160000000000000000",
  "channelId": null,
  "spaceId": null,
  "roomName": "call_161454337128665088",
  "initiatedBy": "147122562336296960",
  "status": "active",
  "startedAt": "2026-03-22T12:00:00.000Z",
  "endedAt": null,
  "createdAt": "2026-03-22T12:00:00.000Z",
  "participants": [
    {
      "userId": "147122562336296960",
      "username": "alice",
      "displayName": "Alice",
      "avatarUrl": "/uploads/avatar.jpg",
      "baseColor": null,
      "accentColor": null,
      "status": "joined",
      "joinedAt": "2026-03-22T12:00:00.000Z",
      "leftAt": null
    }
  ]
}
```

---

## Follows

Follow-based social system with configurable follow-request approval. All endpoints require auth.

Follows have a `status` field: `pending` (awaiting approval) or `accepted`. The target user's `followRequestPolicy` preference determines which status is used when someone follows them:
- `accept_all` (default): follow is immediately accepted
- `accept_mutual_spaces`: accepted if they share a space, otherwise pending
- `require_approval`: always pending until manually accepted

### GET /follows/feed

Get an aggregated feed of posts from followed users, self, and member spaces with social enabled.

**Query:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `before` | string | - | Cursor for keyset pagination (post ID) |
| `limit` | number | 10 | Max 50 |

**Visibility rules:**
- Own posts: all visibilities
- Mutual follows' posts: `public` and `followers`
- One-way follows (I follow them, they don't follow me): `public` only
- Space posts: always included for space members

**Response:** Array of UserPost objects with author info, attachments, tags, reactions, comment counts, repost data, and optional `spaceAuthor` for space-authored posts.

### GET /follows/feed/search

Search social posts by text or hashtag. Respects per-user visibility rules.

**Query:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `q` | string | - | Search query |
| `hashtag` | string | - | Filter by hashtag (without `#`) |
| `before` | string | - | Cursor for keyset pagination |
| `limit` | number | 20 | Max 50 |

**Response:** Array of UserPost objects.

### GET /follows/posts/:postId

Get a single post by ID. Requires auth. Space posts are always visible to members; user posts are filtered by visibility based on relationship to the author.

**Response:** UserPost object with author info, attachments, tags, reactions, comment count, repost data.

### GET /follows/spaces/:spaceId/posts

List social posts authored by a specific space. Public. Requires the space to have `socialEnabled = true`.

**Query:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `before` | string | - | Cursor for keyset pagination (post ID) |
| `limit` | number | 20 | Max 50 |

**Response:** Array of UserPost objects with `spaceAuthor` populated.

### GET /follows/requests/pending

List incoming pending follow requests (people who want to follow you).

**Response:** Array of `{ id, username, displayName, avatarUrl, baseColor, accentColor }`

### GET /follows/requests/sent

List outgoing pending follow requests (people you've requested to follow).

**Response:** Array of `{ id, username, displayName, avatarUrl, baseColor, accentColor }`

### POST /follows/requests/:followerId/accept

Accept a pending follow request. Returns `400` if no pending request exists.

### POST /follows/requests/:followerId/decline

Decline a pending follow request. Deletes the pending follow row. Returns `400` if no pending request exists.

### DELETE /follows/followers/:followerId

Remove an accepted follower.

### GET /follows/status/:userId

Get follow status with a user.

**Response:** `{ isFollowing: boolean, isFollowedBy: boolean, followRequestPending: boolean, incomingRequestPending: boolean }`

### GET /follows/counts/:userId

Get follower/following counts for a user (accepted follows only).

**Response:** `{ followingCount: number, followerCount: number }`

### GET /follows/:userId/followers

List a user's accepted followers.

**Response:** Array of `{ id, username, displayName, avatarUrl, baseColor, accentColor }`

### GET /follows/:userId/following

List who a user is following (accepted only).

**Response:** Array of `{ id, username, displayName, avatarUrl, baseColor, accentColor }`

### POST /follows/:userId

Follow a user. Returns `400` if attempting to follow yourself or if a follow request is already pending.

**Response:** `{ status: 'accepted' | 'pending' }` — `pending` means the target requires approval.

### DELETE /follows/:userId

Unfollow a user. Removes the follow row regardless of status (accepted or pending).

**Response:** `204 No Content`

---

## Personal Collections

Users have personal collections for photos, routes, activities, and events that live on their profile (independent of any space). Items have a `visibility` field: `public`, `followers`, `spaces`, or `private`. All endpoints require auth.

### Visibility Rules

Content visibility is resolved based on the viewer's relationship to the owner:
- **Owner**: sees all levels (`public`, `private`, `followers`, `spaces`)
- **Follower** (viewer follows the owner): sees `public`, `followers`, `spaces`
- **Shared space member** (not a follower): sees `public`, `spaces`
- **No relationship**: sees `public` only

### Profile Visibility Gate

When accessing another user's collections (`/users/:userId/collections/*`), the API checks profile visibility. If the viewer cannot see the profile (based on the owner's `profileVisibility` setting and follow status), the response is `{ profilePrivate: true }`.

### Bulk Visibility

#### POST /users/me/collections/bulk-visibility

Update the default visibility for all collection items at once.

**Body:** `{ visibility: 'public' | 'followers' | 'spaces' | 'private' }`

### Personal Gallery

#### GET /users/me/collections/gallery

List own gallery items.

**Query:**
| Param | Type | Default |
|-------|------|---------|
| `before` | string | - |
| `limit` | number | 30 |
| `visibility` | string | - |

#### GET /users/:userId/collections/gallery

List another user's gallery items. Filtered by visibility based on relationship.

**Query:** Same as own gallery.

#### POST /users/me/collections/gallery/upload

Upload gallery items. Multipart form data with `files` field (max 20 files, max 100MB each; non-video max 10MB).

**Form fields:**
| Field | Type | Required |
|-------|------|----------|
| `caption` | string | no |
| `visibility` | string | no |

#### PATCH /users/me/collections/gallery/:itemId

Update a gallery item (caption, visibility).

#### DELETE /users/me/collections/gallery/:itemId

Delete a gallery item.

#### POST /users/me/collections/gallery/:itemId/copy

Copy a personal gallery item to a space media gallery channel.

**Body:** `{ channelId: string }`

### Personal Routes

#### GET /users/me/collections/routes

List own route items.

**Query:** Same as personal gallery.

#### GET /users/:userId/collections/routes

List another user's route items. Filtered by visibility.

#### POST /users/me/collections/routes/upload

Upload a GPX route. Multipart form data with `file` field (single `.gpx` file).

**Form fields:**
| Field | Type | Required |
|-------|------|----------|
| `name` | string | no |
| `description` | string | no |
| `activityType` | string | no |
| `visibility` | string | no |

#### PATCH /users/me/collections/routes/:itemId

Update a route item.

#### DELETE /users/me/collections/routes/:itemId

Delete a route item.

#### POST /users/me/collections/routes/elevation

Fetch elevation data for a set of coordinates. Used by the route builder. Requires auth.

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `coordinates` | [number, number][] | yes | Array of [lng, lat] pairs (1–100) |

**Response:** `{ elevations: number[] }`

#### POST /users/me/collections/routes/route

Compute a routed path through waypoints. Used by the route builder. Requires auth.

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `waypoints` | [number, number][] | yes | Array of [lng, lat] pairs (2+) |
| `profile` | string | no | `bike` or `foot` (default: `bike`) |

**Response:** Route geometry (GeoJSON LineString coordinates with distance/elevation metadata).

#### POST /users/me/collections/routes/:itemId/copy

Copy a personal route to a space route library channel.

**Body:** `{ channelId: string }`

### Personal Activities

Activity items track physical activities (runs, bikes, walks, hikes) with GPX data. Uploading an activity auto-creates a linked user post for the feed. Visibility of activities to other users is also gated by the `activitiesVisibility` preference (`public` or `private`).

#### GET /users/me/collections/activities

List own activity items.

**Query:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `before` | string | - | Cursor for pagination |
| `limit` | number | 30 | 1–100 |
| `visibility` | string | - | Filter by visibility |
| `activityType` | string | - | Filter by type: `run`, `bike`, `walk`, `hike` |

**Response:** Array of `PersonalActivityItem` objects.

#### GET /users/:userId/collections/activities

List another user's activity items. Filtered by visibility and the owner's `activitiesVisibility` preference.

**Query:** Same as own activities.

#### GET /users/me/collections/activities/stats

Get aggregated activity stats grouped by activity type.

**Query:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `period` | string | `ytd` | One of: `ytd`, `year`, `previous_year`, `month`, `week`, `all` |
| `year` | number | current year | Year to filter on (2000–2100) |

**Response:**
```json
{
  "period": "ytd",
  "stats": [
    {
      "activityType": "run",
      "totalDistanceKm": 123.4,
      "totalDurationSec": 45000,
      "totalElevationGainM": 1500,
      "activityCount": 12
    }
  ]
}
```

#### GET /users/:userId/collections/activities/stats

Get another user's activity stats. Respects `activitiesVisibility` preference.

**Query:** Same as own activity stats.

#### POST /users/me/collections/activities/upload

Upload a GPX activity. Multipart form data with `file` field (single `.gpx` file). Auto-creates a linked user post.

**Form fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | 1–255 chars |
| `description` | string | no | Max 5000 chars |
| `activityType` | string | yes | `run`, `bike`, `walk`, or `hike` |
| `visibility` | string | no | Defaults to `private` |
| `startedAt` | string | no | ISO 8601 datetime |

**Response:** `PersonalActivityItem` with linked `userPostId`.

#### GET /users/me/collections/activities/:itemId

Get a single activity item.

#### PATCH /users/me/collections/activities/:itemId

Update an activity item. Visibility changes propagate to the linked user post.

**Body:**
| Field | Type | Required |
|-------|------|----------|
| `name` | string | no |
| `description` | string | no |
| `visibility` | string | no |

#### DELETE /users/me/collections/activities/:itemId

Delete an activity item. Also deletes the linked user post.

#### POST /users/me/collections/activities/:itemId/save-as-route

Convert an activity into a personal route item. Copies GPX data, name, description, and visibility. Activity type is mapped (`run`→`run`, `bike`→`ride`, `walk`/`hike`→`walk`).

**Response:** The newly created `PersonalRouteItem`.

### Personal Events

#### GET /users/me/collections/events

List own personal events.

**Query:**
| Param | Type | Default |
|-------|------|---------|
| `from` | string | - |
| `to` | string | - |
| `limit` | number | 50 |
| `visibility` | string | - |

#### GET /users/:userId/collections/events

List another user's events. Filtered by visibility.

#### POST /users/me/collections/events

Create a personal event.

#### PATCH /users/me/collections/events/:eventId

Update a personal event.

#### DELETE /users/me/collections/events/:eventId

Delete a personal event.

#### POST /users/me/collections/events/:eventId/copy

Copy a personal event to a space calendar.

**Body:** `{ spaceId: string }`

### Personal Event Meeting Rooms

Personal events can have meeting rooms, similar to space calendar events. Events must have `meetingRoomEnabled: true`, `eventTime`, and `endTime` set.

**Create/update fields:**
| Field | Type | Description |
|-------|------|-------------|
| `endTime` | string \| null | `HH:mm` end time |
| `meetingRoomEnabled` | boolean | Enable meeting room |
| `meetingRoomEarlyEntry` | number | Minutes before event to allow entry (-1 = anytime, 0-120) |

#### POST /users/me/collections/events/:eventId/room/join

Join the meeting room for a personal event. Must be the event owner. Event must be today with meeting room enabled.

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `date` | string | no | `YYYY-MM-DD`, override date |

**Response:** `{ call, token: { token, wsUrl }, meetingRoom }` — includes the LiveKit token for voice/video.

#### POST /users/me/collections/events/:eventId/room/leave

Leave the meeting room. If no participants remain, the room is closed and the LiveKit room is destroyed.

**Response:** `204 No Content`

### Personal Event Categories

#### GET /users/me/collections/events/categories

List own event categories.

#### POST /users/me/collections/events/categories

Create a personal event category.

**Body:** `{ name: string, color: string }`

#### PATCH /users/me/collections/events/categories/:categoryId

Update a category.

#### DELETE /users/me/collections/events/categories/:categoryId

Delete a category.

### Collection Summary

#### GET /users/me/collections/summary

Get counts across all own collections.

**Response:** `{ galleryCount, routeCount, eventCount, postCount, activityCount }`

#### GET /users/:userId/collections/summary

Get summary for another user's collections. Filtered by visibility.

**Response:** Same shape as own summary.

### Aggregated Upcoming Events

#### GET /users/me/events/upcoming

List upcoming calendar events across all spaces the user belongs to (where `calendar_enabled` is true). Events where the user has RSVP'd `not_going` are excluded. Includes space metadata for display.

**Query:**
| Param | Type | Default |
|-------|------|---------|
| `limit` | number (1–50) | 20 |

**Response:** `CalendarEvent[]` — each item includes the standard CalendarEvent fields plus:
| Field | Type | Description |
|-------|------|-------------|
| `spaceName` | string \| null | Name of the space the event belongs to |
| `spaceSlug` | string \| null | Slug of the space |
| `spaceIconUrl` | string \| null | Icon URL of the space |
| `spaceBaseColor` | string \| null | Space base color |
| `spaceAccentColor` | string \| null | Space accent color |

Events include `rsvpCounts` and `myRsvp` fields. Sorted by `eventDate` ascending, then `eventTime` ascending.

### Aggregated Recent Blog & Newsletter Posts

#### GET /users/me/posts/recent

List recent published blog posts and newsletters across all spaces the user belongs to (where the respective feature is enabled). Results are merged and sorted by recency.

**Query:**
| Param | Type | Default |
|-------|------|---------|
| `limit` | number (1–30) | 10 |

**Response:** Array of items, each with an `itemType` field (`'blog'` or `'newsletter'`) plus the respective type's fields:

**Blog items** include: `id`, `spaceId`, `authorId`, `title`, `summary`, `content`, `status`, `isPublic`, `publishedAt`, `createdAt`, `updatedAt`, `author`, `spaceName`, `spaceSlug`, `spaceIconUrl`.

**Newsletter items** include: `id`, `spaceId`, `authorId`, `subject`, `summary`, `headerImageUrl`, `status`, `isPublic`, `publishedAt`, `createdAt`, `updatedAt`, `author`, `spaceName`, `spaceSlug`, `spaceIconUrl`. Note: `blocks` are omitted from list responses for brevity.

Sorted by ID descending (most recent first).

---

## User Posts

Social posts that live on a user's or space's profile. Posts support text, file attachments, tagged users (must follow the tagged user), visibility controls, reactions, comments, and reposts. Posts can optionally be authored on behalf of a space (requires `MANAGE_SOCIAL` permission and `socialEnabled` on the space). Space-authored posts are always `public` visibility. All endpoints require auth.

### Own Posts

#### GET /users/me/posts

List own posts.

**Query:**
| Param | Type | Default |
|-------|------|---------|
| `before` | string | - |
| `limit` | number | 20 |

**Response:** Array of UserPost objects with attachments, tags, reactions, comment counts, repost data, and optional `spaceId`, `metadata`, and `spaceAuthor` fields for space-authored posts.

#### POST /users/me/posts

Create a post. Multipart form data with optional `files` field (max 20).

**Form fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `body` | string | no | Post text (required if no attachments) |
| `visibility` | string | no | `public`, `followers`, or `private` (forced to `public` for space posts) |
| `taggedUserIds` | string | no | JSON array of user IDs to tag |
| `existingGalleryItemIds` | string | no | JSON array of gallery item IDs to attach |
| `existingRouteItemIds` | string | no | JSON array of route item IDs to attach |
| `spaceId` | string | no | Space ID to post on behalf of. Requires `MANAGE_SOCIAL` permission and `socialEnabled` on the space. |

#### PATCH /users/me/posts/:postId

Update a post (body, visibility).

#### DELETE /users/me/posts/:postId

Delete a post.

#### PUT /users/me/posts/:postId/pin

Pin a post to the top of your profile. Only one post can be pinned at a time.

#### DELETE /users/me/posts/:postId/pin

Unpin a post.

#### POST /users/me/posts/:postId/share-to-channel

Share a post to a space channel as a message.

**Body:** `{ channelId: string, content?: string }`

#### POST /users/me/posts/:postId/share-to-dm

Share a post to a DM conversation.

**Body:** `{ conversationId: string }`

#### POST /users/me/collections/galleries/:itemId/share-to-dm

Share a personal gallery item to a DM conversation.

**Body:** `{ conversationId: string }`

#### POST /users/me/collections/routes/:itemId/share-to-dm

Share a personal route to a DM conversation.

**Body:** `{ conversationId: string }`

#### POST /users/me/collections/events/:eventId/share-to-dm

Share a personal event to a DM conversation.

**Body:** `{ conversationId: string }`

### Reposts

#### POST /users/me/posts/repost

Repost another user's post to your own profile.

**Body:**
| Field | Type | Required |
|-------|------|----------|
| `originalPostId` | string | yes |
| `visibility` | string | no |
| `body` | string | no |

### Other Users' Posts

#### GET /users/:userId/posts

List another user's posts. Filtered by visibility based on relationship.

### Post Reactions

#### PUT /users/me/posts/:postId/reactions/:emoji

Add a reaction to own post.

#### DELETE /users/me/posts/:postId/reactions/:emoji

Remove a reaction from own post.

#### PUT /users/:userId/posts/:postId/reactions/:emoji

Add a reaction to another user's post.

#### DELETE /users/:userId/posts/:postId/reactions/:emoji

Remove a reaction from another user's post.

### Post Comments

Comments can optionally be authored on behalf of a space by including `spaceId` in the body. Requires `MANAGE_SOCIAL` permission and `socialEnabled` on the space. When a comment has a `spaceId`, its `author` field shows the space's identity (name, slug, icon) instead of the user's.

#### GET /users/me/posts/:postId/comments

List comments on own post. Returns nested comment tree.

**Query:** `before`, `limit`

**Response:** Array of comment objects with `author`, `reactions`, and nested `replies`.

#### POST /users/me/posts/:postId/comments

Add a comment to own post.

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `body` | string | yes | 1-4000 chars |
| `parentCommentId` | string | no | Reply to a specific comment |
| `spaceId` | string | no | Comment as a space (requires `MANAGE_SOCIAL`) |

#### DELETE /users/me/posts/:postId/comments/:commentId

Delete a comment (comment author or post owner).

#### GET /users/:userId/posts/:postId/comments

List comments on another user's post. Returns nested comment tree.

**Query:** `before`, `limit`

#### POST /users/:userId/posts/:postId/comments

Add a comment to another user's post.

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `body` | string | yes | 1-4000 chars |
| `parentCommentId` | string | no | Reply to a specific comment |
| `spaceId` | string | no | Comment as a space (requires `MANAGE_SOCIAL`) |

#### DELETE /users/:userId/posts/:postId/comments/:commentId

Delete a comment (comment author or post owner).

### Comment Reactions

#### PUT /users/posts/comments/:commentId/reactions/:emoji

Add a reaction to a comment.

#### DELETE /users/posts/comments/:commentId/reactions/:emoji

Remove a reaction from a comment.

---

## Notifications

### GET /notifications

List notifications (paginated). Requires auth.

Notification types: `mention`, `reply`, `reaction`, `dm`, `dm_request`, `follow_request`, `portal_invite`, `event_cancelled`, `event_rsvp`, `new_event`, `new_blog_post`, `post_tag`, `post_comment`.

The `new_event` notification is sent to all space members when a calendar event is created. It includes `spaceName`, `eventName`, `eventDate`, `eventTime`, `spaceId`, and `eventId` in the notification data. It also triggers a push notification and deep links to the event in the space calendar.

The `event_rsvp` notification is sent to the event creator when another user RSVPs to their event. It includes `eventId`, `eventName`, `eventDate`, `eventTime`, `spaceId`, `spaceName`, `rsvpUsername`, `rsvpDisplayName`, and `rsvpStatus`. Clicking the notification navigates to the event in the space calendar.

The `event_cancelled` notification is sent to all users who RSVP'd "going" or "maybe" when an event is cancelled or deleted. It includes `eventId`, `eventName`, `eventDate`, `eventTime`, `spaceId`, and `spaceName`.

The `new_blog_post` notification is sent to all space members when a blog post is published (respects per-member blog mute preference). It includes `postId`, `postTitle`, `spaceName`, `spaceSlug`, `spaceId`, `spaceIconUrl`, and `authorUsername` in the notification data. The push notification uses the space icon as its image. Clicking the notification navigates to the blog post within the space.

### GET /notifications/unread-count

Get unread notification count.

### PUT /notifications/:id/read

Mark a notification as read.

### PUT /notifications/read-all

Mark all notifications as read.

---

## Push Notification Devices

Register device tokens for native push notifications (APNs for iOS, FCM for Android). All endpoints require auth.

Each device can register two tokens: a `standard` token for regular notifications (messages, follows, etc.) and a `voip` token for incoming call notifications. iOS apps should register their PushKit VoIP token separately from the regular APNs token.

### Token Types

| Type | Description |
|------|-------------|
| `standard` | Regular push notifications (APNs / FCM). Default. |
| `voip` | VoIP push for incoming calls. iOS only — triggers CallKit for the native incoming call screen. |

### Push Behavior for Calls

When a call is initiated, pushes are sent to all participants (regardless of online status):

- **iOS VoIP tokens**: PushKit push with `pushType: voip`, topic `ac.crab.mobile.voip`, data-only payload (`callId`, `conversationId`, `callerName`, `callerAvatarUrl`). Expires after 60 seconds (matching the ringing timeout).
- **iOS standard tokens (fallback)**: If no VoIP token is registered, a regular APNs alert notification is sent with the call data in the payload. This ensures call notifications work before the app is updated to register PushKit tokens.
- **Android tokens**: High-priority data-only FCM message (no `notification` block) so the app can display a full-screen incoming call UI.

For group DM calls, `callerName` is set to the conversation name (if the group has one) instead of the individual caller's name. For 1:1 DMs, it remains the caller's display name.

When a call is answered or ended, silent push notifications with `type: call_answered_elsewhere` or `type: call_ended` are sent to cancel ringing on other devices.

### POST /devices/register

Register or update a device token for push notifications.

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | string | yes | Device push token |
| `platform` | string | yes | `ios` or `android` |
| `appVersion` | string | no | App version string |
| `tokenType` | string | no | `standard` (default) or `voip` |

**Response:** `{ success: true }`

iOS apps should make two registration calls: one for the regular APNs token and one for the PushKit VoIP token:
```
POST /devices/register  { token: "<apns-token>", platform: "ios" }
POST /devices/register  { token: "<pushkit-token>", platform: "ios", tokenType: "voip" }
```

### DELETE /devices/:token

Unregister a device token.

**Response:** `204 No Content`

---

## Announcements

### GET /announcements/active

Get active system announcements. Requires auth.

### GET /announcements/unseen

Get unseen announcements. Requires auth.

### POST /announcements/dismiss

Dismiss announcements. Requires auth.

---

## Public Boards, Galleries, Routes & Blog

These endpoints power the public-facing web views (`/boards/:slug`, `/gallery/:slug`, `/routes/:slug`, `/blog/:slug`). They use optional authentication - logged-in space members see full content, while anonymous users see public content only (if `allowAnonymousBrowsing` is enabled).

### Board Auth

#### POST /boards/auth/register

Register a board-only user account for posting on public boards.

**Body:** `{ spaceSlug, email, username, displayName, password }`

#### POST /boards/auth/login

Log in as a board user.

**Body:** `{ login, password }`

### Site Config

#### GET /boards/site-config/:spaceSlug

Get public site configuration for a space, including enabled features, navbar settings, and theme. Used by the frontend to render cross-page navigation. No auth required.

**Response:**
```json
{
  "space": {
    "id": "...",
    "name": "My Space",
    "slug": "my-space",
    "description": null,
    "iconUrl": null,
    "publicTheme": null
  },
  "enabledFeatures": ["boards", "gallery", "routes"],
  "navFeatures": ["boards", "routes"],
  "navLinks": [
    { "label": "Our Website", "url": "https://example.com" }
  ]
}
```

- `enabledFeatures` — all public features enabled in admin settings
- `navFeatures` — features shown in the navbar (`enabledFeatures` minus `publicNavDisabledFeatures`)
- `navLinks` — custom external links configured by the admin

Returns `404` if no public features are enabled.

### Board Endpoints

#### GET /boards/:spaceSlug

List public channels (forums, galleries, and route libraries) for a space. Requires `allowPublicBoards`, `allowPublicGalleries`, or `allowPublicRoutes`.

#### GET /boards/:spaceSlug/:channelName

List threads in a public forum channel.

#### GET /boards/:spaceSlug/:channelName/:threadId

Get a thread and its posts.

#### POST /boards/:spaceSlug/:channelName/threads

Create a thread. Requires board auth.

#### POST /boards/:spaceSlug/:channelName/:threadId/posts

Create a post. Requires board auth.

#### GET /boards/:spaceSlug/:channelName/gallery

List items in a public gallery channel.

### Public Route Library

#### GET /boards/:spaceSlug/all-routes

List all public routes across all route_library channels in a space. Supports the same query params as channel-specific route listing. Optionally filter by `channelId`.

**Query:** Same as `GET /channels/:channelId/routes` plus optional `channelId` filter.

**Response:** Array of RouteItem objects.

#### GET /boards/:spaceSlug/:channelName/routes

List public route items in a specific route library channel.

**Query:** Same as `GET /channels/:channelId/routes`.

#### GET /boards/:spaceSlug/:channelName/route-categories

Get route categories for the space (via any public route library channel).

#### POST /boards/:spaceSlug/:channelName/routes/:routeId/star

Star a public route. Requires auth.

#### DELETE /boards/:spaceSlug/:channelName/routes/:routeId/star

Unstar a public route. Requires auth.

### Public Calendar

#### GET /boards/calendar/:spaceSlug

Get public calendar space info and categories. Requires `allowPublicCalendar` in space settings. Anonymous access requires `allowAnonymousBrowsing`.

**Response:** `{ space: { id, name, slug, description, iconUrl }, categories: [...] }`

#### GET /boards/calendar/:spaceSlug/events

Get public calendar events. Authenticated space members see all events; others see only events where `isPublic` is true.

**Query:** `from=YYYY-MM-DD&to=YYYY-MM-DD`

**Response:** `CalendarEvent[]`

#### GET /boards/calendar/:spaceSlug/feed.ics

ICS calendar feed for subscribing in calendar apps (Apple Calendar, Google Calendar, Outlook, etc.). No auth required. Requires `allowPublicCalendar` in space settings.

Returns events from 6 months back to 12 months forward. Authenticated space members see all events; anonymous users see only public events. RFC 5545 compliant.

**Response:** `text/calendar` (`.ics` file)

### Public Blog

#### GET /boards/blog/:spaceSlug

List public published blog posts. Requires `allowPublicBlog` in space settings. Anonymous access requires `allowAnonymousBrowsing`.

**Query:**
| Param | Type | Default |
|-------|------|---------|
| `before` | string | - |
| `limit` | number | 20 |

**Response:** `{ space, posts: BlogPost[] }`

#### GET /boards/blog/:spaceSlug/:postId

Get a single public blog post. Same access requirements as listing.

**Response:** `{ space, post: BlogPost }`

#### GET /boards/blog/:spaceSlug/feed.xml

RSS 2.0 feed of public published blog posts. No auth required. Requires `allowPublicBlog` in space settings. Returns the 50 most recent public posts.

**Response:** `application/rss+xml`

---

## Newsletter

### Space Newsletters

All space newsletter endpoints require auth + space membership unless noted.

#### GET /spaces/:spaceId/newsletters

List space newsletters. Requires membership.

**Query:**
| Param | Type | Default |
|-------|------|---------|
| `limit` | number | 20 |
| `before` | string | - |
| `status` | string | - | `draft` or `published` |

#### GET /spaces/:spaceId/newsletters/:id

Get a single space newsletter. Requires membership.

#### POST /spaces/:spaceId/newsletters

Create a space newsletter. Requires `MANAGE_NEWSLETTER`.

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `subject` | string | yes | Max 500 chars |
| `summary` | string \| null | no | Max 500 chars |
| `headerImageUrl` | string \| null | no | Max 512 chars |
| `blocks` | array | yes | Block editor content (max 100 blocks) |
| `status` | string | no | `draft` (default) or `published` |
| `isPublic` | boolean | no | Visible on public newsletter page |

Block types: `text`, `image`, `image_gallery`, `quote`, `divider`, `embed`, `section_heading`.

If `status` is `published`, email sends are enqueued automatically.

#### PATCH /spaces/:spaceId/newsletters/:id

Update a newsletter. Author can edit own; otherwise requires `MANAGE_NEWSLETTER`. Enqueues sends when transitioning from draft to published.

#### DELETE /spaces/:spaceId/newsletters/:id

Delete a newsletter. Requires `MANAGE_NEWSLETTER`.

#### POST /spaces/:spaceId/newsletters/upload-image

Upload an image for newsletter content. Requires `MANAGE_NEWSLETTER`. Multipart form data with `image` field (max 5MB, images only).

**Response:** `{ url: string }`

#### GET /spaces/:spaceId/newsletters/:id/stats

Get analytics for a specific newsletter. Requires `MANAGE_NEWSLETTER`.

#### GET /spaces/:spaceId/newsletter-analytics

Get analytics summary for all space newsletters. Requires `MANAGE_NEWSLETTER`.

#### GET /spaces/:spaceId/newsletter-stats

Get aggregated newsletter statistics. Requires `MANAGE_NEWSLETTER`.

**Response:** `{ drafts, published, subscribers }`

#### GET /spaces/:spaceId/newsletter-subscribers/count

Get subscriber counts for space newsletters. Requires `MANAGE_NEWSLETTER`.

### Personal Newsletters

All personal newsletter endpoints require auth.

#### GET /users/me/newsletters

List own personal newsletters.

**Query:** Same as space newsletters.

#### POST /users/me/newsletters

Create a personal newsletter. Same body as space newsletters.

#### PATCH /users/me/newsletters/:id

Update own personal newsletter. Author only.

#### DELETE /users/me/newsletters/:id

Delete own personal newsletter. Author only.

#### POST /users/me/newsletters/upload-image

Upload an image for personal newsletter content. Multipart form data with `image` field.

### Newsletter Subscriptions (Authenticated)

#### GET /newsletter-subscriptions

List own active subscriptions. Requires auth.

#### GET /newsletter-subscriptions/check?sourceType=...&sourceId=...

Check subscription status for a specific source. Requires auth.

#### POST /newsletter-subscriptions

Subscribe to a newsletter. Requires auth.

**Body:**
| Field | Type | Required |
|-------|------|----------|
| `sourceType` | string | yes | `space` or `user` |
| `sourceId` | string | yes | Space ID or user ID |
| `frequency` | string | no | `immediate` (default), `daily_digest`, or `weekly_digest` |

#### PATCH /newsletter-subscriptions/:id

Update subscription preferences. Requires auth (must own subscription).

**Body:** `{ frequency?, isActive? }`

#### DELETE /newsletter-subscriptions/:id

Unsubscribe. Requires auth (must own subscription).

### Newsletter Public Endpoints (No Auth)

#### POST /newsletter-public/subscribe

Anonymous email subscription.

**Body:**
| Field | Type | Required |
|-------|------|----------|
| `email` | string | yes | Max 255 chars |
| `sourceType` | string | yes | `space` or `user` |
| `sourceId` | string | yes | |
| `frequency` | string | no | `immediate` (default), `daily_digest`, or `weekly_digest` |

#### GET /newsletter-public/verify/:token

Verify anonymous subscription via email link.

#### GET /newsletter-public/unsubscribe/:token

Unsubscribe via email link.

#### GET /newsletter-public/preferences/:token

Get subscription preferences via token.

#### PATCH /newsletter-public/preferences/:token

Update preferences via token.

**Body:** `{ frequency?, isActive? }`

#### GET /newsletter-public/space/:spaceSlug

List published public newsletters for a space. Requires `allowPublicNewsletter` in space settings.

**Response:** `{ space, newsletters }`

#### GET /newsletter-public/space/:spaceSlug/:newsletterId

Read a single published public space newsletter.

#### GET /newsletter-public/user/:username

List published public personal newsletters for a user.

**Response:** `{ user, newsletters }`

#### GET /newsletter-public/user/:username/:newsletterId

Read a single published personal newsletter.

### Newsletter Tracking (No Auth)

#### GET /newsletter-track/open/:trackingToken

Open tracking pixel. Returns a 1x1 GIF.

#### GET /newsletter-track/click/:trackingToken?url=...

Click tracking redirect. Records the click and 302 redirects to the provided URL.

---

## Admin

All admin endpoints require the user to have `isAdmin: true`.

### GET /admin/spaces

List all spaces.

### GET /admin/users

List all users.

### Global App Bans

#### GET /admin/bans

List all globally banned users.

**Response:** Array of `{ userId, bannedBy, reason, createdAt, user: { id, username, displayName, email } }`

#### POST /admin/bans/:userId

Ban a user globally. Returns `409` if already banned.

**Body:** `{ reason?: string }`

#### DELETE /admin/bans/:userId

Unban a user globally.

### GET /admin/announcements

List announcements.

### POST /admin/announcements

Create an announcement.

### PATCH /admin/announcements/:id

Update an announcement.

### DELETE /admin/announcements/:id

Delete an announcement.

### POST /admin/spaces/:spaceId/feature

Toggle a space's featured status.

### GET /admin/tags

List predefined space tags.

### POST /admin/tags

Create a predefined tag.

### DELETE /admin/tags/:id

Delete a predefined tag.

---

## Webhooks (Incoming)

Incoming webhook endpoints use secret-based authorization rather than Bearer tokens. The secret is generated per-space via admin settings.

### POST /webhooks/:secret/:slug

Receive an incoming webhook. Rate limited to 60/min per secret.

**Auth:** None (secret validated against `space_settings.webhook_secret` where `webhooks_enabled = true`)

**Body:** JSON payload (max 64KB)

**Response:** `{ ok: true }`

Fires a `webhook` trigger into the workflow engine with context `{ spaceId, webhookSlug, webhookMethod: 'POST', webhookPayload }`. Returns `404` for invalid/missing secrets.

### GET /webhooks/:secret/:slug

Same as POST but payload comes from query parameters, `webhookMethod: 'GET'`.

---

## Workflows

Workflows are space-scoped automations that respond to triggers (member joins, messages, commands, webhooks) by executing actions (send messages, manage roles, create cards). All management endpoints require `MANAGE_WORKFLOWS` permission unless noted.

### Workflow CRUD

#### GET /spaces/:spaceId/workflows

List all workflows for a space.

#### POST /spaces/:spaceId/workflows

Create a workflow.

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Max 200 chars |
| `description` | string \| null | no | Max 2000 chars |
| `triggerType` | string | yes | See trigger types below |
| `triggerConfig` | object \| null | no | Trigger-specific config |
| `conditions` | object \| null | no | Condition tree (AND/OR) |
| `actions` | array | yes | 1-20 actions |
| `enabled` | boolean | no | Default `true` |

**Trigger types:** `member_joined`, `message_created`, `image_uploaded`, `gpx_uploaded`, `slash_command`, `card_interaction`, `webhook`

**Action types:** `send_message`, `send_admin_message`, `add_role`, `remove_role`, `copy_images_to_gallery`, `copy_routes_to_library`, `show_card`, `update_card`, `dismiss_card`, `send_webhook`

**Condition types (nested AND/OR tree, each rule supports `negate`):** `user_has_role`, `channel_is`, `message_contains`, `message_equals`, `command_arg_equals`, `card_field_equals`, `card_field_not_null`, `invite_code_is`, `button_is`, `webhook_payload_equals`

#### GET /spaces/:spaceId/workflows/details/:id

Get a single workflow.

#### PUT /spaces/:spaceId/workflows/details/:id

Update a workflow.

**Body:** Same fields as create, all optional.

#### DELETE /spaces/:spaceId/workflows/details/:id

Delete a workflow.

#### PATCH /spaces/:spaceId/workflows/details/:id/toggle

Toggle a workflow's enabled/disabled state.

### Execution Logs

#### GET /spaces/:spaceId/workflows/executions

List workflow execution logs.

**Query:**
| Param | Type | Default |
|-------|------|---------|
| `workflowId` | string | - |
| `limit` | number | 50 |
| `before` | string | - |

**Response:** Array of execution objects with `workflowName`, `status` (`success`, `partial`, `error`, `skipped`), `actionsRun`, `actionsTotal`, `errorMessage`, `durationMs`.

### Custom Commands

Custom slash commands that trigger workflows. Command listing is available to all space members; management requires `MANAGE_WORKFLOWS`.

#### GET /spaces/:spaceId/workflows/commands

List custom commands. Requires **space membership** (any member).

**Response:** Array of `{ id, spaceId, name, description, args, createdBy, createdAt }`

#### POST /spaces/:spaceId/workflows/commands

Create a custom command. Requires `MANAGE_WORKFLOWS`.

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | 1-32 chars, lowercase alphanumeric + hyphens |
| `description` | string | yes | 1-200 chars |
| `args` | array \| null | no | Max 10 typed arguments |

**Argument types:** `text`, `number`, `user`, `channel`, `role`, `boolean`

#### PUT /spaces/:spaceId/workflows/commands/:id

Update a custom command. Requires `MANAGE_WORKFLOWS`.

#### DELETE /spaces/:spaceId/workflows/commands/:id

Delete a custom command. Requires `MANAGE_WORKFLOWS`.

#### POST /spaces/:spaceId/workflows/commands/:name/invoke

Invoke a custom command. Requires **space membership** (any member). Fires the `slash_command` workflow trigger synchronously.

**Body:** `{ channelId: string, args?: Record<string, any> }`

### Card Templates

Interactive cards displayed in channels via workflows. Cards can have fields for user input and buttons for interaction.

#### GET /spaces/:spaceId/workflows/card-templates

List card templates.

#### POST /spaces/:spaceId/workflows/card-templates

Create a card template.

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Max 200 chars |
| `titleTemplate` | string | yes | Max 500 chars, supports `{{variables}}` |
| `bodyTemplate` | string \| null | no | Max 4000 chars |
| `color` | string \| null | no | `#RRGGBB` |
| `fields` | array \| null | no | Max 10 fields |
| `buttons` | array \| null | no | Max 5 buttons |

**Field types:** `text`, `select`, `role`, `user`, `channel`

**Button styles:** `primary`, `secondary`, `danger`

#### PUT /spaces/:spaceId/workflows/card-templates/:id

Update a card template.

#### DELETE /spaces/:spaceId/workflows/card-templates/:id

Delete a card template.

### Card Instances

#### GET /spaces/:spaceId/workflows/cards/:instanceId

Get a card instance with its template. Requires **space membership**.

#### POST /spaces/:spaceId/workflows/cards/:instanceId/interact

Interact with an active card (button click or field submission). Requires **space membership**. Returns `400` if card is not active. Fires the `card_interaction` workflow trigger synchronously.

**Body:** `{ buttonId?: string, fields?: Record<string, string> }`

### Template Variables

Action templates use `{{varName}}` syntax (double curly braces). Single curly braces `{varName}` are also supported for convenience. Available variables depend on trigger:

| Variable | Triggers | Description |
|----------|----------|-------------|
| `spaceName` | all | Space name |
| `space` | all | Alias for `spaceName` |
| `userId`, `username`, `displayName` | all | Triggering user |
| `mention` | all | @mention of the triggering user (e.g. `@jane`) |
| `channelId`, `channelName` | message, image, gpx, command, card | Channel context |
| `messageId`, `messageContent` | message, image, gpx | Message context |
| `imageCount` | image | Number of images |
| `gpxCount` | gpx | Number of GPX files |
| `inviteCode` | member_joined | Invite code used |
| `commandName`, `args.*` | slash_command | Command and arguments |
| `cardInstanceId`, `buttonId`, `fields.*`, `card.*` | card_interaction | Card context |
| `webhookSlug`, `webhookMethod`, `payload.*` | webhook | Webhook context |

---

## Mobile OTA Bundles

Over-the-air update system for mobile apps. Public endpoints require no auth; management requires global admin.

### GET /mobile/update-check (Public)

Check for available OTA updates. Rate limited to 30/min per IP.

**Query:**
| Param | Type | Required |
|-------|------|----------|
| `platform` | string | yes | `ios` or `android` |
| `nativeVersion` | string | yes | Semver (e.g. `1.0.0`) |
| `currentBundleVersion` | number | yes | Current bundle version (int >= 0) |

**Response:** `204 No Content` if no update available, or:
```json
{
  "id": "...",
  "bundleVersion": 5,
  "nativeVersion": "1.0.0",
  "checksum": "sha256...",
  "fileSize": 1234567,
  "downloadUrl": "/api/mobile/bundles/:id/download",
  "isRequired": false,
  "releaseNotes": "..."
}
```

If any intermediate bundle was marked `isRequired`, the update is flagged as required.

### GET /mobile/bundles/:id/download (Public)

Download a bundle file. Returns binary stream with `X-Bundle-Checksum` header.

### POST /mobile/bundles (Admin)

Upload a new OTA bundle. Multipart form data with `bundle` field (max 200MB).

**Form fields:**
| Field | Type | Required |
|-------|------|----------|
| `platform` | string | yes | `ios` or `android` |
| `nativeVersion` | string | yes | Semver |
| `isRequired` | boolean | no | Default `false` |
| `releaseNotes` | string | no | Max 4000 chars |

**Response:** `201` MobileBundle object. Bundle version auto-increments per platform.

### GET /mobile/bundles (Admin)

List bundles with pagination.

**Query:** `platform?`, `status?` (`active`/`inactive`), `limit` (default 50), `offset`

**Response:** `{ bundles: MobileBundle[], total: number }`

### DELETE /mobile/bundles/:id (Admin)

Deactivate a bundle (sets status to `inactive`).

### POST /mobile/bundles/:id/activate (Admin)

Reactivate an inactive bundle.

---

## System

### GET /health

Health check. Returns `{ status: 'ok' }`.

### GET /messages/:messageId

Unified message lookup by ID (works for both channel messages and DMs). Requires auth.

### GET /plugins

List loaded plugins.

---

## WebSocket Events

The API uses Socket.io for real-time communication at `/socket.io/`. Clients authenticate by passing the access token. On connect, the server auto-joins the user to their personal room (`user:<userId>`), all space rooms, and all DM conversation rooms.

### Client Events (emit)

| Event | Payload | Description |
|-------|---------|-------------|
| `channel:join` | `{ channelId }` | Join a channel room |
| `channel:leave` | `{ channelId }` | Leave a channel room |
| `thread:join` | `{ threadId }` | Join a forum thread room |
| `thread:leave` | `{ threadId }` | Leave a forum thread room |
| `message:send` | `{ channelId, content, replyToId? }` | Send a channel message via socket |
| `message:typing` | `{ channelId }` | Channel typing indicator |
| `dm:join` | `{ conversationId }` | Join a DM room (for conversations created after connect) |
| `dm:send` | `{ conversationId, content }` | Send a DM via socket |
| `dm:typing` | `{ conversationId }` | DM typing indicator |
| `space:visit` | `{ spaceId }` | Visit a public space as guest |
| `space:leave_visit` | `{ spaceId }` | Leave a public space guest visit |
| `space:kick_guest` | `{ spaceId, targetUserId }` | Kick a guest (requires `MANAGE_MEMBERS`) |
| `call:respond` | `{ callId, action }` | Accept or decline a call (`action`: `accept` or `decline`) |
| `call:leave` | `{ callId }` | Leave a call |
| `voice:join` | `{ channelId }` | Join a voice channel (returns `voice:joined` with call + token) |
| `voice:leave` | `{ channelId }` | Leave a voice channel |
| `presence:heartbeat` | _(none)_ | Refresh presence TTL |
| `presence:status` | `{ status }` | Set status: `online`, `idle`, `dnd`, `offline` |

### Server Events (listen)

#### Channel Messages

| Event | Payload | Description |
|-------|---------|-------------|
| `message:new` | Message object | New message in a channel |
| `message:updated` | Message object | Message edited |
| `message:deleted` | `{ channelId, messageId }` | Message deleted |
| `message:reactions_updated` | `{ channelId, messageId, reactions }` | Reactions changed on a message |
| `channel:activity` | `{ channelId, authorId, messageId, spaceId }` | New activity in channel (for unread tracking) |

#### Direct Messages

| Event | Payload | Description |
|-------|---------|-------------|
| `dm:new` | Message object | New DM received |
| `dm:updated` | Message object | DM edited |
| `dm:deleted` | `{ conversationId, messageId }` | DM deleted |
| `dm:reactions_updated` | `{ conversationId, messageId, reactions }` | DM reactions changed |
| `dm:typing` | `{ conversationId, userId, username }` | User typing in DM |
| `conversation:created` | Conversation object | New conversation or DM request received |
| `conversation:updated` | Conversation object | Conversation renamed or members changed |
| `conversation:member_left` | `{ conversationId, userId }` | Member left group DM |

#### Space & Members

| Event | Payload | Description |
|-------|---------|-------------|
| `member:typing` | `{ channelId, userId, username }` | User typing in channel |
| `member:presence` | `{ userId, status }` | User presence change (online/idle/dnd/offline) |
| `space:member_joined` | `{ spaceId, userId }` | New member joined space |
| `space:member_left` | `{ spaceId, userId }` | Member left/kicked/banned from space |
| `space:guest_joined` | `{ spaceId, user }` | Guest visited public space |
| `space:guest_left` | `{ spaceId, userId }` | Guest left public space |
| `space:guest_kicked` | `{ spaceId }` | You were kicked from a public space (sent to kicked user) |

#### Forums

| Event | Payload | Description |
|-------|---------|-------------|
| `forum:thread_created` | Thread object | New thread in forum channel |
| `forum:post_created` | Post object | New post in forum thread |
| `forum:thread_updated` | Thread object | Thread pinned/locked/updated |

#### Gallery & Routes

| Event | Payload | Description |
|-------|---------|-------------|
| `gallery:item_created` | GalleryItem object | New gallery item uploaded |
| `gallery:item_deleted` | `{ itemId, channelId }` | Gallery item deleted |
| `route:item_created` | RouteItem object | New route added to library |
| `route:item_deleted` | `{ itemId, channelId }` | Route deleted from library |

#### Follows

| Event | Payload | Description |
|-------|---------|-------------|
| `follow:request_received` | `{ user }` | Follow request received (pending approval) |
| `follow:accepted` | `{ user }` | Follow request accepted |
| `follow:new_follower` | `{ user }` | New follower (auto-accepted) |

#### Calls

| Event | Payload | Description |
|-------|---------|-------------|
| `call:ringing` | `{ call, conversationId }` | Incoming call (sent to each participant's personal room) |
| `call:participant_joined` | `{ call, userId, channelId? }` | Participant joined a call |
| `call:participant_left` | `{ call, userId, channelId? }` | Participant left a call |
| `call:participant_declined` | `{ call, userId }` | Participant declined a call |
| `call:ended` | `{ call, conversationId?, channelId? }` | Call ended (including auto-timeout after 60s ringing) |
| `call:answered_elsewhere` | `{ callId }` | Call was accepted on another device (dismiss incoming UI) |
| `call:declined_elsewhere` | `{ callId }` | Call was declined on another device (dismiss incoming UI) |
| `voice:joined` | Call + token object | Response to `voice:join` with LiveKit connection details |

#### Calendar

| Event | Payload | Description |
|-------|---------|-------------|
| `calendar:room_participant_changed` | `{ eventId, participantCount }` | Meeting room participant count changed |
| `calendar:room_closed` | `{ eventId }` | Meeting room closed (last participant left) |

#### Notifications & Workflows

| Event | Payload | Description |
|-------|---------|-------------|
| `notification:new` | Notification object | New notification |
| `workflow:card_created` | CardInstance object | New card instance created by workflow |
| `workflow:card_updated` | CardInstance object | Card instance state updated |
| `workflow:card_dismissed` | CardInstance object | Card instance dismissed |

---

## Static Files

### GET /uploads/*

Serves uploaded files (avatars, attachments, gallery items, GPX files, blog images). Files are served with security headers including `X-Content-Type-Options: nosniff`. Non-image files are forced to download via `Content-Disposition: attachment`.
