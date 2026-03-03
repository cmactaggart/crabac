import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCheck, AtSign, Reply, Zap, CalendarX, Users, Mail, Tag, MessageCircle } from 'lucide-react';
import { useAuthStore } from '../stores/auth.js';
import { useSpacesStore } from '../stores/spaces.js';
import { useNotificationsStore } from '../stores/notifications.js';
import { useFollowsStore } from '../stores/follows.js';
import { useLayoutStore } from '../stores/layout.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { SpaceSidebar } from '../components/layout/SpaceSidebar.js';
import { ProfileSidebar } from '../components/layout/ProfileSidebar.js';
import { Avatar } from '../components/common/Avatar.js';
import type { Notification, MentionNotificationData, ReplyNotificationData, EventCancelledNotificationData, PostCommentNotificationData, PostTagNotificationData } from '@crabac/shared';

export function NotificationsPage() {
  const { notifications, loading, hasMore, fetchNotifications, fetchUnreadCount, markAsRead, markAllAsRead } = useNotificationsStore();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { spaces, fetchSpaces } = useSpacesStore();
  const { channelSidebarOpen } = useLayoutStore();
  const { counts: followCounts, fetchCounts: fetchFollowCounts } = useFollowsStore();

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
    fetchSpaces();
    if (user?.id) fetchFollowCounts(user.id);
  }, []);

  const handleClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    const data = notification.data as any;
    if (data.conversationId) {
      navigate(`/dm/${data.conversationId}`);
    } else if (notification.type === 'post_comment') {
      const d = data as PostCommentNotificationData;
      navigate(`/p/${d.postOwnerUsername}?post=${d.postId}&comment=${d.commentId}`);
    } else if (notification.type === 'post_tag') {
      const d = data as PostTagNotificationData;
      navigate(`/p/${d.taggedByUsername}?post=${d.postId}`);
    } else if (data.spaceId && data.channelId) {
      navigate(`/space/${data.spaceId}/channel/${data.channelId}`);
    }
  };

  const loadMore = () => {
    if (notifications.length > 0) {
      fetchNotifications(notifications[notifications.length - 1].id);
    }
  };

  const notifContent = (
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

        {notifications.map((n) => {
          const avatar = getNotificationAvatar(n);
          return (
            <button
              key={n.id}
              style={{
                ...styles.item,
                background: n.read ? 'transparent' : 'rgba(88, 101, 242, 0.08)',
              }}
              onClick={() => handleClick(n)}
            >
              <div style={styles.itemAvatar}>
                {avatar.src || avatar.name ? (
                  <Avatar src={avatar.src} name={avatar.name} size={36} />
                ) : (
                  <div style={styles.itemIconFallback}>
                    {getNotificationIcon(n.type)}
                  </div>
                )}
              </div>
              <div style={styles.itemBody}>
                <div style={styles.itemTitle}>
                  {formatTitle(n)}
                </div>
                {getPreview(n) && (
                  <div style={styles.itemPreview}>
                    {getPreview(n)}
                  </div>
                )}
                <div style={styles.itemTime}>{formatTime(n.createdAt)}</div>
              </div>
              {!n.read && <div style={styles.unreadDot} />}
            </button>
          );
        })}

        {hasMore && notifications.length > 0 && (
          <button onClick={loadMore} style={styles.loadMore}>
            {loading ? 'Loading...' : 'Load more'}
          </button>
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 56, overflow: 'hidden' }}>
        {notifContent}
      </div>
    );
  }

  // Desktop: Rail | ProfileSidebar | Notification list
  return (
    <div style={styles.layout}>
      <div style={styles.sidebarWrap}>
        <SpaceSidebar spaces={spaces} activeSpaceId={null} />
      </div>
      <div style={{ ...styles.sidebarWrap, width: channelSidebarOpen ? 240 : 0 }}>
        <ProfileSidebar
          avatarUrl={user?.avatarUrl ?? null}
          displayName={user?.displayName || '?'}
          username={user?.username || ''}
          baseColor={user?.baseColor}
          accentColor={user?.accentColor}
          followingCount={followCounts.followingCount}
          followerCount={followCounts.followerCount}
          onLogout={logout}
        />
      </div>
      <div style={styles.main}>
        <div style={{ width: '100%', maxWidth: 700 }}>
          {notifContent}
        </div>
      </div>
    </div>
  );
}

