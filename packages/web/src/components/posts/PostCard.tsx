import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Edit3, Eye, MapPin, SmilePlus, MessageCircle, Repeat2, Forward, X, Flag, Pin, Copy, Check, MessageSquare, Share2, Reply, UserPlus, UserMinus } from 'lucide-react';
import { Avatar } from '../common/Avatar.js';
import { EmojiPicker } from '../messages/EmojiPicker.js';
import { ShareToSpacePicker } from '../common/ShareToSpacePicker.js';
import { SpaceLinkEmbed, extractSpaceLinks } from '../spaces/SpaceLinkEmbed.js';
import { EventPostCard } from './EventPostCard.js';
import { usePersonalCollectionsStore } from '../../stores/personalCollections.js';
import { useFollowsStore } from '../../stores/follows.js';
import type { UserPost, UserPostComment, PersonalVisibility } from '@crabac/shared';

const VISIBILITY_LABELS: Record<PersonalVisibility, string> = {
  public: 'Public',
  private: 'Private',
  friends: 'Friends',
  spaces: 'Spaces',
};

export function VisibilityBadge({ visibility }: { visibility: PersonalVisibility }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 6px', borderRadius: 10, fontSize: '0.65rem', fontWeight: 600,
      color: 'var(--text-muted)',
    }}>
      <Eye size={10} />
      {VISIBILITY_LABELS[visibility]}
    </span>
  );
}

function renderTextWithMentions(text: string, navigate: (path: string) => void, onHashtagClick?: (tag: string) => void): React.ReactNode {
  const origin = window.location.origin;
  const escapedOrigin = origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Matches: **bold**, markdown links [text](/space/...), #hashtag, @username, full space URLs, or bare /space/... paths
  // Supports both /space/{id} and /space/slug/{slug}
  const pattern = new RegExp(
    `(\\*\\*[^*]+\\*\\*)|(\\[[^\\]]+\\]\\(\\/space\\/(?:slug\\/[a-zA-Z0-9_-]+|\\d+)\\))|(#[a-zA-Z0-9_]+)|(@[a-zA-Z0-9_-]+)|(${escapedOrigin}\\/space\\/(?:slug\\/[a-zA-Z0-9_-]+|\\d+))|\\/space\\/(?:slug\\/[a-zA-Z0-9_-]+|\\d+)`,
    'g',
  );

  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    // Push text before match
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }

    const full = match[0];

    if (match[1]) {
      // **bold** text
      result.push(
        <strong key={match.index}>{full.slice(2, -2)}</strong>,
      );
    } else if (match[2]) {
      // Markdown link [text](/space/{id}) or [text](/space/slug/{slug})
      const inner = full.match(/^\[([^\]]+)\]\((\/space\/(?:slug\/[a-zA-Z0-9_-]+|\d+))\)$/);
      if (inner) {
        result.push(
          <span
            key={match.index}
            style={{ color: 'var(--accent)', fontWeight: 600, cursor: 'pointer' }}
            onClick={() => navigate(inner[2])}
          >
            {inner[1]}
          </span>,
        );
      }
    } else if (match[3]) {
      // #hashtag
      const tag = full.slice(1);
      result.push(
        <span
          key={match.index}
          style={{ color: 'var(--accent)', fontWeight: 600, cursor: 'pointer' }}
          onClick={() => onHashtagClick ? onHashtagClick(tag) : navigate(`/feed?hashtag=${encodeURIComponent(tag)}`)}
        >
          {full}
        </span>,
      );
    } else if (match[4]) {
      // @username mention
      const username = full.slice(1);
      result.push(
        <span
          key={match.index}
          style={{ color: 'var(--accent)', fontWeight: 600, cursor: 'pointer' }}
          onClick={() => navigate(`/p/${username}`)}
        >
          {full}
        </span>,
      );
    } else if (match[5]) {
      // Full space URL
      const pathMatch = full.match(/(\/space\/(?:slug\/[a-zA-Z0-9_-]+|\d+))/);
      if (pathMatch) {
        result.push(
          <span
            key={match.index}
            style={{ color: 'var(--accent)', cursor: 'pointer' }}
            onClick={() => navigate(pathMatch[1])}
          >
            {full}
          </span>,
        );
      } else {
        result.push(full);
      }
    } else {
      // Full or bare space URL — extract the /space/... path
      const pathMatch = full.match(/(\/space\/(?:slug\/[a-zA-Z0-9_-]+|\d+))/);
      if (pathMatch) {
        result.push(
          <span
            key={match.index}
            style={{ color: 'var(--accent)', cursor: 'pointer' }}
            onClick={() => navigate(pathMatch[1])}
          >
            {full}
          </span>,
        );
      } else {
        result.push(full);
      }
    }

    lastIndex = match.index + full.length;
  }

  // Push remaining text
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result;
}

