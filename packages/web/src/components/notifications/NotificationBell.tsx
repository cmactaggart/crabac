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
  DMRequestNotificationData,
  FriendRequestNotificationData,
} from '@gud/shared';

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
          fireNotification(`${d.authorUsername} in #${d.channelName}`, d.messagePreview);
          break;
        }
        case 'reply': {
          const d = notification.data as ReplyNotificationData;
          fireNotification(`${d.repliedByUsername} replied`, d.messagePreview);
          break;
        }
        case 'dm_request': {
          const d = notification.data as DMRequestNotificationData;
          fireNotification('New message request', d.fromDisplayName);
          break;
        }
        case 'friend_request': {
          const d = notification.data as FriendRequestNotificationData;
          fireNotification('Friend Request', `${d.fromDisplayName} wants to be friends`);
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
