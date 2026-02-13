import { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Pin, Lock, MessageSquare, Plus } from 'lucide-react';
import { boardApi } from '../../lib/boardApi.js';
import { useBoardAuthStore } from '../../stores/boardAuth.js';
import type { ForumThreadSummary } from '@crabac/shared';

export function BoardThreadList() {
  const { spaceSlug, channelName } = useParams();
  const navigate = useNavigate();
  const user = useBoardAuthStore((s) => s.user);
  const [threads, setThreads] = useState<ForumThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchThreads = useCallback(async (before?: string) => {
    if (!spaceSlug || !channelName) return;
    try {
      const qs = before ? `?before=${before}` : '';
      const data = await boardApi<ForumThreadSummary[]>(`/${spaceSlug}/${channelName}${qs}`);
      if (before) {
        setThreads((prev) => [...prev, ...data]);
      } else {
        setThreads(data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [spaceSlug, channelName]);

  useEffect(() => {
    setLoading(true);
    fetchThreads();
  }, [fetchThreads]);

  if (loading) return <div style={styles.loading}>Loading threads...</div>;
  if (error) return <div style={styles.error}>{error}</div>;

  return (
    <div>
      <div style={styles.headerRow}>
        <h2 style={styles.channelTitle}>
          <Link to={`/boards/${spaceSlug}`} style={styles.breadcrumb}>Board</Link>
          {' / '}
          {channelName}
        </h2>
        {user && (
          <button
            onClick={() => navigate(`/boards/${spaceSlug}/${channelName}/new`)}
            style={styles.newBtn}
          >
            <Plus size={14} /> New Thread
          </button>
        )}
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Thread</th>
            <th style={{ ...styles.th, width: 80, textAlign: 'center' }}>Replies</th>
            <th style={{ ...styles.th, width: 140 }}>Last Activity</th>
          </tr>
        </thead>
        <tbody>
          {threads.map((thread) => (
            <tr key={thread.id} style={styles.row}>
              <td style={styles.td}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {thread.isPinned && <Pin size={13} style={{ color: '#e2a33e', flexShrink: 0 }} />}
                  {thread.isLocked && <Lock size={13} style={{ color: '#999', flexShrink: 0 }} />}
                  <Link
                    to={`/boards/${spaceSlug}/${channelName}/${thread.id}`}
                    style={styles.threadLink}
                  >
                    {thread.title}
                  </Link>
                </div>
                <div style={styles.threadMeta}>
                  by {thread.author?.displayName}
                </div>
              </td>
              <td style={{ ...styles.td, textAlign: 'center' }}>
                <span style={styles.replyCount}>
                  <MessageSquare size={12} /> {thread.replyCount}
                </span>
              </td>
              <td style={{ ...styles.td, fontSize: '0.8rem', color: '#666' }}>
                {formatDate(thread.lastActivityAt || thread.createdAt)}
              </td>
            </tr>
          ))}
          {threads.length === 0 && (
            <tr>
              <td colSpan={3} style={{ ...styles.td, textAlign: 'center', color: '#999', padding: 24 }}>
                No threads yet. Be the first to start a discussion!
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {threads.length >= 30 && (
        <div style={{ textAlign: 'center', padding: 16 }}>
          <button
            onClick={() => fetchThreads(threads[threads.length - 1].id)}
            style={styles.loadMoreBtn}
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const styles: Record<string, React.CSSProperties> = {
  loading: { textAlign: 'center', padding: 40, color: '#999' },
  error: { textAlign: 'center', padding: 40, color: '#c53030' },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  channelTitle: {
    margin: 0,
    fontSize: '1.1rem',
    color: '#2d3748',
  },
  breadcrumb: {
    color: '#2b6cb0',
    textDecoration: 'none',
  },
  newBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 14px',
    background: '#e2a33e',
    border: 'none',
    color: '#fff',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    background: '#fff',
    border: '1px solid #ccc',
    borderRadius: 4,
  },
  th: {
    textAlign: 'left',
    padding: '10px 14px',
    background: '#4a5568',
    color: '#fff',
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  row: {
    cursor: 'default',
  },
  td: {
    padding: '10px 14px',
    borderBottom: '1px solid #e2e8f0',
    verticalAlign: 'top',
  },
  threadLink: {
    color: '#2b6cb0',
    fontWeight: 600,
    textDecoration: 'none',
    fontSize: '0.9rem',
  },
  threadMeta: {
    fontSize: '0.75rem',
    color: '#999',
    marginTop: 2,
  },
  replyCount: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    fontSize: '0.85rem',
    color: '#666',
  },
  loadMoreBtn: {
    padding: '6px 20px',
    background: '#4a5568',
    border: 'none',
    color: '#fff',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
};
