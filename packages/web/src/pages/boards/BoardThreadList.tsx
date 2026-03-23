import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Pin, Lock, MessageSquare, Plus, Paperclip, X } from 'lucide-react';
import { boardApi } from '../../lib/boardApi.js';
import { useBoardAuthStore } from '../../stores/boardAuth.js';
import { usePublicTheme } from '../../contexts/PublicThemeContext.js';
import type { ForumThreadSummary } from '@crabac/shared';

export function BoardThreadList() {
  const { spaceSlug, channelName } = useParams();
  const user = useBoardAuthStore((s) => s.user);
  const theme = usePublicTheme();
  const c = theme.colors;
  const [threads, setThreads] = useState<ForumThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [creating, setCreating] = useState(false);
  const createFileRef = useRef<HTMLInputElement>(null);

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

  const handleCreate = async () => {
    if (!newTitle.trim() || !newContent.trim() || !spaceSlug || !channelName) return;
    setCreating(true);
    try {
      let thread: ForumThreadSummary;
      if (newFiles.length > 0) {
        const form = new FormData();
        form.append('title', newTitle.trim());
        form.append('content', newContent.trim());
        newFiles.forEach((f) => form.append('files', f));
        thread = await boardApi<ForumThreadSummary>(`/${spaceSlug}/${channelName}/threads/upload`, {
          method: 'POST',
          body: form,
        });
      } else {
        thread = await boardApi<ForumThreadSummary>(`/${spaceSlug}/${channelName}/threads`, {
          method: 'POST',
          body: JSON.stringify({ title: newTitle.trim(), content: newContent.trim() }),
        });
      }
      setThreads((prev) => [thread, ...prev]);
      setShowCreate(false);
      setNewTitle('');
      setNewContent('');
      setNewFiles([]);
    } catch (err: any) {
      setError(err.message || 'Failed to create thread');
    } finally {
      setCreating(false);
    }
  };

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
            onClick={() => setShowCreate(true)}
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

      {showCreate && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
        }} onClick={() => setShowCreate(false)}>
          <div style={{
            background: c.contentBg,
            border: `1px solid ${c.contentBorder}`,
            borderRadius: c.contentRadius > 4 ? 8 : 4,
            width: 500,
            maxWidth: '90vw',
            padding: 0,
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${c.contentBorder}`, fontWeight: 700, fontSize: '1rem', color: c.headingColor }}>
              New Thread
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Thread title"
                style={{
                  padding: '8px 12px',
                  border: `1px solid ${c.contentBorder}`,
                  borderRadius: c.contentRadius > 4 ? 6 : 4,
                  background: c.pageBg,
                  color: c.headingColor,
                  fontSize: '0.9rem',
                  outline: 'none',
                  width: '100%',
                  boxSizing: 'border-box' as const,
                }}
                autoFocus
                maxLength={200}
              />
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Write your post..."
                rows={6}
                style={{
                  padding: '8px 12px',
                  border: `1px solid ${c.contentBorder}`,
                  borderRadius: c.contentRadius > 4 ? 6 : 4,
                  background: c.pageBg,
                  color: c.headingColor,
                  fontSize: '0.9rem',
                  outline: 'none',
                  resize: 'vertical' as const,
                  width: '100%',
                  boxSizing: 'border-box' as const,
                }}
                maxLength={4000}
              />
              <input ref={createFileRef} type="file" multiple onChange={(e) => { setNewFiles((prev) => [...prev, ...Array.from(e.target.files || [])].slice(0, 20)); e.target.value = ''; }} style={{ display: 'none' }} />
              <button
                onClick={() => createFileRef.current?.click()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 12px',
                  background: 'none',
                  border: `1px solid ${c.contentBorder}`,
                  color: c.secondaryText,
                  borderRadius: c.contentRadius > 4 ? 6 : 4,
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                <Paperclip size={14} /> Attach files
              </button>
              {newFiles.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  {newFiles.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: c.pageBg, border: `1px solid ${c.contentBorder}`, borderRadius: 4, fontSize: '0.75rem', color: c.secondaryText }}>
                      <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                      <button onClick={() => setNewFiles((prev) => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: c.mutedText, cursor: 'pointer', padding: 1, display: 'flex' }}><X size={10} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding: '12px 20px', borderTop: `1px solid ${c.contentBorder}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setShowCreate(false)}
                style={{
                  padding: '6px 14px',
                  background: 'none',
                  border: `1px solid ${c.contentBorder}`,
                  color: c.secondaryText,
                  borderRadius: c.contentRadius > 4 ? 6 : 4,
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newTitle.trim() || !newContent.trim() || creating}
                style={{
                  padding: '6px 14px',
                  background: c.accent,
                  border: 'none',
                  color: '#fff',
                  borderRadius: c.contentRadius > 4 ? 6 : 4,
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  opacity: !newTitle.trim() || !newContent.trim() || creating ? 0.5 : 1,
                }}
              >
                {creating ? 'Creating...' : 'Create Thread'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
