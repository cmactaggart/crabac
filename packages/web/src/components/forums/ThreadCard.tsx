import { Pin, Lock, MessageSquare } from 'lucide-react';
import { Avatar } from '../common/Avatar.js';
import type { ForumThreadSummary } from '@crabac/shared';

interface Props {
  thread: ForumThreadSummary;
  onClick: () => void;
}

export function ThreadCard({ thread, onClick }: Props) {
  const timeAgo = getTimeAgo(thread.lastActivityAt || thread.createdAt);

  return (
    <button onClick={onClick} style={styles.card}>
      <div style={styles.left}>
        <Avatar
          src={thread.author?.avatarUrl || null}
          name={thread.author?.displayName || '?'}
          size={36}
        />
      </div>
      <div style={styles.content}>
        <div style={styles.titleRow}>
          {thread.isPinned && <Pin size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
          {thread.isLocked && <Lock size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
          <span style={styles.title}>{thread.title}</span>
        </div>
        <div style={styles.preview}>{thread.firstPostPreview}</div>
        <div style={styles.meta}>
          <span>{thread.author?.displayName}</span>
          <span style={styles.dot}>&middot;</span>
          <span>{timeAgo}</span>
          <span style={styles.dot}>&middot;</span>
          <span style={styles.replies}>
            <MessageSquare size={12} />
            {thread.replyCount} {thread.replyCount === 1 ? 'reply' : 'replies'}
          </span>
        </div>
      </div>
    </button>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    display: 'flex',
    gap: 12,
    padding: '12px 16px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    transition: 'background 0.15s',
  },
  left: {
    flexShrink: 0,
    paddingTop: 2,
  },
  content: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  preview: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  dot: {
    opacity: 0.5,
  },
  replies: {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
  },
};
