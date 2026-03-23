import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Pin, Lock, Send, Reply, X, Paperclip, Library } from 'lucide-react';
import { useForumsStore } from '../../stores/forums.js';
import { useChannelsStore } from '../../stores/channels.js';
import { useNotificationsStore } from '../../stores/notifications.js';
import { getSocket } from '../../lib/socket.js';
import { ThreadPost } from './ThreadPost.js';
import { ReportModal } from '../moderation/ReportModal.js';
import { TabbedCollectionPicker } from '../common/TabbedCollectionPicker.js';
import type { CollectionPickerItem } from '../common/TabbedCollectionPicker.js';
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
  const markRead = useChannelsStore((s) => s.markRead);
  const { notifications, markAsRead } = useNotificationsStore();
  const [replyContent, setReplyContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [collectionItems, setCollectionItems] = useState<{ type: string; id: string }[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [reportTarget, setReportTarget] = useState<Message | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchThreadPosts(spaceId, channelId, thread.id);
  }, [spaceId, channelId, thread.id, fetchThreadPosts]);

  // Mark channel as read and clear matching notifications when posts load
  useEffect(() => {
    if (threadPosts.length === 0 || !spaceId) return;

    // Mark channel read up to the latest post in the thread
    const lastPost = threadPosts[threadPosts.length - 1];
    markRead(spaceId, channelId, lastPost.id);

    // Mark any unread notifications that reference posts in this thread as read
    const postIds = new Set(threadPosts.map((p) => p.id));
    for (const n of notifications) {
      if (n.read) continue;
      const data = n.data as any;
      if (data?.messageId && postIds.has(data.messageId)) {
        markAsRead(n.id);
      }
    }
  }, [threadPosts.length, spaceId, channelId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if ((!replyContent.trim() && files.length === 0 && collectionItems.length === 0) || sending) return;
    setSending(true);
    try {
      const post = await createThreadPost(
        spaceId, channelId, thread.id,
        { content: replyContent.trim(), replyToId: replyingTo?.id },
        files.length > 0 ? files : undefined,
        collectionItems.length > 0 ? collectionItems : undefined,
      );
      // Ensure the post appears immediately even if socket event hasn't arrived yet
      if (post) addPost(post);
      setReplyContent('');
      setFiles([]);
      setCollectionItems([]);
      setReplyingTo(null);
    } catch {
      // error handled by store
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selected].slice(0, 20));
    e.target.value = '';
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
            <ThreadPost key={post.id} post={post} channelId={channelId} isFirstPost={i === 0} canModerate={canModerate} onReport={setReportTarget} onReply={setReplyingTo} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply input */}
      {!activeThread.isLocked && (
        <div style={styles.replyBar}>
          {replyingTo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)', fontSize: '0.8rem', color: 'var(--text-secondary)', width: '100%' }}>
              <Reply size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Replying to {replyingTo.author?.displayName}: {replyingTo.content?.slice(0, 80)}
              </span>
              <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex' }}>
                <X size={14} />
              </button>
            </div>
          )}
          {files.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', width: '100%' }}>
              {files.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'var(--bg-tertiary)', borderRadius: 4, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {f.type.startsWith('image/') && (
                    <img src={URL.createObjectURL(f)} alt="" style={{ width: 20, height: 20, borderRadius: 3, objectFit: 'cover' }} />
                  )}
                  <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 1, display: 'flex' }}>
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {collectionItems.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', width: '100%' }}>
              {collectionItems.map((item, i) => (
                <div key={`col-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'var(--bg-tertiary)', borderRadius: 4, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <span style={{ fontSize: '0.6rem', padding: '1px 4px', background: 'var(--accent)', color: '#fff', borderRadius: 3, fontWeight: 600 }}>
                    {item.type === 'route' ? 'Route' : item.type === 'event' ? 'Event' : 'Photo'}
                  </span>
                  <button onClick={() => setCollectionItems((prev) => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 1, display: 'flex' }}>
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <input ref={fileRef} type="file" multiple onChange={handleFileSelect} style={{ display: 'none' }} />
          <button
            onClick={() => fileRef.current?.click()}
            style={styles.attachBtn}
            title="Upload files"
          >
            <Paperclip size={18} />
          </button>
          <button
            onClick={() => setShowPicker(true)}
            style={styles.attachBtn}
            title="From Collections"
          >
            <Library size={16} />
          </button>
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
            disabled={(!replyContent.trim() && files.length === 0 && collectionItems.length === 0) || sending}
            style={{
              ...styles.sendBtn,
              opacity: (!replyContent.trim() && files.length === 0 && collectionItems.length === 0) || sending ? 0.5 : 1,
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

      {reportTarget && reportTarget.author && (
        <ReportModal
          reportedUserId={reportTarget.authorId}
          reportedUsername={reportTarget.author.displayName || reportTarget.author.username || 'Unknown'}
          spaceId={spaceId}
          channelId={channelId}
          forumPostId={reportTarget.id}
          messagePreview={reportTarget.content?.slice(0, 200)}
          contentLabel="Forum Post"
          onClose={() => setReportTarget(null)}
        />
      )}
      {showPicker && (
        <TabbedCollectionPicker
          spaceId={spaceId}
          onSelect={(items: CollectionPickerItem[]) => {
            setCollectionItems((prev) => [...prev, ...items.map((i) => ({ type: i.type, id: i.id }))]);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
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
    flexWrap: 'wrap',
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
  attachBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '8px 4px',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
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
