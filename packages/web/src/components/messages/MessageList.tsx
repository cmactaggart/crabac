import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Reply, SmilePlus, MessageSquare, Pin, Copy, Link2, Pencil, Trash2, Zap, Check, X, Flag, Forward } from 'lucide-react';
import { useMessagesStore } from '../../stores/messages.js';
import { usePortalsStore } from '../../stores/portals.js';
import { useMutesStore } from '../../stores/mutes.js';
import { useHasSpacePermission } from '../settings/SpaceSettingsModal.js';
import { Permissions } from '@crabac/shared';
import { ReportModal } from '../moderation/ReportModal.js';
import { Avatar } from '../common/Avatar.js';
import { Markdown } from '../common/Markdown.js';
import { EmojiPicker } from './EmojiPicker.js';
import { ContextMenu, useLongPress, type ContextMenuItem } from '../common/ContextMenu.js';
import type { Message } from '@crabac/shared';
import { InteractiveCard } from './InteractiveCard.js';
import { MessageEmbeds } from './MessageEmbeds.js';
import { MessageAttachments } from './MessageAttachments.js';
import { ReactionBar } from './ReactionBar.js';
import { ShareToSpacePicker } from '../common/ShareToSpacePicker.js';
import { api } from '../../lib/api.js';

interface Props {
  messages: Message[];
  loading: boolean;
  hasMore: boolean;
  currentUserId: string;
  channelId: string;
  spaceId: string;
  onReply: (message: Message) => void;
  onUserClick: (userId: string, rect: DOMRect) => void;
}

export function MessageList({ messages, loading, hasMore, currentUserId, channelId, spaceId, onReply, onUserClick }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);
  const fetchMessages = useMessagesStore((s) => s.fetchMessages);
  const canManageMessages = useHasSpacePermission(spaceId, Permissions.MANAGE_MESSAGES);
  const [reportTarget, setReportTarget] = useState<{ message: Message } | null>(null);

  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      // Use instant scroll on initial load (prev was 0), smooth for live messages
      const behavior = prevLengthRef.current === 0 ? 'instant' : 'smooth';
      bottomRef.current?.scrollIntoView({ behavior });
    }
    prevLengthRef.current = messages.length;
  }, [messages.length]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el || loading || !hasMore) return;
    if (el.scrollTop < 100) {
      fetchMessages(channelId, messages[0]?.id);
    }
  };

  return (
    <div ref={containerRef} onScroll={handleScroll} style={styles.container}>
      {loading && messages.length === 0 && (
        <MessageSkeletons />
      )}

      {hasMore && messages.length > 0 && (
        <button onClick={() => fetchMessages(channelId, messages[0]?.id)} style={styles.loadMore}>
          {loading ? 'Loading...' : 'Load older messages'}
        </button>
      )}

      {messages.map((msg, i) => {
        const prev = messages[i - 1];
        // Workflow messages with a custom display name are a different "identity"
        // even though they share the space owner's authorId
        const prevWorkflowName = prev?.metadata?.workflowDisplayName;
        const currWorkflowName = msg.metadata?.workflowDisplayName;
        const sameIdentity = prev?.authorId === msg.authorId
          && !msg.replyToId
          && prevWorkflowName === currWorkflowName;
        const gap = sameIdentity && prev ? snowflakeTime(msg.id) - snowflakeTime(prev.id) : Infinity;
        // <1min: compact, 1-15min: spaced (no header), >15min: full header
        const compact = sameIdentity && gap < 60000;
        const spacedSameAuthor = sameIdentity && gap >= 60000 && gap < 900000;
        return (
          <MessageItem
            key={msg.id}
            message={msg}
            compact={compact}
            spacedSameAuthor={spacedSameAuthor}
            isOwn={msg.authorId === currentUserId}
            currentUserId={currentUserId}
            channelId={channelId}
            spaceId={spaceId}
            canManageMessages={canManageMessages}
            onReply={onReply}
            onUserClick={onUserClick}
            onReport={(m) => setReportTarget({ message: m })}
          />
        );
      })}

      <div ref={bottomRef} />

      {reportTarget && (
        <ReportModal
          reportedUserId={reportTarget.message.authorId}
          reportedUsername={reportTarget.message.author?.displayName || reportTarget.message.author?.username || 'Unknown'}
          spaceId={spaceId}
          channelId={channelId}
          messageId={reportTarget.message.id}
          messagePreview={reportTarget.message.content}
          onClose={() => setReportTarget(null)}
        />
      )}
    </div>
  );
}

