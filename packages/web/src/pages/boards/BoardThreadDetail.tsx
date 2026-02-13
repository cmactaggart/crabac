import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Pin, Lock, Send } from 'lucide-react';
import { boardApi } from '../../lib/boardApi.js';
import { useBoardAuthStore } from '../../stores/boardAuth.js';
import type { ForumThread, Message } from '@crabac/shared';

export function BoardThreadDetail() {
  const { spaceSlug, channelName, threadId } = useParams();
  const user = useBoardAuthStore((s) => s.user);
  const [thread, setThread] = useState<ForumThread | null>(null);
  const [posts, setPosts] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyContent, setReplyContent] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!spaceSlug || !channelName || !threadId) return;
    setLoading(true);
    boardApi<{ thread: ForumThread; posts: Message[] }>(`/${spaceSlug}/${channelName}/${threadId}`)
      .then((data) => {
        setThread(data.thread);
        setPosts(data.posts);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [spaceSlug, channelName, threadId]);

  const handleReply = async () => {
    if (!replyContent.trim() || sending || !threadId) return;
    setSending(true);
    try {
      const post = await boardApi<Message>(`/${spaceSlug}/${channelName}/${threadId}/posts`, {
        method: 'POST',
        body: JSON.stringify({ content: replyContent.trim() }),
      });
      setPosts((prev) => [...prev, post]);
      setReplyContent('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div style={styles.loading}>Loading...</div>;
  if (error) return <div style={styles.error}>{error}</div>;
  if (!thread) return null;

  return (
    <div>
      <div style={styles.breadcrumbs}>
        <Link to={`/boards/${spaceSlug}`} style={styles.crumbLink}>Board</Link>
        {' / '}
        <Link to={`/boards/${spaceSlug}/${channelName}`} style={styles.crumbLink}>{channelName}</Link>
        {' / '}
        <span style={{ color: '#666' }}>{thread.title}</span>
      </div>

      <div style={styles.threadHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {thread.isPinned && <Pin size={16} style={{ color: '#e2a33e' }} />}
          {thread.isLocked && <Lock size={16} style={{ color: '#999' }} />}
          <h2 style={styles.threadTitle}>{thread.title}</h2>
        </div>
        <div style={styles.threadMeta}>
          Started by <strong>{thread.author?.displayName}</strong> on{' '}
          {new Date(thread.createdAt).toLocaleDateString()}
        </div>
      </div>

      <div style={styles.postsContainer}>
        {posts.map((post, i) => (
          <div key={post.id} style={{ ...styles.post, ...(i === 0 ? styles.firstPost : {}) }}>
            <div style={styles.postSidebar}>
              <div style={styles.postAvatar}>
                {post.author?.displayName?.charAt(0).toUpperCase() || '?'}
              </div>
              <div style={styles.postAuthor}>{post.author?.displayName}</div>
              <div style={styles.postUsername}>@{post.author?.username}</div>
            </div>
            <div style={styles.postBody}>
              <div style={styles.postDate}>
                {formatPostDate(post.id)}
                {post.editedAt && <span style={{ fontStyle: 'italic', marginLeft: 8 }}>(edited)</span>}
              </div>
              <div style={styles.postContent}>{post.content}</div>
            </div>
          </div>
        ))}
      </div>

      {!thread.isLocked && user && (
        <div style={styles.replySection}>
          <h4 style={styles.replyTitle}>Post a Reply</h4>
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Write your reply..."
            style={styles.replyTextarea}
            rows={4}
            maxLength={4000}
          />
          <button
            onClick={handleReply}
            disabled={!replyContent.trim() || sending}
            style={{
              ...styles.replyBtn,
              opacity: !replyContent.trim() || sending ? 0.5 : 1,
            }}
          >
            <Send size={14} />
            {sending ? 'Posting...' : 'Post Reply'}
          </button>
        </div>
      )}

      {!thread.isLocked && !user && (
        <div style={styles.loginPrompt}>
          <Link to={`/boards/${spaceSlug}/login`} style={styles.crumbLink}>Log in</Link>
          {' or '}
          <Link to={`/boards/${spaceSlug}/register`} style={styles.crumbLink}>register</Link>
          {' to reply'}
        </div>
      )}

      {thread.isLocked && (
        <div style={styles.lockedNotice}>
          <Lock size={14} /> This thread is locked
        </div>
      )}
    </div>
  );
}

function formatPostDate(id: string): string {
  const epoch = 1735689600000;
  const timestamp = Number(BigInt(id) >> 22n) + epoch;
  const d = new Date(timestamp);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const styles: Record<string, React.CSSProperties> = {
  loading: { textAlign: 'center', padding: 40, color: '#999' },
  error: { textAlign: 'center', padding: 40, color: '#c53030' },
  breadcrumbs: {
    fontSize: '0.85rem',
    marginBottom: 16,
    color: '#999',
  },
  crumbLink: {
    color: '#2b6cb0',
    textDecoration: 'none',
  },
  threadHeader: {
    background: '#fff',
    border: '1px solid #ccc',
    borderRadius: '4px 4px 0 0',
    padding: '16px 20px',
    borderBottom: '2px solid #e2a33e',
  },
  threadTitle: {
    margin: 0,
    fontSize: '1.2rem',
    color: '#2d3748',
  },
  threadMeta: {
    fontSize: '0.8rem',
    color: '#999',
    marginTop: 4,
  },
  postsContainer: {
    border: '1px solid #ccc',
    borderTop: 'none',
    borderRadius: '0 0 4px 4px',
    overflow: 'hidden',
  },
  post: {
    display: 'flex',
    borderBottom: '1px solid #e2e8f0',
    background: '#fff',
  },
  firstPost: {
    background: '#fffff0',
  },
  postSidebar: {
    width: 120,
    padding: '12px 16px',
    borderRight: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    background: 'rgba(0,0,0,0.02)',
  },
  postAvatar: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: '#4a5568',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.2rem',
    fontWeight: 700,
  },
  postAuthor: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#2d3748',
    textAlign: 'center',
    wordBreak: 'break-word',
  },
  postUsername: {
    fontSize: '0.7rem',
    color: '#999',
  },
  postBody: {
    flex: 1,
    padding: '12px 16px',
    minWidth: 0,
  },
  postDate: {
    fontSize: '0.75rem',
    color: '#999',
    marginBottom: 8,
  },
  postContent: {
    fontSize: '0.9rem',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    color: '#333',
  },
  replySection: {
    marginTop: 20,
    background: '#fff',
    border: '1px solid #ccc',
    borderRadius: 4,
    padding: '16px 20px',
  },
  replyTitle: {
    margin: '0 0 8px',
    fontSize: '0.9rem',
    color: '#2d3748',
  },
  replyTextarea: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ccc',
    borderRadius: 4,
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  replyBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    padding: '6px 16px',
    background: '#e2a33e',
    border: 'none',
    color: '#fff',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
  loginPrompt: {
    marginTop: 20,
    padding: '16px 20px',
    background: '#fff',
    border: '1px solid #ccc',
    borderRadius: 4,
    textAlign: 'center',
    color: '#666',
    fontSize: '0.9rem',
  },
  lockedNotice: {
    marginTop: 20,
    padding: '12px 20px',
    background: '#f7f7f7',
    border: '1px solid #ccc',
    borderRadius: 4,
    textAlign: 'center',
    color: '#999',
    fontSize: '0.85rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
};
