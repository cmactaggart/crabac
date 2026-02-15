# crab.ac API Documentation

## API Version 0.1.0

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
| `MANAGE_MEMBERS` | Kick members, assign roles |
| `MANAGE_SPACE` | Edit space settings |
| `CREATE_INVITES` | Create invite links |
| `MANAGE_INVITES` | View/delete invites |
| `ATTACH_FILES` | Upload file attachments |
| `ADD_REACTIONS` | Add emoji reactions |
| `MANAGE_CALENDAR` | Create/edit/delete calendar events and categories |
| `CREATE_THREADS` | Create forum threads |
| `MANAGE_THREADS` | Pin/lock/delete threads |

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

**Response:** User object with `id`, `email`, `username`, `displayName`, `avatarUrl`, `isAdmin`, `emailVerified`, `totpEnabled`, `baseColor`, `accentColor`, `status`, `createdAt`.

### PATCH /users/me

Update current user profile. Requires auth.

**Body:**
| Field | Type | Required |
|-------|------|----------|
| `displayName` | string | no |
| `avatarUrl` | string \| null | no |
| `baseColor` | string \| null | no |
| `accentColor` | string \| null | no |

### POST /users/me/avatar

Upload user avatar. Requires auth. Multipart form data with `avatar` field.

**Response:** `{ avatarUrl }`

### GET /users/preferences

Get user preferences. Requires auth.

**Response:** `{ distanceUnits }`

### PUT /users/preferences

Update user preferences. Requires auth.

**Body:** `{ distanceUnits?: 'metric' | 'imperial' }`

### GET /users/mutes

List muted user IDs. Requires auth.

**Response:** `string[]`

### PUT /users/mutes/:userId

Mute a user. Requires auth.

### DELETE /users/mutes/:userId

Unmute a user. Requires auth.

### GET /users/:userId

Get public profile for a user. Requires auth.

---

## Spaces

### POST /spaces