// Quick reactions bar (most used)
// ─── Skeleton Loading UI ───

const skeletonWidths = [180, 260, 140, 320, 200, 280, 160, 240, 300, 220];

function MessageSkeletons() {
  return (
    <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        @keyframes skeletonPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>
      {skeletonWidths.map((width, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, padding: '2px 8px' }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--bg-tertiary)',
            flexShrink: 0,
            animation: 'skeletonPulse 1.5s ease-in-out infinite',
            animationDelay: `${i * 0.08}s`,
          }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            <div style={{
              width: 80 + (i % 3) * 30,
              height: 12,
              borderRadius: 4,
              background: 'var(--bg-tertiary)',
              animation: 'skeletonPulse 1.5s ease-in-out infinite',
              animationDelay: `${i * 0.08}s`,
            }} />
            <div style={{
              width: Math.min(width, 320),
              height: 14,
              borderRadius: 4,
              background: 'var(--bg-tertiary)',
              animation: 'skeletonPulse 1.5s ease-in-out infinite',
              animationDelay: `${i * 0.08 + 0.05}s`,
            }} />
            {i % 3 === 0 && (
              <div style={{
                width: Math.min(width * 0.6, 200),
                height: 14,
                borderRadius: 4,
                background: 'var(--bg-tertiary)',
                animation: 'skeletonPulse 1.5s ease-in-out infinite',
                animationDelay: `${i * 0.08 + 0.1}s`,
              }} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const QUICK_REACTIONS = ['\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F602}', '\u{1F389}', '\u{1F914}', '\u{1F622}', '\u{1F525}', '\u{1F440}'];

function MessageItem({
  message,
  compact,
  spacedSameAuthor,
  isOwn,
  currentUserId,
  channelId,
  spaceId,
  canManageMessages,
  onReply,
  onUserClick,
  onReport,
}: {
  message: Message;
  compact: boolean;
  spacedSameAuthor?: boolean;
  isOwn: boolean;
  currentUserId: string;
  channelId: string;
  spaceId: string;
  canManageMessages: boolean;
  onReply: (msg: Message) => void;
  onUserClick: (userId: string, rect: DOMRect) => void;
  onReport: (msg: Message) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showSharePicker, setShowSharePicker] = useState(false);
  const [showMutedContent, setShowMutedContent] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const isMuted = useMutesStore((s) => s.isMuted(message.authorId));
  const toggleReaction = useMessagesStore((s) => s.toggleReaction);
  const openThread = useMessagesStore((s) => s.openThread);
  const pinMessage = useMessagesStore((s) => s.pinMessage);
  const unpinMessage = useMessagesStore((s) => s.unpinMessage);
  const editMessage = useMessagesStore((s) => s.editMessage);
  const deleteMessage = useMessagesStore((s) => s.deleteMessage);
  const ts = formatTimestamp(message.id);

  const handleReaction = (emoji: string) => {
    const hasReacted = message.reactions?.some(
      (r) => r.emoji === emoji && r.users.some((u) => u.id === currentUserId),
    ) || false;
    toggleReaction(channelId, message.id, emoji, hasReacted);
    setShowEmojiPicker(false);
  };

  const handlePin = () => {
    if (message.isPinned) unpinMessage(channelId, message.id);
    else pinMessage(channelId, message.id);
  };

  const handleEdit = () => {
    setEditContent(message.content);
    setEditing(true);
  };

  const handleEditSave = async () => {
    const trimmed = editContent.trim();
    if (!trimmed || trimmed === message.content) {
      setEditing(false);
      return;
    }
    await editMessage(channelId, message.id, trimmed);
    setEditing(false);
  };

  const handleDelete = () => {
    if (confirm('Delete this message?')) {
      deleteMessage(channelId, message.id);
    }
  };

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleLongPressCallback = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setContextMenu({ x: touch.clientX, y: touch.clientY });
  }, []);

  const longPressHandlers = useLongPress(handleLongPressCallback);

  const contextMenuItems: ContextMenuItem[] = [
    { label: 'Reply', icon: <Reply size={16} />, onClick: () => onReply(message) },
    { label: 'Add Reaction', icon: <SmilePlus size={16} />, onClick: () => setShowEmojiPicker(true) },
    ...(message.replyCount > 0 ? [{ label: 'View Thread', icon: <MessageSquare size={16} />, onClick: () => openThread(channelId, message.id) }] : []),
    { label: message.isPinned ? 'Unpin' : 'Pin', icon: <Pin size={16} />, onClick: handlePin },
    { label: 'Copy Text', icon: <Copy size={16} />, onClick: () => navigator.clipboard.writeText(message.content) },
    { label: 'Copy Link', icon: <Link2 size={16} />, onClick: () => navigator.clipboard.writeText(`${window.location.origin}/space/${spaceId}/channel/${channelId}/message/${message.id}`) },
    { label: 'Share', icon: <Forward size={16} />, onClick: () => setShowSharePicker(true) },
    ...(isOwn ? [{ label: 'Edit', icon: <Pencil size={16} />, onClick: handleEdit }] : []),
    ...(!isOwn ? [{ label: 'Report', icon: <Flag size={16} />, onClick: () => onReport(message) }] : []),
    ...(isOwn || canManageMessages ? [{ label: 'Delete', icon: <Trash2 size={16} />, danger: true, onClick: handleDelete }] : []),
  ];

  const navigate = useNavigate();

  const handleContentClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href) return;
    // Check if it's an internal message link
    const match = href.match(/\/(?:space\/\d+\/channel\/\d+|dm\/\d+)\/message\/\d+/);
    if (match) {
      e.preventDefault();
      // Extract path portion
      try {
        const url = new URL(href, window.location.origin);
        navigate(url.pathname);
      } catch {
        navigate(href);
      }
    }
  }, [navigate]);

  const handleUsernameClick = (e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    onUserClick(message.authorId, rect);
  };

  return (
    <>
    <div
      style={{ ...styles.message, marginTop: compact ? 1 : spacedSameAuthor ? 6 : 10, paddingTop: compact ? 1 : 0 }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onContextMenu={handleContextMenu}
      {...longPressHandlers}
    >
      {/* Action bar on hover */}
      {showActions && !editing && (
        <div style={styles.actionBar}>
          <button style={styles.actionBtn} title="Add reaction" onClick={() => setShowEmojiPicker(!showEmojiPicker)}><SmilePlus size={16} /></button>
          <button style={styles.actionBtn} title="Reply" onClick={() => onReply(message)}><Reply size={16} /></button>
          {message.replyCount > 0 && (
            <button style={styles.actionBtn} title="View thread" onClick={() => openThread(channelId, message.id)}><MessageSquare size={16} /></button>
          )}
          <button style={styles.actionBtn} title={message.isPinned ? 'Unpin' : 'Pin'} onClick={handlePin}><Pin size={16} /></button>
          <button style={styles.actionBtn} title="Share" onClick={() => setShowSharePicker(true)}><Forward size={16} /></button>
        </div>
      )}

      {/* Emoji picker */}
      {showEmojiPicker && (
        <EmojiPicker
          onSelect={(emoji) => {
            handleReaction(emoji);
            setShowEmojiPicker(false);
          }}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Pin indicator */}
      {message.isPinned && (
        <div style={styles.pinIndicator}><Pin size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }} />Pinned</div>
      )}

      {/* Muted user placeholder */}
      {isMuted && !showMutedContent && (
        <div style={styles.mutedPlaceholder}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
            Message from muted user
          </span>
          <button style={styles.showMutedBtn} onClick={() => setShowMutedContent(true)}>Show</button>
        </div>
      )}

      {(!isMuted || showMutedContent) && !compact && !spacedSameAuthor && (() => {
        const workflowName = message.metadata?.workflowDisplayName;
        const displayName = workflowName || message.author?.displayName || 'Unknown';
        const isWorkflowIdentity = !!workflowName;
        return (
          <div style={styles.messageHeader}>
            <Avatar
              src={isWorkflowIdentity ? null : (message.author?.avatarUrl || null)}
              name={displayName}
              size={32}
              baseColor={isWorkflowIdentity ? undefined : message.author?.baseColor}
              accentColor={isWorkflowIdentity ? undefined : message.author?.accentColor}
            />
            {isWorkflowIdentity ? (
              <span style={styles.username}>{displayName}</span>
            ) : (
              <button onClick={handleUsernameClick} style={styles.username}>
                {displayName}
              </button>
            )}
            {(isWorkflowIdentity || message.author?.isBot) && <span style={styles.botBadge}>BOT</span>}
            <span style={styles.timestamp}>{ts}</span>
            {message.editedAt && <span style={styles.edited}>(edited)</span>}
          </div>
        );
      })()}

      {(!isMuted || showMutedContent) && (
        <>
          {message.replyToId && (
            <div style={styles.replyIndicator}>Replying to a message</div>
          )}

          {/* Interactive workflow card */}
          {message.metadata?.cardInstanceId && (
            <div style={{ paddingLeft: 48, marginTop: 4 }}>
              <InteractiveCard cardInstanceId={message.metadata.cardInstanceId} spaceId={spaceId} />
            </div>
          )}

          {/* Portal invite card */}
          {message.messageType === 'portal_invite' && message.metadata ? (
            <PortalInviteCard message={message} spaceId={spaceId} />
          ) : !message.metadata?.cardInstanceId ? (
            /* Message content or inline edit */
            <div style={{ paddingLeft: 44, lineHeight: 1.3, marginTop: -6 }} onClick={handleContentClick}>
              {editing ? (
                <div style={styles.editBox}>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditSave(); }
                      if (e.key === 'Escape') setEditing(false);
                    }}
                    style={styles.editTextarea}
                    autoFocus
                    rows={2}
                  />
                  <div style={styles.editActions}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Esc to cancel, Enter to save</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => setEditing(false)} style={styles.editCancelBtn}>Cancel</button>
                      <button onClick={handleEditSave} style={styles.editSaveBtn}>Save</button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {message.messageType === 'system' ? (
                    <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>
                      <Markdown content={message.content} />
                    </div>
                  ) : (
                    <MessageEmbeds content={message.content} spaceId={spaceId} />
                  )}
                </>
              )}
            </div>
          ) : null}

          {/* Shared Post Card */}
          {message.metadata?.sharedPost && (
            <div style={{ paddingLeft: 44, marginTop: 4 }}>
              <SharedPostCard sharedPost={message.metadata.sharedPost} />
            </div>
          )}

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <MessageAttachments attachments={message.attachments} />
          )}

          {/* Reactions */}
          <ReactionBar
            reactions={message.reactions}
            currentUserId={currentUserId}
            onToggleReaction={handleReaction}
          />

          {/* Thread preview */}
          {message.replyCount > 0 && (
            <button style={styles.threadBtn} onClick={() => openThread(channelId, message.id)}>
              <MessageSquare size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }} />{message.replyCount} {message.replyCount === 1 ? 'reply' : 'replies'}
            </button>
          )}
        </>
      )}
    </div>
    {showSharePicker && (
      <ShareToSpacePicker
        contentType="post"
        itemId={message.id}
        onClose={() => setShowSharePicker(false)}
        onShared={() => setShowSharePicker(false)}
        onShareToChannel={async (targetChannelId) => {
          const link = `${window.location.origin}/space/${spaceId}/channel/${channelId}/message/${message.id}`;
          await api(`/channels/${targetChannelId}/messages`, {
            method: 'POST',
            body: JSON.stringify({ content: link }),
          });
        }}
        onShareToDM={async (conversationId) => {
          const link = `${window.location.origin}/space/${spaceId}/channel/${channelId}/message/${message.id}`;
          await api(`/conversations/${conversationId}/messages`, {
            method: 'POST',
            body: JSON.stringify({ content: link }),
          });
        }}
      />
    )}
    </>
  );
}

