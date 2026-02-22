export type NotificationType = 'mention' | 'reply' | 'portal_invite' | 'friend_request' | 'dm_request' | 'event_cancelled' | 'post_tag' | 'post_comment';

export interface MentionNotificationData {
  messageId: string;
  channelId: string;
  spaceId: string;
  authorUsername: string;
  channelName: string;
  spaceName: string;
  messagePreview: string;
  mentionType: 'user' | 'everyone' | 'here';
}

export interface ReplyNotificationData {
  messageId: string;
  parentMessageId: string;
  channelId: string;
  spaceId: string;
  repliedByUsername: string;
  channelName: string;
  spaceName: string;
  messagePreview: string;
}

export interface PortalInviteNotificationData {
  inviteId: string;
  sourceSpaceName: string;
  channelName: string;
  requestedByUsername: string;
}

export interface FriendRequestNotificationData {
  friendshipId: string;
  fromUsername: string;
  fromDisplayName: string;
  fromUserId: string;
}

export interface DMRequestNotificationData {
  conversationId: string;
  fromUsername: string;
  fromDisplayName: string;
  fromUserId: string;
}

export interface EventCancelledNotificationData {
  eventId: string;
  eventName: string;
  eventDate: string;
  eventTime: string | null;
  spaceId: string;
  spaceName: string;
}

export interface PostTagNotificationData {
  postId: string;
  taggedByUsername: string;
  taggedByDisplayName: string;
  taggedByUserId: string;
  postPreview: string | null;
}

export interface PostCommentNotificationData {
  postId: string;
  commentId: string;
  commenterUsername: string;
  commenterDisplayName: string;
  commenterUserId: string;
  commentPreview: string;
}

export type NotificationData =
  | MentionNotificationData
  | ReplyNotificationData
  | PortalInviteNotificationData
  | FriendRequestNotificationData
  | DMRequestNotificationData
  | EventCancelledNotificationData
  | PostTagNotificationData
  | PostCommentNotificationData;

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  data: NotificationData;
  read: boolean;
  createdAt: string;
}
