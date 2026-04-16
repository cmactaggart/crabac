import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCheck, AtSign, Reply, Zap, CalendarX, CalendarPlus, Calendar, Users, Mail, Tag, MessageCircle, Smile, BookOpen, UserCheck } from 'lucide-react';
import { useAuthStore } from '../stores/auth.js';
import { useSpacesStore } from '../stores/spaces.js';
import { useNotificationsStore } from '../stores/notifications.js';
import { useFollowsStore } from '../stores/follows.js';
import { useLayoutStore } from '../stores/layout.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { SpaceSidebar } from '../components/layout/SpaceSidebar.js';
import { ProfileSidebar } from '../components/layout/ProfileSidebar.js';
import { Avatar } from '../components/common/Avatar.js';
import { NotificationActions, isActionableNotification } from '../components/notifications/NotificationActions.js';
import type { Notification, MentionNotificationData, ReplyNotificationData, ReactionNotificationData, EventCancelledNotificationData, PostCommentNotificationData, PostTagNotificationData } from '@crabac/shared';

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
    } else if (notification.type === 'reaction' && data.spaceId && data.channelId) {
      navigate(`/space/${data.spaceId}/channel/${data.channelId}`);
    } else if (notification.type === 'new_event' && data.spaceId) {
      if (data.postId && data.spaceSlug) {
        navigate(`/p/${data.spaceSlug}?post=${data.postId}`);
      } else {
        navigate(`/space/${data.spaceId}?tab=calendar&event=${data.eventId}`);
      }
    } else if (notification.type === 'event_rsvp' && data.spaceId) {
      navigate(`/space/${data.spaceId}?tab=calendar&event=${data.eventId}`);
    } else if (notification.type === 'event_organizer_needed' && data.spaceId) {
      navigate(`/space/${data.spaceId}?tab=calendar&event=${data.eventId}`);
    } else if (notification.type === 'new_blog_post' && data.spaceId) {
      navigate(`/space/${data.spaceId}?tab=blog&post=${data.postId}`);
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
          const actionable = isActionableNotification(n.type);
          const ItemTag = actionable ? 'div' : 'button';
          return (
            <ItemTag
              key={n.id}
              style={{
                ...styles.item,
                background: n.read ? 'transparent' : 'rgba(88, 101, 242, 0.08)',
                cursor: actionable ? 'default' : 'pointer',
              }}
              onClick={actionable ? undefined : () => handleClick(n)}
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
                {actionable && <NotificationActions notification={n} />}
                <div style={styles.itemTime}>{formatTime(n.createdAt)}</div>
              </div>
              {!n.read && <div style={styles.unreadDot} />}
            </ItemTag>
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
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 56, overflow: 'hidden', background: 'linear-gradient(to bottom, var(--bg-primary), color-mix(in srgb, var(--bg-primary), black 18%))' }}>
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
    case 'follow_request':
      return `${data.fromDisplayName} wants to follow you`;
    case 'dm_request':
      return `${data.fromDisplayName} sent you a message`;
    case 'post_tag':
      return `${data.taggedByDisplayName} tagged you in a post`;
    case 'post_comment':
      return `${data.commenterDisplayName} commented on your post`;
    case 'reaction': {
      const d = data as ReactionNotificationData;
      return `${d.reactedByUsername} reacted ${d.emoji} in ${d.spaceName} | #${d.channelName}`;
    }
    case 'event_cancelled': {
      const d = data as EventCancelledNotificationData;
      return `Event cancelled: ${d.eventName} (${d.eventDate})`;
    }
    case 'new_event': {
      let title = `${data.spaceName || 'A space'} has posted a new event: ${data.eventName || 'an event'}`;
      if (data.eventDate) title += ` ${data.eventDate}`;
      if (data.eventTime) title += ` ${data.eventTime}`;
      return title;
    }
    case 'event_rsvp':
      return `${data.rsvpDisplayName || data.rsvpUsername} RSVP'd ${data.rsvpStatus} to ${data.eventName}`;
    case 'event_organizer_needed': {
      const parts = [data.spaceName || 'A space', 'Organizer Needed', data.eventName || 'an event'];
      const dateParts = [];
      if (data.eventDate) dateParts.push(data.eventDate);
      if (data.eventTime) dateParts.push(data.eventTime);
      const base = parts.join(' — ');
      return dateParts.length ? `${base} / ${dateParts.join(' ')}` : base;
    }
    case 'new_blog_post':
      return `New blog post from ${data.spaceName}: ${data.postTitle}`;
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
    case 'follow_request':
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
    case 'reaction':
      return { src: null, name: data.reactedByUsername || '?' };
    case 'new_event':
      return { src: data.spaceIconUrl || null, name: data.spaceName || '?' };
    case 'event_rsvp':
      return { src: null, name: data.rsvpDisplayName || data.rsvpUsername || '?' };
    case 'event_organizer_needed':
      return { src: data.spaceIconUrl || null, name: data.spaceName || '?' };
    case 'new_blog_post':
      return { src: data.spaceIconUrl || null, name: data.spaceName || '?' };
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
    case 'follow_request': return <Users size={18} style={{ color: 'var(--accent)' }} />;
    case 'dm_request': return <Mail size={18} style={{ color: 'var(--accent)' }} />;
    case 'post_comment': return <MessageCircle size={18} style={{ color: 'var(--accent)' }} />;
    case 'reaction': return <Smile size={18} style={{ color: 'var(--accent)' }} />;
    case 'event_cancelled': return <CalendarX size={18} style={{ color: 'var(--danger)' }} />;
    case 'new_event': return <CalendarPlus size={18} style={{ color: 'var(--accent)' }} />;
    case 'event_rsvp': return <Calendar size={18} style={{ color: 'var(--accent)' }} />;
    case 'event_organizer_needed': return <UserCheck size={18} style={{ color: '#fab005' }} />;
    case 'new_blog_post': return <BookOpen size={18} style={{ color: 'var(--accent)' }} />;
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