function PortalInviteCard({ message, spaceId }: { message: Message; spaceId: string }) {
  const [status, setStatus] = useState<'idle' | 'accepting' | 'rejecting' | 'accepted' | 'rejected'>('idle');
  const acceptInvite = usePortalsStore((s) => s.acceptInvite);
  const rejectInvite = usePortalsStore((s) => s.rejectInvite);

  const meta = message.metadata!;

  const handleAccept = async () => {
    setStatus('accepting');
    try {
      await acceptInvite(spaceId, meta.inviteId);
      setStatus('accepted');
    } catch {
      setStatus('idle');
    }
  };

  const handleReject = async () => {
    setStatus('rejecting');
    try {
      await rejectInvite(spaceId, meta.inviteId);
      setStatus('rejected');
    } catch {
      setStatus('idle');
    }
  };

  return (
    <div style={{ paddingLeft: 48, marginTop: 4 }}>
      <div style={styles.portalCard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Zap size={18} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Portal Invite</span>
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
          From <strong>{meta.sourceSpaceName}</strong> — channel <strong>#{meta.channelName}</strong>
          <br />
          Requested by <strong>{meta.requestedByUsername}</strong>
        </div>
        {status === 'accepted' ? (
          <div style={{ color: 'var(--success, #43b581)', fontSize: '0.85rem', fontWeight: 600 }}>Accepted</div>
        ) : status === 'rejected' ? (
          <div style={{ color: 'var(--danger)', fontSize: '0.85rem', fontWeight: 600 }}>Rejected</div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleAccept}
              disabled={status !== 'idle'}
              style={styles.portalAcceptBtn}
            >
              <Check size={14} /> {status === 'accepting' ? 'Accepting...' : 'Accept'}
            </button>
            <button
              onClick={handleReject}
              disabled={status !== 'idle'}
              style={styles.portalRejectBtn}
            >
              <X size={14} /> {status === 'rejecting' ? 'Rejecting...' : 'Reject'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const EPOCH = 1735689600000;

function snowflakeTime(id: string): number {
  try { return Number(BigInt(id) >> 22n) + EPOCH; } catch { return 0; }
}

function formatTimestamp(snowflakeId: string): string {
  try {
    const id = BigInt(snowflakeId);
    const timestamp = Number(id >> 22n) + EPOCH;
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
      ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

// ─── Shared Post Card (embedded in messages) ───

function SharedPostCard({ sharedPost }: { sharedPost: any }) {
  const navigate = useNavigate();

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '0.75rem',
      marginTop: 4,
      background: 'var(--bg-tertiary)',
      maxWidth: 500,
    }}>
      {/* Author */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        {sharedPost.author && (
          <>
            <div
              style={{
                width: 24, height: 24, borderRadius: '50%', overflow: 'hidden',
                background: sharedPost.author.baseColor || 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.6rem', color: '#fff', fontWeight: 700, flexShrink: 0,
                cursor: 'pointer',
              }}
              onClick={() => navigate(`/p/${sharedPost.author.username}`)}
            >
              {sharedPost.author.avatarUrl ? (
                <img src={sharedPost.author.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                (sharedPost.author.displayName || '?')[0].toUpperCase()
              )}
            </div>
            <span
              style={{ fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
              onClick={() => navigate(`/p/${sharedPost.author.username}`)}
            >
              {sharedPost.author.displayName}
            </span>
          </>
        )}
        {sharedPost.createdAt && (
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
            {new Date(sharedPost.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>

      {/* Body */}
      {sharedPost.body && (
        <div style={{ fontSize: '0.85rem', lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          <Markdown content={sharedPost.body} />
        </div>
      )}

      {sharedPost.attachments && sharedPost.attachments.filter((a: any) => a.type === 'image' || a.type === 'video').length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: sharedPost.attachments.filter((a: any) => a.type !== 'gpx').length === 1 ? '1fr' : 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 4,
          marginTop: 6,
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
        }}>
          {sharedPost.attachments
            .filter((a: any) => a.type === 'image' || a.type === 'video')
            .map((a: any, i: number) =>
              a.type === 'video' ? (
                <video key={i} src={a.url} controls style={{ width: '100%', maxHeight: 300, objectFit: 'cover', borderRadius: 'var(--radius)' }} />
              ) : (
                <img key={i} src={a.url} alt={a.originalName || ''} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover' }} />
              )
            )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '0 16px 16px',
    display: 'flex',
    flexDirection: 'column',
  },
  loading: {
    textAlign: 'center',
    color: 'var(--text-muted)',
    padding: '2rem',
  },
  loadMore: {
    background: 'none',
    border: 'none',
    color: 'var(--accent)',
    padding: '8px',
    fontSize: '0.85rem',
    cursor: 'pointer',
    textAlign: 'center',
  },
  message: {
    position: 'relative',
    padding: '2px 8px',
    borderRadius: 'var(--radius)',
  },
  messageHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 0,
  },
  username: {
    fontWeight: 600,
    color: 'var(--text-primary)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    fontSize: 'inherit',
  },
  botBadge: {
    background: 'var(--accent)',
    color: 'white',
    fontSize: '0.6rem',
    fontWeight: 700,
    padding: '1px 4px',
    borderRadius: 3,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.02em',
    verticalAlign: 'middle',
  },
  timestamp: {
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
  },
  edited: {
    color: 'var(--text-muted)',
    fontSize: '0.7rem',
  },
  replyIndicator: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    paddingLeft: 48,
    marginBottom: 2,
    borderLeft: '2px solid var(--accent)',
    marginLeft: 18,
    paddingTop: 2,
    paddingBottom: 2,
  },
  pinIndicator: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    paddingLeft: 48,
    marginBottom: 2,
  },
  actionBar: {
    position: 'absolute',
    right: 8,
    top: -12,
    display: 'flex',
    gap: 2,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '2px 4px',
    zIndex: 10,
  },
  actionBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    padding: '4px 8px',
    borderRadius: 4,
    fontSize: '0.85rem',
    cursor: 'pointer',
    lineHeight: 1,
  },
  editBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  editTextarea: {
    width: '100%',
    padding: '8px',
    background: 'var(--bg-input)',
    border: '1px solid var(--accent)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    resize: 'none',
    outline: 'none',
    lineHeight: 1.4,
  },
  editActions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editCancelBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    cursor: 'pointer',
    padding: '2px 8px',
  },
  editSaveBtn: {
    background: 'var(--accent)',
    border: 'none',
    color: 'white',
    fontSize: '0.75rem',
    cursor: 'pointer',
    padding: '3px 10px',
    borderRadius: 4,
    fontWeight: 600,
  },
  threadBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--accent)',
    fontSize: '0.8rem',
    cursor: 'pointer',
    paddingLeft: 48,
    marginTop: 4,
    fontWeight: 500,
  },
  portalCard: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--accent)',
    borderRadius: 'var(--radius)',
    padding: '12px 16px',
    maxWidth: 'min(400px, 100%)',
  },
  portalAcceptBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 14px',
    background: 'var(--success, #43b581)',
    border: 'none',
    color: 'white',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
  },
  mutedPlaceholder: {
    paddingLeft: 48,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 8px 4px 48px',
  },
  showMutedBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--text-muted)',
    fontSize: '0.7rem',
    cursor: 'pointer',
    padding: '1px 8px',
    borderRadius: 4,
  },
  portalRejectBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 14px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
  },
};
