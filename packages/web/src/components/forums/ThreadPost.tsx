import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Avatar } from '../common/Avatar.js';
import { Markdown } from '../common/Markdown.js';
import { useAuthStore } from '../../stores/auth.js';
import { useMessagesStore } from '../../stores/messages.js';
import { useForumsStore } from '../../stores/forums.js';
import type { Message } from '@crabac/shared';

interface Props {
  post: Message;
  channelId: string;
  isFirstPost?: boolean;
  canModerate?: boolean;
}

export function ThreadPost({ post, channelId, isFirstPost, canModerate }: Props) {
  const date = new Date(post.id ? snowflakeToDate(post.id) : Date.now());
  const currentUser = useAuthStore((s) => s.user);
  const deleteMessage = useMessagesStore((s) => s.deleteMessage);
  const [hovering, setHovering] = useState(false);

  const isOwnPost = currentUser?.id === post.authorId;
  const canDelete = !isFirstPost && (isOwnPost || canModerate);

  const handleDelete = () => {
    if (window.confirm('Delete this post?')) {
      deleteMessage(channelId, post.id);
      useForumsStore.setState((s) => ({
        threadPosts: s.threadPosts.filter((p) => p.id !== post.id),
      }));
    }
  };

  return (
    <div
      style={{ ...styles.post, ...(isFirstPost ? styles.firstPost : {}) }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div style={styles.authorSidebar}>
        <Avatar
          src={post.author?.avatarUrl || null}
          name={post.author?.displayName || '?'}
          size={40}
          baseColor={post.author?.baseColor}
          accentColor={post.author?.accentColor}
        />
        <div style={styles.authorInfo}>
          <span style={styles.authorName}>{post.author?.displayName}</span>
          <span style={styles.authorUsername}>@{post.author?.username}</span>
        </div>
      </div>
      <div style={styles.body}>
        <div style={styles.postHeader}>
          <span style={styles.timestamp}>
            {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {post.editedAt && <span style={styles.edited}>(edited)</span>}
          {canDelete && hovering && (
            <button onClick={handleDelete} style={styles.deleteBtn} title="Delete post">
              <Trash2 size={14} />
            </button>
          )}
        </div>
        <div style={styles.content}>
          <Markdown content={post.content} />
        </div>
        {post.reactions && post.reactions.length > 0 && (
          <div style={styles.reactions}>
            {post.reactions.map((r) => (
              <span key={r.emoji} style={styles.reaction}>
                {r.emoji} {r.count}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function snowflakeToDate(id: string): Date {
  const epoch = 1735689600000; // 2025-01-01
  const timestamp = Number(BigInt(id) >> 22n) + epoch;
  return new Date(timestamp);
}

const styles: Record<string, React.CSSProperties> = {
  post: {
    display: 'flex',
    gap: 16,
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
  },
  firstPost: {
    background: 'rgba(var(--accent-rgb, 88, 101, 242), 0.05)',
  },
  authorSidebar: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    width: 80,
  },
  authorInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 0,
  },
  authorName: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    textAlign: 'center',
    wordBreak: 'break-word',
  },
  authorUsername: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
  },
  body: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  postHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  timestamp: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  edited: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--danger)',
    cursor: 'pointer',
    padding: 2,
    borderRadius: 'var(--radius)',
    display: 'flex',
    alignItems: 'center',
    marginLeft: 'auto',
    opacity: 0.7,
  },
  content: {
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    lineHeight: 1.6,
    wordBreak: 'break-word',
  },
  reactions: {
    display: 'flex',
    gap: 4,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  reaction: {
    padding: '2px 8px',
    background: 'var(--bg-tertiary)',
    borderRadius: 'var(--radius)',
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
  },
};
