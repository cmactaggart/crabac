import { useEffect, useState, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Pin, Lock, Send, Reply, X, Paperclip } from 'lucide-react';
import { boardApi } from '../../lib/boardApi.js';
import { useBoardAuthStore } from '../../stores/boardAuth.js';
import { usePublicTheme } from '../../contexts/PublicThemeContext.js';
import { MessageAttachments } from '../../components/messages/MessageAttachments.js';
import type { ForumThread, Message } from '@crabac/shared';

export function BoardThreadDetail() {
  const { spaceSlug, channelName, threadId } = useParams();
  const user = useBoardAuthStore((s) => s.user);
  const theme = usePublicTheme();
  const c = theme.colors;
  const [thread, setThread] = useState<ForumThread | null>(null);
  const [posts, setPosts] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyContent, setReplyContent] = useState('');
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const replyFileRef = useRef<HTMLInputElement>(null);

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
    if ((!replyContent.trim() && replyFiles.length === 0) || sending || !threadId) return;
    setSending(true);
    try {
      let post: Message;
      if (replyFiles.length > 0) {
        const form = new FormData();
        form.append('content', replyContent.trim());
        if (replyingTo?.id) form.append('replyToId', replyingTo.id);
        replyFiles.forEach((f) => form.append('files', f));
        post = await boardApi<Message>(`/${spaceSlug}/${channelName}/${threadId}/posts/upload`, {
          method: 'POST',
          body: form,
        });
      } else {
        post = await boardApi<Message>(`/${spaceSlug}/${channelName}/${threadId}/posts`, {
          method: 'POST',
          body: JSON.stringify({ content: replyContent.trim(), replyToId: replyingTo?.id }),
        });
      }
      setPosts((prev) => [...prev, post]);
      setReplyContent('');
      setReplyFiles([]);
      setReplyingTo(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: c.mutedText }}>Loading...</div>;
  if (error) return <div style={{ textAlign: 'center', padding: 40, color: '#c53030' }}>{error}</div>;
  if (!thread) return null;

  const isSidebar = theme.layout.forumPostLayout === 'sidebar';

  return (
    <div>
      <div style={{ fontSize: '0.85rem', marginBottom: 16, color: c.mutedText }}>
        <Link to={`/boards/${spaceSlug}`} style={{ color: c.linkColor, textDecoration: 'none' }}>Board</Link>
        {' / '}
        <Link to={`/boards/${spaceSlug}/${channelName}`} style={{ color: c.linkColor, textDecoration: 'none' }}>{channelName}</Link>
        {' / '}
        <span style={{ color: c.secondaryText }}>{thread.title}</span>
      </div>

      <div style={{
        background: c.contentBg,
        border: `1px solid ${c.contentBorder}`,
        borderRadius: `${c.contentRadius}px ${c.contentRadius}px 0 0`,
        padding: '16px 20px',
        borderBottom: `2px solid ${c.accent}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {thread.isPinned && <Pin size={16} style={{ color: c.accent }} />}
          {thread.isLocked && <Lock size={16} style={{ color: c.mutedText }} />}
          <h2 style={{ margin: 0, fontSize: '1.2rem', color: c.headingColor }}>{thread.title}</h2>
        </div>
        <div style={{ fontSize: '0.8rem', color: c.mutedText, marginTop: 4 }}>
          Started by <strong>{thread.author?.displayName}</strong> on{' '}
          {new Date(thread.createdAt).toLocaleDateString()}
        </div>
      </div>

      <div style={{
        border: `1px solid ${c.contentBorder}`,
        borderTop: 'none',
        borderRadius: `0 0 ${c.contentRadius}px ${c.contentRadius}px`,
        overflow: 'hidden',
      }}>
        {posts.map((post, i) => (
          isSidebar
            ? <SidebarPost key={post.id} post={post} isFirst={i === 0} colors={c} onReply={user ? setReplyingTo : undefined} />
            : <StackedPost key={post.id} post={post} isFirst={i === 0} colors={c} contentRadius={c.contentRadius} onReply={user ? setReplyingTo : undefined} />
        ))}
      </div>

      {!thread.isLocked && user && (
        <div style={{
          marginTop: 20,
          background: c.contentBg,
          border: `1px solid ${c.contentBorder}`,
          borderRadius: c.contentRadius,
          padding: '16px 20px',
        }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem', color: c.headingColor }}>Post a Reply</h4>
          {replyingTo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: '0.8rem', color: c.secondaryText }}>
              <Reply size={14} style={{ color: c.accent, flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Replying to {replyingTo.author?.displayName}: {replyingTo.content?.slice(0, 80)}
              </span>
              <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', color: c.mutedText, cursor: 'pointer', padding: 2, display: 'flex' }}>
                <X size={14} />
              </button>
            </div>
          )}
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Write your reply..."
            style={{
              width: '100%',
              padding: '8px 12px',
              border: `1px solid ${c.inputBorder}`,
              borderRadius: c.contentRadius > 4 ? 6 : 4,
              fontSize: '0.9rem',
              fontFamily: 'inherit',
              resize: 'vertical',
              boxSizing: 'border-box',
              background: c.inputBg,
            }}
            rows={4}
            maxLength={4000}
          />
          <input ref={replyFileRef} type="file" multiple onChange={(e) => { setReplyFiles((prev) => [...prev, ...Array.from(e.target.files || [])].slice(0, 20)); e.target.value = ''; }} style={{ display: 'none' }} />
          {replyFiles.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {replyFiles.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: c.pageBg, border: `1px solid ${c.contentBorder}`, borderRadius: 4, fontSize: '0.75rem', color: c.secondaryText }}>
                  <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <button onClick={() => setReplyFiles((prev) => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: c.mutedText, cursor: 'pointer', padding: 1, display: 'flex' }}><X size={10} /></button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
            <button
              onClick={() => replyFileRef.current?.click()}
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
              <Paperclip size={14} /> Attach
            </button>
            <button
              onClick={handleReply}
              disabled={(!replyContent.trim() && replyFiles.length === 0) || sending}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 16px',
                background: c.accent,
                border: 'none',
                color: '#fff',
                borderRadius: c.contentRadius > 4 ? 6 : 4,
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                opacity: (!replyContent.trim() && replyFiles.length === 0) || sending ? 0.5 : 1,
              }}
            >
              <Send size={14} />
              {sending ? 'Posting...' : 'Post Reply'}
            </button>
          </div>
        </div>
      )}

      {!thread.isLocked && !user && (
        <div style={{
          marginTop: 20,
          padding: '16px 20px',
          background: c.contentBg,
          border: `1px solid ${c.contentBorder}`,
          borderRadius: c.contentRadius,
          textAlign: 'center',
          color: c.secondaryText,
          fontSize: '0.9rem',
        }}>
          <Link to={`/boards/${spaceSlug}/login`} style={{ color: c.linkColor, textDecoration: 'none' }}>Log in</Link>
          {' or '}
          <Link to={`/boards/${spaceSlug}/register`} style={{ color: c.linkColor, textDecoration: 'none' }}>register</Link>
          {' to reply'}
        </div>
      )}

      {thread.isLocked && (
        <div style={{
          marginTop: 20,
          padding: '12px 20px',
          background: c.contentBg,
          border: `1px solid ${c.contentBorder}`,
          borderRadius: c.contentRadius,
          textAlign: 'center',
          color: c.mutedText,
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}>
          <Lock size={14} /> This thread is locked
        </div>
      )}
    </div>
  );
}

function SidebarPost({ post, isFirst, colors: c, onReply }: { post: Message; isFirst: boolean; colors: any; onReply?: (post: Message) => void }) {
  return (
    <div style={{
      display: 'flex',
      borderBottom: `1px solid ${c.contentBorder}`,
      background: isFirst ? (c.accent === '#e2a33e' ? '#fffff0' : c.contentBg) : c.contentBg,
    }}>
      <div style={{
        width: 120,
        padding: '12px 16px',
        borderRight: `1px solid ${c.contentBorder}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
        background: 'rgba(0,0,0,0.02)',
      }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: c.tableHeaderBg === '#4a5568' ? '#4a5568' : c.accent,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.2rem',
          fontWeight: 700,
        }}>
          {post.author?.displayName?.charAt(0).toUpperCase() || '?'}
        </div>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: c.headingColor, textAlign: 'center', wordBreak: 'break-word' }}>
          {post.author?.displayName}
        </div>
        <div style={{ fontSize: '0.7rem', color: c.mutedText }}>@{post.author?.username}</div>
      </div>
      <div style={{ flex: 1, padding: '12px 16px', minWidth: 0 }}>
        <div style={{ fontSize: '0.75rem', color: c.mutedText, marginBottom: 8 }}>
          {formatPostDate(post.id)}
          {post.editedAt && <span style={{ fontStyle: 'italic', marginLeft: 8 }}>(edited)</span>}
        </div>
        {post.replyToId && post.replyTo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: c.mutedText, padding: '4px 8px', background: c.pageBg, borderRadius: 4, borderLeft: `2px solid ${c.accent}`, marginBottom: 6 }}>
            <Reply size={12} /> Replying to {post.replyTo.author?.displayName}: {(post.replyTo.content || '').slice(0, 80)}
          </div>
        )}
        <div style={{ fontSize: '0.9rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: c.pageText }}>
          {post.content}
        </div>
        {post.attachments && post.attachments.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <MessageAttachments attachments={post.attachments} noPadding />
          </div>
        )}
        {!isFirst && onReply && (
          <button onClick={() => onReply(post)} style={{ background: 'none', border: 'none', color: c.linkColor, cursor: 'pointer', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, padding: 0 }}>
            <Reply size={12} /> Reply
          </button>
        )}
      </div>
    </div>
  );
}

