import { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Pin, Lock, MessageSquare, Plus } from 'lucide-react';
import { boardApi } from '../../lib/boardApi.js';
import { useBoardAuthStore } from '../../stores/boardAuth.js';
import { usePublicTheme } from '../../contexts/PublicThemeContext.js';
import type { ForumThreadSummary } from '@crabac/shared';

export function BoardThreadList() {
  const { spaceSlug, channelName } = useParams();
  const navigate = useNavigate();
  const user = useBoardAuthStore((s) => s.user);
  const theme = usePublicTheme();
  const c = theme.colors;
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

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: c.mutedText }}>Loading threads...</div>;
  if (error) return <div style={{ textAlign: 'center', padding: 40, color: '#c53030' }}>{error}</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', color: c.headingColor }}>
          <Link to={`/boards/${spaceSlug}`} style={{ color: c.linkColor, textDecoration: 'none' }}>Board</Link>
          {' / '}
          {channelName}
        </h2>
        {user && (
          <button
            onClick={() => navigate(`/boards/${spaceSlug}/${channelName}/new`)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 14px',
              background: c.accent,
              border: 'none',
              color: '#fff',
              borderRadius: c.contentRadius > 4 ? 6 : 4,
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            <Plus size={14} /> New Thread
          </button>
        )}
      </div>

      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        background: c.contentBg,
        border: `1px solid ${c.contentBorder}`,
        borderRadius: c.contentRadius,
      }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '10px 14px', background: c.tableHeaderBg, color: c.tableHeaderColor, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Thread</th>
            <th style={{ textAlign: 'center', padding: '10px 14px', background: c.tableHeaderBg, color: c.tableHeaderColor, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', width: 80 }}>Replies</th>
            <th style={{ textAlign: 'left', padding: '10px 14px', background: c.tableHeaderBg, color: c.tableHeaderColor, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', width: 140 }}>Last Activity</th>
          </tr>
        </thead>
        <tbody>
          {threads.map((thread) => (
            <tr key={thread.id}>
              <td style={{ padding: '10px 14px', borderBottom: `1px solid ${c.contentBorder}`, verticalAlign: 'top' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {thread.isPinned && <Pin size={13} style={{ color: c.accent, flexShrink: 0 }} />}
                  {thread.isLocked && <Lock size={13} style={{ color: c.mutedText, flexShrink: 0 }} />}
                  <Link
                    to={`/boards/${spaceSlug}/${channelName}/${thread.id}`}
                    style={{ color: c.linkColor, fontWeight: 600, textDecoration: 'none', fontSize: '0.9rem' }}
                  >
                    {thread.title}
                  </Link>
                </div>
                <div style={{ fontSize: '0.75rem', color: c.mutedText, marginTop: 2 }}>
                  by {thread.author?.displayName}
                </div>
              </td>
              <td style={{ padding: '10px 14px', borderBottom: `1px solid ${c.contentBorder}`, textAlign: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.85rem', color: c.secondaryText }}>
                  <MessageSquare size={12} /> {thread.replyCount}
                </span>
              </td>
              <td style={{ padding: '10px 14px', borderBottom: `1px solid ${c.contentBorder}`, fontSize: '0.8rem', color: c.secondaryText }}>
                {formatDate(thread.lastActivityAt || thread.createdAt)}
              </td>
            </tr>
          ))}
          {threads.length === 0 && (
            <tr>
              <td colSpan={3} style={{ padding: 24, textAlign: 'center', color: c.mutedText, borderBottom: `1px solid ${c.contentBorder}` }}>
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
            style={{
              padding: '6px 20px',
              background: c.tableHeaderBg,
              border: `1px solid ${c.contentBorder}`,
              color: c.tableHeaderColor === '#fff' ? '#fff' : c.secondaryText,
              borderRadius: c.contentRadius > 4 ? 6 : 4,
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
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