Create a new space. Requires auth.

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
  "allowAnonymousBrowsing": false,
  "calendarEnabled": false,
  "isPublic": false,
  "requireVerifiedEmail": false,
  "isFeatured": false,
  "baseColor": null,
  "accentColor": null,
  "textColor": null
}
```

### PUT /spaces/:spaceId/admin-settings

Update space admin settings. Requires `MANAGE_SPACE`.

**Body:** Any subset of the settings fields above.

---

## Space Member Settings

### GET /spaces/:spaceId/settings/me

Get notification settings for the current user in a space. Requires auth.

### PUT /spaces/:spaceId/settings/me

Update notification settings. Requires auth.

---

## Space Tags

### GET /spaces/:spaceId/tags

Get space tags. Requires membership or public access.

### PUT /spaces/:spaceId/tags

Update space tags. Requires `MANAGE_SPACE`.

**Body:** `{ tags: string[] }` (max 10 tags, each max 50 chars)

---

## Space Search

### GET /spaces/:spaceId/search?q=...

Search messages in a space. Requires auth.

---

## Public Spaces Directory

### GET /spaces/by-slug/:slug

Get space info by slug. No auth required.

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
| `type` | string | no | `text`, `announcement`, `read_only`, `forum`, `media_gallery` |
| `isPrivate` | boolean | no | |
| `isPublic` | boolean | no | For public board/gallery access |
| `categoryId` | string | no | |

### GET /spaces/:spaceId/channels

List channels. Requires membership or public access. Filtered by user's permission overrides.

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

**Body:** `{ name?, topic?, type?, isPublic?, position? }`

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

Get messages with cursor pagination.

**Query:**
| Param | Type | Default |
|-------|------|---------|
| `before` | string | - |
| `limit` | number | 50 |

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

List thread posts.

### POST /spaces/:spaceId/channels/:channelId/threads/:threadId/posts

Create a post in a thread. Requires `SEND_MESSAGES`.

**Body:** `{ content: string, replyToId?: string }`

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

#### GET /spaces/:spaceId/calendar/events/:id

Get a single event. Requires membership.

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

#### PATCH /spaces/:spaceId/calendar/events/:id

Update an event. Requires `MANAGE_CALENDAR`.

**Body:** Same fields as create, all optional.

#### DELETE /spaces/:spaceId/calendar/events/:id

Delete an event. Requires `MANAGE_CALENDAR`.

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

---

## Direct Messages

### GET /conversations

List all conversations. Requires auth.

### GET /conversations/requests

List pending message requests. Requires auth.

### GET /conversations/unreads

Get DM unread counts. Requires auth.

### POST /conversations/with/:userId

Create or get a 1:1 conversation. Requires auth.

### POST /conversations/groups

Create a group DM. Requires auth.

**Body:** `{ name?: string, participantIds: string[] }` (1-9 participants)

### POST /conversations/:conversationId/accept

Accept a message request.

### POST /conversations/:conversationId/decline

Decline a message request.

### DELETE /conversations/:conversationId/members/me

Leave a group DM.

### PATCH /conversations/:conversationId

Rename a group DM.

**Body:** `{ name: string }`

### PUT /conversations/:conversationId/read

Mark conversation as read.

### GET /conversations/:conversationId/messages

Get messages. Query: `before`, `limit`.

### POST /conversations/:conversationId/messages

Send a DM.

**Body:** `{ content: string }`

### PATCH /conversations/:conversationId/messages/:messageId

Edit a DM.

### DELETE /conversations/:conversationId/messages/:messageId

Delete a DM.

---

## Friends

### GET /friends

List accepted friends. Requires auth.

### GET /friends/requests/pending

List received pending friend requests.

### GET /friends/requests/sent

List sent pending friend requests.

### POST /friends/requests

Send a friend request.

**Body:** `{ userId: string }`

### POST /friends/requests/:friendshipId/accept

Accept a friend request.

### POST /friends/requests/:friendshipId/decline

Decline a friend request.

### DELETE /friends/:friendshipId

Remove a friend.

### GET /friends/status/:userId

Get friendship status with a user.

---

## Notifications

### GET /notifications

List notifications (paginated). Requires auth.

### GET /notifications/unread-count

Get unread notification count.

### PUT /notifications/:id/read

Mark a notification as read.

### PUT /notifications/read-all

Mark all notifications as read.

---

## Announcements

### GET /announcements/active

Get active system announcements. Requires auth.

### GET /announcements/unseen

Get unseen announcements. Requires auth.

### POST /announcements/dismiss

Dismiss announcements. Requires auth.

---

## Public Boards & Galleries

These endpoints power the public-facing web views (`/boards/:slug`, `/gallery/:slug`). They use optional authentication - logged-in space members see full content, while anonymous users see public content only (if `allowAnonymousBrowsing` is enabled).

### Board Auth

#### POST /boards/auth/register

Register a board-only user account for posting on public boards.

**Body:** `{ spaceSlug, email, username, displayName, password }`

#### POST /boards/auth/login

Log in as a board user.

**Body:** `{ login, password }`

### Board Endpoints

#### GET /boards/:spaceSlug

List public channels (forums and galleries) for a space. Requires `allowPublicBoards` or `allowPublicGalleries`.

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

### Public Calendar

#### GET /boards/calendar/:spaceSlug

Get public calendar space info and categories. Requires `allowPublicCalendar` in space settings. Anonymous access requires `allowAnonymousBrowsing`.

**Response:** `{ space: { id, name, slug, description, iconUrl }, categories: [...] }`

#### GET /boards/calendar/:spaceSlug/events

Get public calendar events. Authenticated space members see all events; others see only events where `isPublic` is true.

**Query:** `from=YYYY-MM-DD&to=YYYY-MM-DD`

**Response:** `CalendarEvent[]`

---

## Admin

All admin endpoints require the user to have `isAdmin: true`.

### GET /admin/spaces

List all spaces.

### GET /admin/users

List all users.

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

## System

### GET /health

Health check. Returns `{ status: 'ok' }`.

### GET /messages/:messageId

Unified message lookup by ID (works for both channel messages and DMs). Requires auth.

### GET /plugins

List loaded plugins.

---

## WebSocket Events

The API uses Socket.io for real-time communication at `/socket.io/`. Clients authenticate by passing the access token.

### Client Events (emit)

| Event | Payload | Description |
|-------|---------|-------------|
| `join_space` | `{ spaceId }` | Join a space room |
| `leave_space` | `{ spaceId }` | Leave a space room |
| `join_channel` | `{ channelId }` | Join a channel room |
| `leave_channel` | `{ channelId }` | Leave a channel room |
| `typing_start` | `{ channelId }` | Begin typing indicator |
| `typing_stop` | `{ channelId }` | Stop typing indicator |

### Server Events (listen)

| Event | Payload | Description |
|-------|---------|-------------|
| `message:create` | Message object | New message in a channel |
| `message:update` | Message object | Message edited |
| `message:delete` | `{ id, channelId }` | Message deleted |
| `typing:start` | `{ channelId, userId, username }` | User started typing |
| `typing:stop` | `{ channelId, userId }` | User stopped typing |
| `presence:update` | `{ userId, status }` | User online/offline |
| `channel:create` | Channel object | New channel created |
| `channel:update` | Channel object | Channel updated |
| `channel:delete` | `{ id }` | Channel deleted |
| `member:join` | Member object | New member joined |
| `member:leave` | `{ userId, spaceId }` | Member left/kicked |
| `dm:message` | Message object | New DM received |
| `notification` | Notification object | New notification |
| `space:guests_cleared` | `{ spaceId }` | Guest sessions cleared |

---

## Static Files

### GET /uploads/*

Serves uploaded files (avatars, attachments, gallery items). Files are served with security headers including `X-Content-Type-Options: nosniff`.
