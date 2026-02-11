export type NotificationType = 'mention' | 'reply' | 'portal_invite' | 'friend_request' | 'dm_request';

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

export type NotificationData =
  | MentionNotificationData
  | ReplyNotificationData
  | PortalInviteNotificationData
  | FriendRequestNotificationData
  | DMRequestNotificationData;

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  data: NotificationData;
  read: boolean;
  createdAt: string;
}
