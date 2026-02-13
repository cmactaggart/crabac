import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Pin, Lock, Send } from 'lucide-react';
import { useForumsStore } from '../../stores/forums.js';
import { getSocket } from '../../lib/socket.js';
import { ThreadPost } from './ThreadPost.js';
import type { ForumThread, Message } from '@crabac/shared';

interface Props {
  spaceId: string;
  channelId: string;
  thread: ForumThread;
  onBack: () => void;
  canModerate?: boolean;
}

export function ThreadDetailView({ spaceId, channelId, thread, onBack, canModerate }: Props) {
  const { threadPosts, postsLoading, fetchThreadPosts, createThreadPost, updateThread, addPost, updateThreadInList } = useForumsStore();
  const [replyContent, setReplyContent] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchThreadPosts(spaceId, channelId, thread.id);
  }, [spaceId, channelId, thread.id, fetchThreadPosts]);

  // Socket: join/leave thread room
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('thread:join', { threadId: thread.id });

    const onNewPost = (post: Message) => {
      addPost(post);
    };
    const onThreadUpdated = (updated: ForumThread) => {
      updateThreadInList(updated);
    };

    socket.on('forum:post_created', onNewPost);
    socket.on('forum:thread_updated', onThreadUpdated);

    return () => {
      socket.emit('thread:leave', { threadId: thread.id });
      socket.off('forum:post_created', onNewPost);
      socket.off('forum:thread_updated', onThreadUpdated);
    };
  }, [thread.id, addPost, updateThreadInList]);

  // Scroll to bottom when new posts arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadPosts.length]);

  const handleSendReply = async () => {
    if (!replyContent.trim() || sending) return;
    setSending(true);
    try {
      await createThreadPost(spaceId, channelId, thread.id, {
        content: replyContent.trim(),
      });
      setReplyContent('');
    } catch {
      // error handled by store
    } finally {
      setSending(false);
    }
  };

  const activeThread = useForumsStore((s) => s.activeThread) || thread;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={onBack} style={styles.backBtn}>
          <ArrowLeft size={18} />
        </button>
        <div style={styles.headerTitle}>
          <div style={styles.titleRow}>
            {activeThread.isPinned && <Pin size={14} style={{ color: 'var(--accent)' }} />}
            {activeThread.isLocked && <Lock size={14} style={{ color: 'var(--text-muted)' }} />}
            <h3 style={styles.title}>{activeThread.title}</h3>
          </div>
          <span style={styles.author}>by {activeThread.author?.displayName}</span>
        </div>
        {canModerate && (
          <div style={styles.actions}>
            <button
              onClick={() => updateThread(spaceId, channelId, thread.id, { isPinned: !activeThread.isPinned })}
              style={{ ...styles.actionBtn, color: activeThread.isPinned ? 'var(--accent)' : 'var(--text-muted)' }}
              title={activeThread.isPinned ? 'Unpin' : 'Pin'}
            >
              <Pin size={16} />
            </button>
            <button
              onClick={() => updateThread(spaceId, channelId, thread.id, { isLocked: !activeThread.isLocked })}
              style={{ ...styles.actionBtn, color: activeThread.isLocked ? 'var(--warning, #f0b232)' : 'var(--text-muted)' }}
              title={activeThread.isLocked ? 'Unlock' : 'Lock'}
            >
              <Lock size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Posts */}
      <div style={styles.posts}>
        {postsLoading && threadPosts.length === 0 ? (
          <div style={styles.loadingState}>Loading posts...</div>
        ) : (
          threadPosts.map((post, i) => (
            <ThreadPost key={post.id} post={post} channelId={channelId} isFirstPost={i === 0} canModerate={canModerate} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply input */}
      {!activeThread.isLocked && (
        <div style={styles.replyBar}>
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Write a reply..."
            style={styles.replyInput}
            rows={2}
            maxLength={4000}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendReply();
              }
            }}
          />
          <button
            onClick={handleSendReply}
            disabled={!replyContent.trim() || sending}
            style={{
              ...styles.sendBtn,
              opacity: !replyContent.trim() || sending ? 0.5 : 1,
            }}
          >
            <Send size={18} />
          </button>
        </div>
      )}
      {activeThread.isLocked && (
        <div style={styles.lockedBar}>
          <Lock size={14} />
          <span>This thread is locked</span>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: 4,
    borderRadius: 'var(--radius)',
    display: 'flex',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  author: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  actions: {
    display: 'flex',
    gap: 4,
    flexShrink: 0,
  },
  actionBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    borderRadius: 'var(--radius)',
    display: 'flex',
    alignItems: 'center',
  },
  posts: {
    flex: 1,
    overflowY: 'auto',
  },
  loadingState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    color: 'var(--text-muted)',
  },
  replyBar: {
    display: 'flex',
    gap: 8,
    padding: '12px 16px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  replyInput: {
    flex: 1,
    padding: '8px 12px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    outline: 'none',
    resize: 'none',
    fontFamily: 'inherit',
  },
  sendBtn: {
    background: 'var(--accent)',
    border: 'none',
    color: 'white',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    padding: '8px 12px',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  lockedBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 16px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
    justifyContent: 'center',
  },
};