function StackedPost({ post, isFirst, colors: c, contentRadius, onReply }: { post: Message; isFirst: boolean; colors: any; contentRadius: number; onReply?: (post: Message) => void }) {
  return (
    <div style={{
      padding: '16px 20px',
      borderBottom: `1px solid ${c.contentBorder}`,
      background: c.contentBg,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: c.accent,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.85rem',
          fontWeight: 700,
          flexShrink: 0,
        }}>
          {post.author?.displayName?.charAt(0).toUpperCase() || '?'}
        </div>
        <div>
          <span style={{ fontWeight: 600, fontSize: '0.85rem', color: c.headingColor }}>
            {post.author?.displayName}
          </span>
          <span style={{ fontSize: '0.75rem', color: c.mutedText, marginLeft: 8 }}>
            {formatPostDate(post.id)}
            {post.editedAt && <span style={{ fontStyle: 'italic', marginLeft: 4 }}>(edited)</span>}
          </span>
        </div>
        {isFirst && (
          <span style={{
            fontSize: '0.65rem',
            padding: '1px 6px',
            background: c.accent,
            color: '#fff',
            borderRadius: 8,
            fontWeight: 600,
            marginLeft: 'auto',
          }}>
            OP
          </span>
        )}
      </div>
      {post.replyToId && post.replyTo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: c.mutedText, padding: '4px 8px', background: c.pageBg, borderRadius: 4, borderLeft: `2px solid ${c.accent}`, marginBottom: 6 }}>
          <Reply size={12} /> Replying to {post.replyTo.author?.displayName}: {(post.replyTo.content || '').slice(0, 80)}
        </div>
      )}
      <div style={{ fontSize: '0.9rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: c.pageText }}>
        {post.content}
      </div>
      {post.attachments && post.attachments.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <MessageAttachments attachments={post.attachments} noPadding />
        </div>
      )}
      {!isFirst && onReply && (
        <button onClick={() => onReply(post)} style={{ background: 'none', border: 'none', color: c.linkColor, cursor: 'pointer', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, padding: 0 }}>
          <Reply size={12} /> Reply
        </button>
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
