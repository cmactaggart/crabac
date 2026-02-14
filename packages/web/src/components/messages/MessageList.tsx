import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Reply, SmilePlus, MessageSquare, Pin, Copy, Link2, Pencil, Trash2, FileText, Zap, Check, X } from 'lucide-react';
import { useMessagesStore } from '../../stores/messages.js';
import { usePortalsStore } from '../../stores/portals.js';
import { useMutesStore } from '../../stores/mutes.js';
import { Avatar } from '../common/Avatar.js';
import { Markdown } from '../common/Markdown.js';
import { MessageLinkEmbed, extractMessageLinks } from './MessageLinkEmbed.js';
import { EmojiPicker } from './EmojiPicker.js';
import { ContextMenu, useLongPress, type ContextMenuItem } from '../common/ContextMenu.js';
import type { Message, GpxTrackMetadata } from '@crabac/shared';
import { GpxPreviewCard } from './GpxPreviewCard.js';
import { CalendarEventCard, extractCalendarEvent } from '../calendar/CalendarEventCard.js';

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
        <div style={styles.loading}>Loading messages...</div>
      )}

      {hasMore && messages.length > 0 && (
        <button onClick={() => fetchMessages(channelId, messages[0]?.id)} style={styles.loadMore}>
          {loading ? 'Loading...' : 'Load older messages'}
        </button>
      )}

      {messages.map((msg, i) => {
        const prev = messages[i - 1];
        const sameAuthor = prev?.authorId === msg.authorId && !msg.replyToId;
        const gap = sameAuthor && prev ? snowflakeTime(msg.id) - snowflakeTime(prev.id) : Infinity;
        // <1min: compact, 1-15min: spaced (no header), >15min: full header
        const compact = sameAuthor && gap < 60000;
        const spacedSameAuthor = sameAuthor && gap >= 60000 && gap < 900000;
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
            onReply={onReply}
            onUserClick={onUserClick}
          />
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}

// Quick reactions bar (most used)
const QUICK_REACTIONS = ['\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F602}', '\u{1F389}', '\u{1F914}', '\u{1F622}', '\u{1F525}', '\u{1F440}'];

function MessageItem({
  message,
  compact,
  spacedSameAuthor,
  isOwn,
  currentUserId,
  channelId,
  spaceId,
  onReply,
  onUserClick,
}: {
  message: Message;
  compact: boolean;
  spacedSameAuthor?: boolean;
  isOwn: boolean;
  currentUserId: string;
  channelId: string;
  spaceId: string;
  onReply: (msg: Message) => void;
  onUserClick: (userId: string, rect: DOMRect) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
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
    ...(isOwn ? [{ label: 'Edit', icon: <Pencil size={16} />, onClick: handleEdit }] : []),
    ...(isOwn ? [{ label: 'Delete', icon: <Trash2 size={16} />, danger: true, onClick: handleDelete }] : []),
  ];

  const navigate = useNavigate();
  const linkedMessageIds = extractMessageLinks(message.content);

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

      {(!isMuted || showMutedContent) && !compact && !spacedSameAuthor && (
        <div style={styles.messageHeader}>
          <Avatar src={message.author?.avatarUrl || null} name={message.author?.displayName || '?'} size={32} baseColor={message.author?.baseColor} accentColor={message.author?.accentColor} />
          <button onClick={handleUsernameClick} style={styles.username}>
            {message.author?.displayName || 'Unknown'}
          </button>
          {message.author?.isBot && <span style={styles.botBadge}>BOT</span>}
          <span style={styles.timestamp}>{ts}</span>
          {message.editedAt && <span style={styles.edited}>(edited)</span>}
        </div>
      )}

      {(!isMuted || showMutedContent) && (
        <>
          {message.replyToId && (
            <div style={styles.replyIndicator}>Replying to a message</div>
          )}

          {/* Portal invite card */}
          {message.messageType === 'portal_invite' && message.metadata ? (
            <PortalInviteCard message={message} spaceId={spaceId} />
          ) : (
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
                  ) : (() => {
                    const calEvent = extractCalendarEvent(message.content);
                    if (calEvent) {
                      return (
                        <>
                          {calEvent.remainingContent && <Markdown content={calEvent.remainingContent} />}
                          <CalendarEventCard embed={calEvent.embed} spaceId={spaceId} />
                        </>
                      );
                    }
                    return (
                      <>
                        <Markdown content={message.content} />
                        {linkedMessageIds.map((mid) => (
                          <MessageLinkEmbed key={mid} messageId={mid} />
                        ))}
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          )}

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div style={styles.attachments}>
              {message.attachments.map((att) => {
                const gpxMeta = (att as any).metadata?.gpx as GpxTrackMetadata | undefined;
                if (gpxMeta) {
                  return <GpxPreviewCard key={att.id} attachment={att} gpx={gpxMeta} />;
                }
                const isImage = att.mimeType.startsWith('image/');
                return isImage ? (
                  <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer">
                    <img src={att.url} alt={att.originalName} style={styles.attachmentImage} />
                  </a>
                ) : (
                  <a key={att.id} href={att.url} download={att.originalName} style={styles.attachmentFile}>
                    <FileText size={16} /> {att.originalName}
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      ({(att.size / 1024).toFixed(1)} KB)
                    </span>
                  </a>
                );
              })}
            </div>
          )}

          {/* Reactions */}
          {message.reactions && message.reactions.length > 0 && (
            <div style={styles.reactions}>
              {message.reactions.map((reaction) => {
                const hasReacted = reaction.users.some((u) => u.id === currentUserId);
                return (
                  <button
                    key={reaction.emoji}
                    style={{
                      ...styles.reactionChip,
                      borderColor: hasReacted ? 'var(--accent)' : 'var(--border)',
                      background: hasReacted ? 'rgba(88, 101, 242, 0.15)' : 'var(--bg-secondary)',
                    }}
                    onClick={() => handleReaction(reaction.emoji)}
                    title={reaction.users.map((u) => u.username).join(', ')}
                  >
                    <span>{reaction.emoji}</span>
                    <span style={{ fontSize: '0.75rem', color: hasReacted ? 'var(--accent)' : 'var(--text-secondary)' }}>
                      {reaction.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Thread preview */}
          {message.replyCount > 0 && (
            <button style={styles.threadBtn} onClick={() => openThread(channelId, message.id)}>
              <MessageSquare size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }} />{message.replyCount} {message.replyCount === 1 ? 'reply' : 'replies'}
            </button>
          )}
        </>
      )}
    </div>
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

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    overflowY: 'auto',
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
  reactions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    paddingLeft: 48,
    marginTop: 4,
  },
  reactionChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    borderRadius: 12,
    border: '1px solid var(--border)',
    cursor: 'pointer',
    fontSize: '0.9rem',
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
  attachments: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    paddingLeft: 48,
    marginTop: 6,
  },
  attachmentImage: {
    maxWidth: 300,
    maxHeight: 200,
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
  },
  attachmentFile: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--accent)',
    fontSize: '0.85rem',
    textDecoration: 'none',
  },
  portalCard: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--accent)',
    borderRadius: 'var(--radius)',
    padding: '12px 16px',
    maxWidth: 400,
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
