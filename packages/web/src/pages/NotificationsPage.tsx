import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCheck, AtSign, Reply, Zap } from 'lucide-react';
import { useNotificationsStore } from '../stores/notifications.js';
import type { Notification, MentionNotificationData, ReplyNotificationData } from '@crabac/shared';

export function NotificationsPage() {
  const { notifications, loading, hasMore, fetchNotifications, markAsRead, markAllAsRead } = useNotificationsStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    const data = notification.data as any;
    if (data.spaceId && data.channelId) {
      navigate(`/space/${data.spaceId}/channel/${data.channelId}`);
    }
  };

  const loadMore = () => {
    if (notifications.length > 0) {
      fetchNotifications(notifications[notifications.length - 1].id);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Notifications</h2>
        <button onClick={() => markAllAsRead()} style={styles.markAllBtn}>
          <CheckCheck size={16} /> Mark all read
        </button>
      </div>

      <div style={styles.list}>
        {notifications.length === 0 && !loading && (
          <div style={styles.empty}>No notifications yet</div>
        )}

        {notifications.map((n) => (
          <button
            key={n.id}
            style={{
              ...styles.item,
              background: n.read ? 'transparent' : 'rgba(88, 101, 242, 0.08)',
            }}
            onClick={() => handleClick(n)}
          >
            <div style={styles.itemIcon}>
              {n.type === 'mention' && <AtSign size={18} style={{ color: 'var(--accent)' }} />}
              {n.type === 'reply' && <Reply size={18} style={{ color: 'var(--accent)' }} />}
              {n.type === 'portal_invite' && <Zap size={18} style={{ color: 'var(--accent)' }} />}
            </div>
            <div style={styles.itemBody}>
              <div style={styles.itemTitle}>
                {formatTitle(n)}
              </div>
              <div style={styles.itemPreview}>
                {(n.data as any).messagePreview || ''}
              </div>
              <div style={styles.itemTime}>{formatTime(n.createdAt)}</div>
            </div>
            {!n.read && <div style={styles.unreadDot} />}
          </button>
        ))}

        {hasMore && notifications.length > 0 && (
          <button onClick={loadMore} style={styles.loadMore}>
            {loading ? 'Loading...' : 'Load more'}
          </button>
        )}
      </div>
    </div>
  );
}

function formatTitle(n: Notification): string {
  const data = n.data as any;
  switch (n.type) {
    case 'mention': {
      const d = data as MentionNotificationData;
      if (d.mentionType === 'everyone') return `@everyone in #${d.channelName}`;
      if (d.mentionType === 'here') return `@here in #${d.channelName}`;
      return `${d.authorUsername} mentioned you in #${d.channelName}`;
    }
    case 'reply': {
      const d = data as ReplyNotificationData;
      return `${d.repliedByUsername} replied in #${d.channelName}`;
    }
    case 'portal_invite':
      return `Portal invite from ${data.sourceSpaceName}`;
    default:
      return 'Notification';
  }
}

function formatTime(createdAt: string): string {
  const date = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    paddingBottom: 56,
    background: 'var(--bg-primary)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 16px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: '1.1rem',
    fontWeight: 700,
  },
  markAllBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: 'none',
    border: 'none',
    color: 'var(--accent)',
    fontSize: '0.8rem',
    cursor: 'pointer',
    fontWeight: 600,
  },
  list: {
    flex: 1,
    overflowY: 'auto',
  },
  empty: {
    padding: '3rem',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
  },
  item: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    width: '100%',
    textAlign: 'left',
    padding: '12px 16px',
    border: 'none',
    borderBottom: '1px solid var(--border)',
    cursor: 'pointer',
    color: 'var(--text-primary)',
  },
  itemIcon: {
    flexShrink: 0,
    paddingTop: 2,
  },
  itemBody: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    fontSize: '0.88rem',
    fontWeight: 600,
    marginBottom: 2,
  },
  itemPreview: {
    fontSize: '0.82rem',
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemTime: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--accent)',
    flexShrink: 0,
    marginTop: 6,
  },
  loadMore: {
    width: '100%',
    padding: '12px',
    background: 'none',
    border: 'none',
    color: 'var(--accent)',
    fontSize: '0.85rem',
    cursor: 'pointer',
    fontWeight: 500,
  },
};
