import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useNotificationsStore } from '../../stores/notifications.js';
import { getSocket } from '../../lib/socket.js';
import { NotificationDropdown } from './NotificationDropdown.js';
import { fireNotification } from '../../lib/notifications.js';
import type {
  Notification,
  MentionNotificationData,
  ReplyNotificationData,
  ReactionNotificationData,
  DMRequestNotificationData,
  FollowRequestNotificationData,
  PostCommentNotificationData,
  PostTagNotificationData,
  PortalInviteNotificationData,
  EventCancelledNotificationData,
  NewEventNotificationData,
  EventRsvpNotificationData,
  NewBlogPostNotificationData,
} from '@crabac/shared';

export function NotificationBell() {
  const { unreadCount, addNotification, fetchUnreadCount } = useNotificationsStore();
  const [open, setOpen] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);

  // Listen for real-time notifications
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handler = (notification: Notification) => {
      addNotification(notification);

      // Fire native/OS notification
      switch (notification.type) {
        case 'mention': {
          const d = notification.data as MentionNotificationData;
          if (d.mentionType === 'everyone' || d.mentionType === 'here') {
            fireNotification(`@${d.mentionType} in ${d.spaceName} | #${d.channelName}`, d.messagePreview);
          } else {
            fireNotification(`Mention by @${d.authorUsername} in ${d.spaceName} | #${d.channelName}`, d.messagePreview);
          }
          break;
        }
        case 'reply': {
          const d = notification.data as ReplyNotificationData;
          fireNotification(`Reply from @${d.repliedByUsername} in ${d.spaceName} | #${d.channelName}`, d.messagePreview);
          break;
        }
        case 'dm_request': {
          const d = notification.data as DMRequestNotificationData;
          fireNotification('New message request', d.fromDisplayName);
          break;
        }
        case 'follow_request': {
          const d = notification.data as FollowRequestNotificationData;
          fireNotification('Follow Request', `${d.fromDisplayName} wants to follow you`);
          break;
        }
        case 'post_comment': {
          const d = notification.data as PostCommentNotificationData;
          fireNotification(`${d.commenterDisplayName} commented on your post`, d.commentPreview);
          break;
        }
        case 'post_tag': {
          const d = notification.data as PostTagNotificationData;
          fireNotification(`${d.taggedByDisplayName} tagged you in a post`, d.postPreview || '');
          break;
        }
        case 'reaction': {
          const d = notification.data as ReactionNotificationData;
          fireNotification(`${d.reactedByUsername} reacted ${d.emoji}`, d.messagePreview || `in ${d.spaceName} | #${d.channelName}`);
          break;
        }
        case 'portal_invite': {
          const d = notification.data as PortalInviteNotificationData;
          fireNotification('Portal Invite', `From ${d.sourceSpaceName}`);
          break;
        }
        case 'event_cancelled': {
          const d = notification.data as EventCancelledNotificationData;
          fireNotification('Event Cancelled', `${d.eventName} (${d.eventDate})`);
          break;
        }
        case 'new_event': {
          const d = notification.data as NewEventNotificationData;
          fireNotification(`New event in ${d.spaceName}`, d.eventName);
          break;
        }
        case 'event_rsvp': {
          const d = notification.data as EventRsvpNotificationData;
          fireNotification(`${d.rsvpDisplayName || d.rsvpUsername} RSVP'd ${d.rsvpStatus}`, d.eventName);
          break;
        }
        case 'new_blog_post': {
          const d = notification.data as NewBlogPostNotificationData;
          fireNotification(`New blog post from ${d.spaceName}`, d.postTitle);
          break;
        }
      }
    };
    socket.on('notification:new', handler);
    return () => { socket.off('notification:new', handler); };
  }, [addNotification]);

  // Fetch unread count on mount
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={bellRef}
        onClick={() => setOpen(!open)}
        style={{
          ...styles.btn,
          color: open ? 'var(--accent)' : 'var(--text-secondary)',
        }}
        title="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span style={styles.badge}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <NotificationDropdown onClose={() => setOpen(false)} />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  btn: {
    background: 'none',
    border: 'none',
    fontSize: '1.1rem',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 4,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 2,
    background: 'var(--danger)',
    color: 'white',
    fontSize: '0.6rem',
    fontWeight: 700,
    padding: '1px 4px',
    borderRadius: 8,
    minWidth: 14,
    textAlign: 'center',
    lineHeight: '14px',
  },
};