export function PostCard({ post, currentUserId, isOwn, isEditing, editBody, editVisibility, onEditBodyChange, onEditVisibilityChange, onStartEdit, onSaveEdit, onCancelEdit, onDelete, onReaction, onFetchComments, onAddComment, onDeleteComment, onCommentReaction, onRepost, onShare, onReport, onPin, onUnpin, showAuthorLink, initialShowComments, onHashtagClick }: {
  post: UserPost;
  currentUserId: string;
  isOwn: boolean;
  isEditing?: boolean;
  editBody?: string;
  editVisibility?: PersonalVisibility;
  onEditBodyChange?: (v: string) => void;
  onEditVisibilityChange?: (v: PersonalVisibility) => void;
  onStartEdit?: () => void;
  onSaveEdit?: () => void;
  onCancelEdit?: () => void;
  onDelete?: () => void;
  onReaction: (emoji: string, hasReacted: boolean) => void;
  onFetchComments: (opts?: { before?: string }) => Promise<UserPostComment[]>;
  onAddComment: (body: string, parentCommentId?: string) => Promise<UserPostComment>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onCommentReaction: (commentId: string, emoji: string, hasReacted: boolean) => Promise<any>;
  onRepost?: ((post: UserPost) => void) | undefined;
  onShare: () => void;
  onReport?: () => void;
  onPin?: () => void;
  onUnpin?: () => void;
  showAuthorLink?: boolean;
  initialShowComments?: boolean;
  onHashtagClick?: (tag: string) => void;
}) {
  const navigate = useNavigate();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showComments, setShowComments] = useState(!!initialShowComments);
  const [comments, setComments] = useState<UserPostComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  // Auto-load comments when initialShowComments is set
  useEffect(() => {
    if (initialShowComments) {
      setCommentsLoading(true);
      onFetchComments().then((result) => setComments(result)).catch(() => {}).finally(() => setCommentsLoading(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [commentText, setCommentText] = useState('');
  const [repostForm, setRepostForm] = useState(false);
  const [repostBody, setRepostBody] = useState('');
  const [repostVisibility, setRepostVisibility] = useState<PersonalVisibility>('public');
  const [reposting, setReposting] = useState(false);
  const { createRepost } = usePersonalCollectionsStore();
  const [sharePickerOpen, setSharePickerOpen] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFollowing, setIsFollowing] = useState<boolean | null>(null);
  const [isFriend, setIsFriend] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const { followUser, unfollowUser, getFollowStatus } = useFollowsStore();

  // Load follow status for non-own posts
  useEffect(() => {
    if (!isOwn && post.userId && currentUserId) {
      getFollowStatus(post.userId).then((s) => {
        setIsFollowing(s.isFollowing);
        setIsFriend(s.isFriend);
      }).catch(() => {});
    }
  }, [post.userId, isOwn, currentUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFollowToggle = async () => {
    if (followLoading || isFollowing === null) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await unfollowUser(post.userId);
      } else {
        await followUser(post.userId);
      }
      setIsFollowing(!isFollowing);
    } catch (err) {
      console.error('Follow toggle failed:', err);
    } finally {
      setFollowLoading(false);
    }
  };

  const dateStr = new Date(post.createdAt).toLocaleDateString([], {
    year: 'numeric', month: 'short', day: 'numeric',
  });
  const timeStr = new Date(post.createdAt).toLocaleTimeString([], {
    hour: 'numeric', minute: '2-digit',
  });

  const loadComments = async () => {
    setCommentsLoading(true);
    try {
      const result = await onFetchComments();
      setComments(result);
    } catch {}
    setCommentsLoading(false);
  };

  const handleToggleComments = () => {
    const next = !showComments;
    setShowComments(next);
    if (next && comments.length === 0) loadComments();
  };

  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyToUsername, setReplyToUsername] = useState<string | null>(null);

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    try {
      const comment = await onAddComment(commentText.trim(), replyToId || undefined);
      if (replyToId) {
        // Insert reply into nested structure
        setComments((prev) => insertReply(prev, replyToId, comment));
      } else {
        setComments((prev) => [...prev, { ...comment, replies: [] }]);
      }
      setCommentText('');
      setReplyToId(null);
      setReplyToUsername(null);
    } catch {}
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await onDeleteComment(commentId);
      setComments((prev) => removeComment(prev, commentId));
    } catch {}
  };

  const handleCommentReaction = async (commentId: string, emoji: string, hasReacted: boolean) => {
    try {
      const reactions = await onCommentReaction(commentId, emoji, hasReacted);
      setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, reactions } : c));
    } catch {}
  };

  const handleRepost = async () => {
    setReposting(true);
    try {
      await createRepost(post.id, repostVisibility, repostBody || null);
      setRepostForm(false);
      setRepostBody('');
    } catch {}
    setReposting(false);
  };

  const authorClick = showAuthorLink && post.author?.username
    ? () => navigate(`/p/${post.author!.username}`)
    : undefined;

  const postDetailUrl = post.author?.username ? `/p/${post.author.username}/post/${post.id}` : null;

  const handleCardClick = (e: React.MouseEvent) => {
    if (!postDetailUrl) return;
    // Don't navigate if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, textarea, select, [role="button"]')) return;
    // Don't navigate if clicking on clickable elements (mentions, hashtags, links, author names/avatars)
    if (target.closest('[style*="cursor: pointer"], [style*="cursor:pointer"]')) return;
    navigate(postDetailUrl);
  };

  return (
    <div data-post-id={post.id} style={{ ...styles.postCard, cursor: postDetailUrl ? 'pointer' : undefined }} onClick={handleCardClick}>
      {/* Repost header */}
      {post.repostOfId && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <Repeat2 size={14} />
          <span>Reposted by <strong
            style={{ color: 'var(--text-primary)', cursor: 'pointer' }}
            onClick={() => post.author?.username && navigate(`/p/${post.author.username}`)}
          >{post.author?.displayName}</strong></span>
        </div>
      )}

      {/* Embedded repost card */}
      {post.repostOfId && post.repostOf ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.75rem', marginBottom: 8, background: 'var(--bg-tertiary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Avatar src={post.repostOf.author?.avatarUrl || null} name={post.repostOf.author?.displayName || '?'} size={24} baseColor={post.repostOf.author?.baseColor} accentColor={post.repostOf.author?.accentColor} />
            <span
              style={{ fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
              onClick={() => post.repostOf?.author?.username && navigate(`/p/${post.repostOf.author.username}`)}
            >{post.repostOf.author?.displayName}</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(post.repostOf.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
          </div>
          {post.repostOf.body && <div style={{ fontSize: '0.85rem', lineHeight: 1.4, marginBottom: 6, whiteSpace: 'pre-wrap' }}>{renderTextWithMentions(post.repostOf.body, navigate, onHashtagClick)}</div>}
          {post.repostOf.attachments.filter((a) => a.type === 'image' || a.type === 'video').length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: post.repostOf.attachments.filter((a) => a.type !== 'gpx').length === 1 ? '1fr' : 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 4,
              borderRadius: 'var(--radius)',
              overflow: 'hidden',
            }}>
              {post.repostOf.attachments.filter((a) => a.type === 'image' || a.type === 'video').map((a) =>
                a.type === 'video' ? (
                  <video key={a.id} src={a.url} controls style={{ width: '100%', maxHeight: 300, objectFit: 'cover', borderRadius: 'var(--radius)' }} />
                ) : (
                  <img key={a.id} src={a.url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover' }} />
                )
              )}
            </div>
          )}
        </div>
      ) : post.repostOfId && !post.repostOf ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.75rem', marginBottom: 8, background: 'var(--bg-tertiary)', color: 'var(--text-muted)', fontSize: '0.82rem', fontStyle: 'italic' }}>
          [Original post deleted]
        </div>
      ) : null}

      {/* Post Header (skip for reposts since header is above) */}
      {!post.repostOfId && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ cursor: authorClick ? 'pointer' : undefined }} onClick={authorClick}>
            <Avatar
              src={post.author?.avatarUrl ?? null}
              name={post.author?.displayName || '?'}
              size={36}
              baseColor={post.author?.baseColor ?? null}
              accentColor={post.author?.accentColor ?? null}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{ fontWeight: 600, fontSize: '0.9rem', cursor: authorClick ? 'pointer' : undefined }}
              onClick={authorClick}
            >
              {post.author?.displayName}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {showAuthorLink && post.author?.username && (
                <span
                  style={{ marginRight: 6, color: 'var(--accent)', fontWeight: 600, cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); navigate(`/p/${post.author!.username}`); }}
                >@{post.author.username}</span>
              )}
              <span
                style={{ cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); if (post.author?.username) navigate(`/p/${post.author.username}/post/${post.id}`); }}
                title="View post"
              >{dateStr} at {timeStr}</span>
            </div>
          </div>
          {!isOwn && isFollowing !== null && (
            isFriend ? (
              <span style={{
                display: 'flex', alignItems: 'center', gap: 3,
                padding: '3px 8px', borderRadius: 12, fontSize: '0.68rem', fontWeight: 600,
                border: '1px solid var(--border)', color: 'var(--text-muted)',
              }}>
                Friends
              </span>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); handleFollowToggle(); }}
                disabled={followLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 3,
                  padding: '3px 8px', borderRadius: 12, fontSize: '0.68rem', fontWeight: 600,
                  border: isFollowing ? '1px solid var(--border)' : '1px solid var(--accent)',
                  background: isFollowing ? 'transparent' : 'var(--accent)',
                  color: isFollowing ? 'var(--text-muted)' : 'white',
                  cursor: 'pointer', opacity: followLoading ? 0.6 : 1,
                }}
                title={isFollowing ? 'Unfollow' : 'Follow'}
              >
                {isFollowing ? <UserMinus size={10} /> : <UserPlus size={10} />}
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            )
          )}
          {post.isPinned && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 10, fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              <Pin size={10} /> Pinned
            </span>
          )}
          <VisibilityBadge visibility={post.visibility} />
        </div>
      )}

      {/* Body */}
      {isEditing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
          <textarea
            value={editBody}
            onChange={(e) => onEditBodyChange?.(e.target.value)}
            style={{ ...styles.formInput, minHeight: 50, resize: 'vertical', fontFamily: 'inherit' }}
            maxLength={10000}
          />
          <select value={editVisibility} onChange={(e) => onEditVisibilityChange?.(e.target.value as PersonalVisibility)} style={{ ...styles.formInput, width: 'auto' }}>
            <option value="private">Private</option>
            <option value="friends">Friends</option>
            <option value="spaces">Shared Spaces</option>
            <option value="public">Public</option>
          </select>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onSaveEdit} style={styles.uploadBtn}>Save</button>
            <button onClick={onCancelEdit} style={styles.cancelBtn}>Cancel</button>
          </div>
        </div>
      ) : (
        post.body && (
          <div style={{ fontSize: '0.9rem', lineHeight: 1.5, marginBottom: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {renderTextWithMentions(post.body, navigate, onHashtagClick)}
          </div>
        )
      )}

      {/* Media Grid */}
      {post.attachments.filter((a) => a.type === 'image' || a.type === 'video').length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: post.attachments.filter((a) => a.type !== 'gpx').length === 1 ? '1fr' : 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 4,
          marginBottom: 8,
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
        }}>
          {post.attachments
            .filter((a) => a.type === 'image' || a.type === 'video')
            .map((att) =>
              att.type === 'video' ? (
                <video key={att.id} src={att.url} controls style={{ width: '100%', maxHeight: 300, objectFit: 'cover', borderRadius: 'var(--radius)' }} />
              ) : (
                <img key={att.id} src={att.url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover' }} />
              )
            )}
        </div>
      )}

      {/* GPX attachments */}
      {post.attachments.filter((a) => a.type === 'gpx').map((att) => (
        <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)', marginBottom: 8, fontSize: '0.82rem' }}>
          <MapPin size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span style={{ fontWeight: 600 }}>{att.originalName}</span>
        </div>
      ))}

      {/* Space link embeds */}
      {(() => {
        const spaceRefs = extractSpaceLinks(post.body || '');
        return spaceRefs.length > 0 && spaceRefs.map((ref) => (
          <SpaceLinkEmbed key={ref.key} spaceId={ref.type === 'id' ? ref.value : undefined} spaceSlug={ref.type === 'slug' ? ref.value : undefined} />
        ));
      })()}

      {/* Event post card */}
      {post.metadata?.type === 'calendar_event' && post.metadata.eventId && post.metadata.spaceId && (
        <EventPostCard eventId={post.metadata.eventId} spaceId={post.metadata.spaceId} />
      )}

      {/* Reaction chips */}
      {post.reactions && post.reactions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {post.reactions.map((reaction) => {
            const hasReacted = reaction.users.some((u) => u.id === currentUserId);
            return (
              <button
                key={reaction.emoji}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '2px 8px', borderRadius: 12, border: `1px solid ${hasReacted ? 'var(--accent)' : 'var(--border)'}`,
                  background: hasReacted ? 'rgba(88, 101, 242, 0.15)' : 'var(--bg-tertiary)',
                  cursor: 'pointer', fontSize: '0.82rem',
                }}
                onClick={() => onReaction(reaction.emoji, hasReacted)}
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

      {/* Action bar */}
      {!isEditing && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 4 }}>
          {/* Reaction button */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={styles.iconBtn} title="Add reaction">
              <SmilePlus size={13} />
            </button>
            {showEmojiPicker && (
              <EmojiPicker onSelect={(emoji) => { onReaction(emoji, false); setShowEmojiPicker(false); }} onClose={() => setShowEmojiPicker(false)} />
            )}
          </div>

          {/* Comment toggle */}
          <button onClick={handleToggleComments} style={{ ...styles.iconBtn, gap: 4, width: 'auto', paddingLeft: 8, paddingRight: 8 }} title="Comments">
            <MessageCircle size={13} />
            {post.commentCount > 0 && <span style={{ fontSize: '0.72rem' }}>{post.commentCount}</span>}
          </button>

          {/* Repost button (only on other users' posts) */}
          {onRepost && (
            <button onClick={() => setRepostForm(!repostForm)} style={styles.iconBtn} title="Repost">
              <Repeat2 size={13} />
            </button>
          )}

          {/* Share menu */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShareMenuOpen(!shareMenuOpen)} style={styles.iconBtn} title="Share">
              <Share2 size={13} />
            </button>
            {shareMenuOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShareMenuOpen(false)} />
                <div style={{
                  position: 'absolute', left: 0, bottom: '100%', marginBottom: 4, zIndex: 100,
                  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', minWidth: 170, padding: 4,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}>
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/p/${post.author?.username}/post/${post.id}`;
                      navigate(`/dm?shareText=${encodeURIComponent(`Check out this post: ${url}`)}`);
                      setShareMenuOpen(false);
                    }}
                    style={styles.shareMenuItem}
                  >
                    <MessageSquare size={14} /> Send in DM
                  </button>
                  <button onClick={() => { setSharePickerOpen(true); setShareMenuOpen(false); }} style={styles.shareMenuItem}>
                    <Forward size={14} /> Share in channel
                  </button>
                  <button
                    onClick={async () => {
                      const url = `${window.location.origin}/p/${post.author?.username}/post/${post.id}`;
                      await navigator.clipboard.writeText(url);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                      setShareMenuOpen(false);
                    }}
                    style={styles.shareMenuItem}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied!' : 'Copy link'}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Report (non-own posts) */}
          {onReport && !isOwn && (
            <button onClick={onReport} style={styles.iconBtn} title="Report">
              <Flag size={13} />
            </button>
          )}

          <div style={{ flex: 1 }} />

          {/* Pin/Unpin (own posts only) */}
          {isOwn && onPin && !post.isPinned && (
            <button onClick={onPin} style={styles.iconBtn} title="Pin post">
              <Pin size={13} />
            </button>
          )}
          {isOwn && onUnpin && post.isPinned && (
            <button onClick={onUnpin} style={{ ...styles.iconBtn, color: 'var(--text-muted)' }} title="Unpin post">
              <Pin size={13} />
            </button>
          )}

          {/* Edit/Delete (own posts only) */}
          {isOwn && onStartEdit && (
            <button onClick={onStartEdit} style={styles.iconBtn} title="Edit">
              <Edit3 size={13} />
            </button>
          )}
          {isOwn && onDelete && (
            <button onClick={onDelete} style={{ ...styles.iconBtn, color: 'var(--danger)' }} title="Delete">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      )}

      {/* Repost inline form */}
      {repostForm && (
        <div style={{ marginTop: 8, padding: '0.5rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <textarea
            value={repostBody}
            onChange={(e) => setRepostBody(e.target.value)}
            placeholder="Add a comment (optional)"
            style={{ ...styles.formInput, minHeight: 40, resize: 'vertical', fontFamily: 'inherit', fontSize: '0.82rem' }}
            maxLength={10000}
          />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <select value={repostVisibility} onChange={(e) => setRepostVisibility(e.target.value as PersonalVisibility)} style={{ ...styles.formInput, width: 'auto', padding: '0.25rem 0.4rem', fontSize: '0.75rem' }}>
              <option value="public">Public</option>
              <option value="friends">Friends</option>
              <option value="spaces">Spaces</option>
              <option value="private">Private</option>
            </select>
            <button onClick={handleRepost} disabled={reposting} style={{ ...styles.uploadBtn, fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>
              {reposting ? 'Reposting...' : 'Repost'}
            </button>
            <button onClick={() => setRepostForm(false)} style={{ ...styles.cancelBtn, fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Comments section */}
      {showComments && (
        <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          {commentsLoading && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '0.5rem' }}>Loading comments...</div>}

          {comments.map((comment) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              postOwnerId={post.userId}
              onDelete={(id) => handleDeleteComment(id)}
              onReaction={(commentId, emoji, hasReacted) => handleCommentReaction(commentId, emoji, hasReacted)}
              onReply={(id, username) => { setReplyToId(id); setReplyToUsername(username); }}
              depth={0}
            />
          ))}

          {/* Reply indicator */}
          {replyToId && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <Reply size={12} />
              <span>Replying to <strong style={{ color: 'var(--accent)' }}>@{replyToUsername}</strong></span>
              <button
                onClick={() => { setReplyToId(null); setReplyToUsername(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Add comment input */}
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={replyToId ? `Reply to @${replyToUsername}...` : 'Write a comment...'}
              style={{ ...styles.formInput, fontSize: '0.82rem' }}
              maxLength={4000}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
            />
            <button onClick={handleAddComment} disabled={!commentText.trim()} style={{ ...styles.uploadBtn, fontSize: '0.75rem', padding: '0.3rem 0.6rem', flexShrink: 0 }}>
              Post
            </button>
          </div>
        </div>
      )}

      {/* Share to channel picker */}
      {sharePickerOpen && (
        <ShareToSpacePicker
          contentType="post"
          itemId={post.id}
          onClose={() => setSharePickerOpen(false)}
          onShared={() => setSharePickerOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Nested comment helpers ───

function insertReply(comments: UserPostComment[], parentId: string, reply: UserPostComment): UserPostComment[] {
  return comments.map((c) => {
    if (c.id === parentId) {
      return { ...c, replies: [...(c.replies || []), { ...reply, replies: [] }] };
    }
    if (c.replies?.length) {
      return { ...c, replies: insertReply(c.replies, parentId, reply) };
    }
    return c;
  });
}

function removeComment(comments: UserPostComment[], commentId: string): UserPostComment[] {
  return comments
    .filter((c) => c.id !== commentId)
    .map((c) => c.replies?.length ? { ...c, replies: removeComment(c.replies, commentId) } : c);
}

// ─── Comment Row ───

const MAX_DEPTH = 3;

export function CommentRow({ comment, currentUserId, postOwnerId, onDelete, onReaction, onReply, depth }: {
  comment: UserPostComment;
  currentUserId: string;
  postOwnerId: string;
  onDelete: (commentId: string) => void;
  onReaction: (commentId: string, emoji: string, hasReacted: boolean) => void;
  onReply: (commentId: string, username: string) => void;
  depth: number;
}) {
  const navigate = useNavigate();
  const canDelete = comment.userId === currentUserId || postOwnerId === currentUserId;
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  return (
    <div style={{ marginLeft: depth > 0 ? Math.min(depth, MAX_DEPTH) * 20 : 0, borderLeft: depth > 0 ? '2px solid var(--border)' : undefined, paddingLeft: depth > 0 ? 8 : 0 }}>
      <div style={{ display: 'flex', gap: 8, padding: '6px 0', fontSize: '0.82rem' }}>
        <Avatar src={comment.author?.avatarUrl || null} name={comment.author?.displayName || '?'} size={depth > 0 ? 20 : 24} baseColor={comment.author?.baseColor} accentColor={comment.author?.accentColor} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{ fontWeight: 600, fontSize: '0.8rem', cursor: comment.author?.username ? 'pointer' : undefined, color: comment.author?.username ? 'var(--text-primary)' : undefined }}
              onClick={comment.author?.username ? () => navigate(`/p/${comment.author!.username}`) : undefined}
            >{comment.author?.displayName}</span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              {new Date(comment.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </span>
            {canDelete && (
              <button onClick={() => onDelete(comment.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, marginLeft: 'auto', display: 'flex' }} title="Delete comment">
                <X size={12} />
              </button>
            )}
          </div>
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.4, marginTop: 2 }}>{renderTextWithMentions(comment.body, navigate)}</div>

          {/* Comment actions: react + reply */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                <SmilePlus size={12} />
              </button>
              {showEmojiPicker && (
                <EmojiPicker onSelect={(emoji) => { onReaction(comment.id, emoji, false); setShowEmojiPicker(false); }} onClose={() => setShowEmojiPicker(false)} />
              )}
            </div>
            <button
              onClick={() => onReply(comment.id, comment.author?.username || '')}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.72rem' }}
            >
              <Reply size={12} /> Reply
            </button>
          </div>

          {/* Comment reactions */}
          {comment.reactions && comment.reactions.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
              {comment.reactions.map((reaction) => {
                const hasReacted = reaction.users.some((u) => u.id === currentUserId);
                return (
                  <button
                    key={reaction.emoji}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 3,
                      padding: '1px 6px', borderRadius: 10, border: `1px solid ${hasReacted ? 'var(--accent)' : 'var(--border)'}`,
                      background: hasReacted ? 'rgba(88, 101, 242, 0.15)' : 'var(--bg-tertiary)',
                      cursor: 'pointer', fontSize: '0.75rem',
                    }}
                    onClick={() => onReaction(comment.id, reaction.emoji, hasReacted)}
                    title={reaction.users.map((u) => u.username).join(', ')}
                  >
                    <span>{reaction.emoji}</span>
                    <span style={{ color: hasReacted ? 'var(--accent)' : 'var(--text-secondary)' }}>{reaction.count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Nested replies */}
      {comment.replies && comment.replies.length > 0 && (
        comment.replies.map((reply) => (
          <CommentRow
            key={reply.id}
            comment={reply}
            currentUserId={currentUserId}
            postOwnerId={postOwnerId}
            onDelete={onDelete}
            onReaction={onReaction}
            onReply={onReply}
            depth={depth + 1}
          />
        ))
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  postCard: {
    padding: '1rem',
    borderRadius: 'var(--radius)',
    background: 'var(--bg-secondary)',
  },
  iconBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 0,
  },
  formInput: {
    padding: '0.5rem 0.7rem',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  uploadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0.4rem 0.8rem',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--accent)',
    color: 'white',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '0.4rem 0.8rem',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  shareMenuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '8px 12px',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontSize: '0.82rem',
    cursor: 'pointer',
    borderRadius: 'var(--radius)',
    textAlign: 'left' as const,
  },
};
