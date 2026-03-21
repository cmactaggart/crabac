import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCheck, AtSign, Reply, Zap, Tag, Users, Mail, CalendarX, CalendarPlus, Calendar, MessageCircle, BookOpen } from 'lucide-react';
import { useNotificationsStore } from '../../stores/notifications.js';
import { Avatar } from '../common/Avatar.js';
import type { Notification, MentionNotificationData, ReplyNotificationData, PostCommentNotificationData, PostTagNotificationData } from '@crabac/shared';

interface Props {
  onClose: () => void;
}

export function NotificationDropdown({ onClose }: Props) {
  const { notifications, loading, hasMore, fetchNotifications, markAsRead, markAllAsRead } = useNotificationsStore();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid immediately closing from the bell click
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClick), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  const handleClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    const data = notification.data as any;
    if (data.conversationId) {
      navigate(`/dm/${data.conversationId}`);
      onClose();
    } else if (notification.type === 'post_comment') {
      const d = data as PostCommentNotificationData;
      navigate(`/p/${d.postOwnerUsername}?post=${d.postId}&comment=${d.commentId}`);
      onClose();
    } else if (notification.type === 'post_tag') {
      const d = data as PostTagNotificationData;
      navigate(`/p/${d.taggedByUsername}?post=${d.postId}`);
      onClose();
    } else if (notification.type === 'new_event' && data.spaceId) {
      if (data.postId && data.spaceSlug) {
        navigate(`/p/${data.spaceSlug}?post=${data.postId}`);
      } else {
        navigate(`/space/${data.spaceId}?tab=calendar&event=${data.eventId}`);
      }
      onClose();
    } else if (notification.type === 'event_rsvp' && data.spaceId) {
      navigate(`/space/${data.spaceId}?tab=calendar&event=${data.eventId}`);
      onClose();
    } else if (notification.type === 'new_blog_post' && data.spaceId) {
      navigate(`/space/${data.spaceId}?tab=blog&post=${data.postId}`);
      onClose();
    } else if (data.spaceId && data.channelId) {
      navigate(`/space/${data.spaceId}/channel/${data.channelId}`);
      onClose();
    }
  };

  const loadMore = () => {
    if (notifications.length > 0) {
      fetchNotifications(notifications[notifications.length - 1].id);
    }
  };

  return (
    <div ref={dropdownRef} style={styles.dropdown}>
      <div style={styles.header}>
        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Notifications</span>
        <button onClick={() => markAllAsRead()} style={styles.markAllBtn}>
          <CheckCheck size={14} /> Mark all read
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
                  <Avatar src={avatar.src} name={avatar.name} size={32} />
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
    case 'follow_request':
      return `${data.fromDisplayName} wants to follow you`;
    case 'dm_request':
      return `${data.fromDisplayName} sent you a message`;
    case 'event_cancelled':
      return `${data.eventName} was cancelled`;
    case 'new_event': {
      let title = `${data.spaceName || 'A space'} has posted a new event: ${data.eventName || 'an event'}`;
      if (data.eventDate) title += ` ${data.eventDate}`;
      if (data.eventTime) title += ` ${data.eventTime}`;
      return title;
    }
    case 'post_tag':
      return `${data.taggedByDisplayName} tagged you in a post`;
    case 'post_comment':
      return `${data.commenterDisplayName} commented on your post`;
    case 'event_rsvp':
      return `${data.rsvpDisplayName || data.rsvpUsername} RSVP'd ${data.rsvpStatus} to ${data.eventName}`;
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
      // @everyone/@here — use space icon
      return { src: d.spaceIconUrl || null, name: d.spaceName };
    }
    case 'reply': {
      const d = data as ReplyNotificationData;
      return { src: d.repliedByAvatarUrl || null, name: d.repliedByUsername };
    }
    case 'friend_request':
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
    case 'new_event':
      return { src: data.spaceIconUrl || null, name: data.spaceName || '?' };
    case 'event_rsvp':
      return { src: null, name: data.rsvpDisplayName || data.rsvpUsername || '?' };
    case 'new_blog_post':
      return { src: data.spaceIconUrl || null, name: data.spaceName || '?' };
    default:
      return { src: null, name: '' };
  }
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'mention': return <AtSign size={16} style={{ color: 'var(--accent)' }} />;
    case 'reply': return <Reply size={16} style={{ color: 'var(--accent)' }} />;
    case 'portal_invite': return <Zap size={16} style={{ color: 'var(--accent)' }} />;
    case 'post_tag': return <Tag size={16} style={{ color: 'var(--accent)' }} />;
    case 'friend_request':
    case 'follow_request': return <Users size={16} style={{ color: 'var(--accent)' }} />;
    case 'dm_request': return <Mail size={16} style={{ color: 'var(--accent)' }} />;
    case 'post_comment': return <MessageCircle size={16} style={{ color: 'var(--accent)' }} />;
    case 'event_cancelled': return <CalendarX size={16} style={{ color: 'var(--danger)' }} />;
    case 'new_event': return <CalendarPlus size={16} style={{ color: 'var(--accent)' }} />;
    case 'event_rsvp': return <Calendar size={16} style={{ color: 'var(--accent)' }} />;
    case 'new_blog_post': return <BookOpen size={16} style={{ color: 'var(--accent)' }} />;
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
  dropdown: {
    position: 'absolute',
    right: 0,
    top: '100%',
    marginTop: 4,
    width: 360,
    maxHeight: 480,
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    zIndex: 200,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  markAllBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: 'none',
    border: 'none',
    color: 'var(--accent)',
    fontSize: '0.75rem',
    cursor: 'pointer',
    fontWeight: 600,
  },
  list: {
    flex: 1,
    overflowY: 'auto',
  },
  empty: {
    padding: '2rem',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
  },
  item: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    width: '100%',
    textAlign: 'left',
    padding: '10px 14px',
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
    width: 32,
    height: 32,
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
    fontSize: '0.82rem',
    fontWeight: 600,
    marginBottom: 2,
  },
  itemPreview: {
    fontSize: '0.78rem',
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    borderLeft: '2px solid var(--text-muted)',
    paddingLeft: 6,
    marginTop: 2,
  },
  itemTime: {
    fontSize: '0.7rem',
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
    padding: '8px',
    background: 'none',
    border: 'none',
    color: 'var(--accent)',
    fontSize: '0.8rem',
    cursor: 'pointer',
    fontWeight: 500,
  },
};