function formatTitle(n: Notification): string {
  const data = n.data as any;
  switch (n.type) {
    case 'mention': {
      const d = data as MentionNotificationData;
      if (d.mentionType === 'everyone') return `@everyone in ${d.spaceName} | #${d.channelName}`;
      if (d.mentionType === 'here') return `@here in ${d.spaceName} | #${d.channelName}`;
      return `Mention by @${d.authorUsername} in ${d.spaceName} | #${d.channelName}`;
    }
    case 'reply': {
      const d = data as ReplyNotificationData;
      return `Reply from @${d.repliedByUsername} in ${d.spaceName} | #${d.channelName}`;
    }
    case 'portal_invite':
      return `Portal invite from ${data.sourceSpaceName}`;
    case 'friend_request':
      return `${data.fromDisplayName} sent you a friend request`;
    case 'dm_request':
      return `${data.fromDisplayName} sent you a message`;
    case 'post_tag':
      return `${data.taggedByDisplayName} tagged you in a post`;
    case 'post_comment':
      return `${data.commenterDisplayName} commented on your post`;
    case 'event_cancelled': {
      const d = data as EventCancelledNotificationData;
      return `Event cancelled: ${d.eventName} (${d.eventDate})`;
    }
    default:
      return 'Notification';
  }
}

function getNotificationAvatar(n: Notification): { src: string | null; name: string } {
  const data = n.data as any;
  switch (n.type) {
    case 'mention': {
      const d = data as MentionNotificationData;
      if (d.mentionType === 'user') return { src: d.authorAvatarUrl || null, name: d.authorUsername };
      return { src: d.spaceIconUrl || null, name: d.spaceName };
    }
    case 'reply': {
      const d = data as ReplyNotificationData;
      return { src: d.repliedByAvatarUrl || null, name: d.repliedByUsername };
    }
    case 'friend_request':
    case 'dm_request':
      return { src: null, name: data.fromDisplayName || data.fromUsername || '?' };
    case 'post_tag': {
      const d = data as PostTagNotificationData;
      return { src: d.taggedByAvatarUrl || null, name: d.taggedByDisplayName || '?' };
    }
    case 'post_comment': {
      const d = data as PostCommentNotificationData;
      return { src: d.commenterAvatarUrl || null, name: d.commenterDisplayName || '?' };
    }
    default:
      return { src: null, name: '' };
  }
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'mention': return <AtSign size={18} style={{ color: 'var(--accent)' }} />;
    case 'reply': return <Reply size={18} style={{ color: 'var(--accent)' }} />;
    case 'portal_invite': return <Zap size={18} style={{ color: 'var(--accent)' }} />;
    case 'post_tag': return <Tag size={18} style={{ color: 'var(--accent)' }} />;
    case 'friend_request': return <Users size={18} style={{ color: 'var(--accent)' }} />;
    case 'dm_request': return <Mail size={18} style={{ color: 'var(--accent)' }} />;
    case 'post_comment': return <MessageCircle size={18} style={{ color: 'var(--accent)' }} />;
    case 'event_cancelled': return <CalendarX size={18} style={{ color: 'var(--danger)' }} />;
    default: return null;
  }
}

function getPreview(n: Notification): string {
  const data = n.data as any;
  return data.messagePreview || data.postPreview || data.commentPreview || '';
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
  layout: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
  },
  sidebarWrap: {
    overflow: 'hidden',
    flexShrink: 0,
    transition: 'width 0.2s ease',
    height: '100%',
  },
  main: {
    flex: 1,
    overflowY: 'auto',
    padding: '2rem',
    display: 'flex',
    justifyContent: 'center',
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
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
  itemAvatar: {
    flexShrink: 0,
    paddingTop: 2,
  },
  itemIconFallback: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: 'var(--bg-tertiary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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
    borderLeft: '2px solid var(--text-muted)',
    paddingLeft: 8,
    marginTop: 3,
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
