import React, { useEffect, useState, Suspense } from 'react';
import { Footprints, Bike, Mountain, Clock, TrendingUp, Ruler, Edit3, Trash2, SmilePlus, MessageCircle, Share2, Forward, Copy, Check, Pin, Flag, Repeat2, X, Eye, Reply, UserPlus, UserMinus } from 'lucide-react';
import { api } from '../../lib/api.js';
import { Avatar } from '../common/Avatar.js';
import { EmojiPicker } from '../messages/EmojiPicker.js';
import { ShareToSpacePicker } from '../common/ShareToSpacePicker.js';
import { VisibilityBadge, CommentRow } from './PostCard.js';
import { usePersonalCollectionsStore } from '../../stores/personalCollections.js';
import { useFollowsStore } from '../../stores/follows.js';
import { usePreferencesStore } from '../../stores/preferences.js';
import { formatDistance, formatElevation } from '../../lib/units.js';
import { useNavigate } from 'react-router-dom';
import type { PersonalActivityItem, UserPost, UserPostComment, PersonalVisibility } from '@crabac/shared';
import { MiniMap } from '../common/MiniMap.js';

const LazyGpxMapModal = React.lazy(() => import('../messages/GpxMapModal.js'));

const ACTIVITY_TYPE_CONFIG: Record<string, { icon: React.ComponentType<any>; label: string; color: string }> = {
  run: { icon: Footprints, label: 'Run', color: '#e74c3c' },
  bike: { icon: Bike, label: 'Ride', color: '#3498db' },
  walk: { icon: Footprints, label: 'Walk', color: '#2ecc71' },
  hike: { icon: Mountain, label: 'Hike', color: '#e67e22' },
};

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}


export function ActivityPostCard({ post, currentUserId, isOwn, onReaction, onFetchComments, onAddComment, onDeleteComment, onCommentReaction, onRepost, onShare, onReport, onPin, onUnpin, onDelete, showAuthorLink, initialShowComments, onHashtagClick }: {
  post: UserPost;
  currentUserId: string;
  isOwn: boolean;
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
  onDelete?: () => void;
  showAuthorLink?: boolean;
  initialShowComments?: boolean;
  onHashtagClick?: (tag: string) => void;
}) {
  const navigate = useNavigate();
  const units = usePreferencesStore((s) => s.preferences.distanceUnits);
  const activityId = post.metadata?.activityId;
  const [activity, setActivity] = useState<PersonalActivityItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMap, setShowMap] = useState(false);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editVisibility, setEditVisibility] = useState<PersonalVisibility>('private');
  const [saving, setSaving] = useState(false);

  // Post interaction state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showComments, setShowComments] = useState(!!initialShowComments);
  const [comments, setComments] = useState<UserPostComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyToUsername, setReplyToUsername] = useState<string | null>(null);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [sharePickerOpen, setSharePickerOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [repostForm, setRepostForm] = useState(false);
  const [repostBody, setRepostBody] = useState('');
  const [repostVisibility, setRepostVisibility] = useState<PersonalVisibility>('public');
  const [reposting, setReposting] = useState(false);
  const { createRepost } = usePersonalCollectionsStore();

  // Follow state
  const [isFollowing, setIsFollowing] = useState<boolean | null>(null);
  const [isFollowedBy, setIsFollowedBy] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const { followUser, unfollowUser, getFollowStatus } = useFollowsStore();

  useEffect(() => {
    if (!isOwn && post.userId && currentUserId) {
      getFollowStatus(post.userId).then((s) => {
        setIsFollowing(s.isFollowing);
        setIsFollowedBy(s.isFollowedBy);
      }).catch(() => {});
    }
  }, [post.userId, isOwn, currentUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (initialShowComments) {
      setCommentsLoading(true);
      onFetchComments().then((result) => setComments(result)).catch(() => {}).finally(() => setCommentsLoading(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api<PersonalActivityItem>(`/users/me/collections/activities/${activityId}`)
      .then(setActivity)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activityId]);

  const config = activity ? (ACTIVITY_TYPE_CONFIG[activity.activityType] || ACTIVITY_TYPE_CONFIG.run) : ACTIVITY_TYPE_CONFIG.run;
  const Icon = config.icon;

  const dateStr = new Date(post.createdAt).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  const timeStr = new Date(post.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const handleFollowToggle = async () => {
    if (followLoading || isFollowing === null) return;
    setFollowLoading(true);
    try {
      if (isFollowing) await unfollowUser(post.userId);
      else await followUser(post.userId);
      setIsFollowing(!isFollowing);
    } catch {} finally { setFollowLoading(false); }
  };

  const startEdit = () => {
    if (!activity) return;
    setEditName(activity.name);
    setEditDescription(activity.description || '');
    setEditVisibility(activity.visibility);
    setIsEditing(true);
  };

  const saveEdit = async () => {
    if (!activity) return;
    setSaving(true);
    try {
      const updated = await api<PersonalActivityItem>(`/users/me/collections/activities/${activityId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editName, description: editDescription || null, visibility: editVisibility }),
      });
      setActivity(updated);
      setIsEditing(false);
    } catch {} finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!activity) return;
    try {
      await api(`/users/me/collections/activities/${activityId}`, { method: 'DELETE' });
      onDelete?.();
    } catch {}
  };

  const loadComments = async () => {
    setCommentsLoading(true);
    try { const result = await onFetchComments(); setComments(result); } catch {}
    setCommentsLoading(false);
  };

  const handleToggleComments = () => {
    const next = !showComments;
    setShowComments(next);
    if (next && comments.length === 0) loadComments();
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    try {
      const comment = await onAddComment(commentText.trim(), replyToId || undefined);
      if (replyToId) {
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
    try { await onDeleteComment(commentId); setComments((prev) => removeComment(prev, commentId)); } catch {}
  };

  const handleCommentReaction = async (commentId: string, emoji: string, hasReacted: boolean) => {
    try {
      const reactions = await onCommentReaction(commentId, emoji, hasReacted);
      setComments((prev) => updateCommentReactions(prev, commentId, reactions));
    } catch {}
  };

  const handleRepost = async () => {
    setReposting(true);
    try { await createRepost(post.id, repostVisibility, repostBody || null); setRepostForm(false); setRepostBody(''); } catch {}
    setReposting(false);
  };

  const authorClick = showAuthorLink && post.author?.username
    ? () => navigate(`/p/${post.author!.username}`)
    : undefined;

  if (loading) {
    return (
      <div style={{ ...cardStyle, padding: '1rem' }}>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Loading activity...</div>
      </div>
    );
  }

  if (!activity) return null;

  return (
    <div data-post-id={post.id} style={cardStyle}>
      {/* Route map preview - clickable to open detail */}
      {activity?.geojson && (
        <div
          style={{ padding: '12px 12px 0', cursor: 'pointer', aspectRatio: '1', overflow: 'hidden', borderRadius: 'var(--radius)' }}
          onClick={() => setShowMap(true)}
        >
          <MiniMap geojson={activity.geojson} bounds={activity.bounds} width="100%" height="100%" lineColor={config.color} />
        </div>
      )}

      <div style={{ padding: '0.75rem' }}>
        {/* Author row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ cursor: authorClick ? 'pointer' : undefined }} onClick={authorClick}>
            <Avatar
              src={post.author?.avatarUrl ?? null}
              name={post.author?.displayName || '?'}
              size={32}
              baseColor={post.author?.baseColor ?? null}
              accentColor={post.author?.accentColor ?? null}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', cursor: authorClick ? 'pointer' : undefined }} onClick={authorClick}>
              {post.author?.displayName}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {showAuthorLink && post.author?.username && (
                <span
                  style={{ marginRight: 6, color: 'var(--accent)', fontWeight: 600, cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); navigate(`/p/${post.author!.username}`); }}
                >@{post.author.username}</span>
              )}
              {dateStr} at {timeStr}
            </div>
          </div>
          {!isOwn && isFollowing !== null && (
            isFollowedBy ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 12, fontSize: '0.68rem', fontWeight: 600, border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                Following
              </span>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); handleFollowToggle(); }}
                disabled={followLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 12, fontSize: '0.68rem', fontWeight: 600,
                  border: isFollowing ? '1px solid var(--border)' : '1px solid var(--accent)',
                  background: isFollowing ? 'transparent' : 'var(--accent)', color: isFollowing ? 'var(--text-muted)' : 'white',
                  cursor: 'pointer', opacity: followLoading ? 0.6 : 1,
                }}
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
          <VisibilityBadge visibility={activity.visibility} />
        </div>

        {/* Activity content */}
        {isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              style={inputStyle}
              placeholder="Activity name"
              maxLength={255}
            />
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              style={{ ...inputStyle, minHeight: 50, resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="Description (optional)"
              maxLength={5000}
            />
            <select value={editVisibility} onChange={(e) => setEditVisibility(e.target.value as PersonalVisibility)} style={{ ...inputStyle, width: 'auto' }}>
              <option value="private">Private</option>
              <option value="followers">Followers</option>
              <option value="spaces">Shared Spaces</option>
              <option value="public">Public</option>
            </select>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={saveEdit} disabled={saving || !editName.trim()} style={accentBtnStyle}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setIsEditing(false)} style={cancelBtnStyle}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            {/* Activity name + type badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Icon size={16} style={{ color: config.color, flexShrink: 0 }} />
              <span style={{ fontWeight: 700, fontSize: '0.95rem', flex: 1 }}>{activity.name}</span>
              <span style={{
                fontSize: '0.65rem', padding: '2px 6px', borderRadius: 8,
                background: config.color, color: 'white', fontWeight: 600,
              }}>
                {config.label}
              </span>
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
              {activity.distanceKm != null && activity.distanceKm > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Ruler size={13} />
                  <span>{formatDistance(activity.distanceKm, units)}</span>
                </div>
              )}
              {activity.durationSec != null && activity.durationSec > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={13} />
                  <span>{formatDuration(activity.durationSec)}</span>
                </div>
              )}
              {activity.elevationGainM != null && activity.elevationGainM > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <TrendingUp size={13} />
                  <span>{formatElevation(activity.elevationGainM, units)}</span>
                </div>
              )}
            </div>

            {/* Description */}
            {activity.description && (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 }}>
                {activity.description.length > 300 ? activity.description.slice(0, 300) + '...' : activity.description}
              </div>
            )}
          </>
        )}

        {/* Reaction chips */}
        {post.reactions && post.reactions.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8, marginBottom: 2 }}>
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
                  <span style={{ fontSize: '0.75rem', color: hasReacted ? 'var(--accent)' : 'var(--text-secondary)' }}>{reaction.count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Action bar */}
        {!isEditing && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 8 }}>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={iconBtnStyle} title="Add reaction">
                <SmilePlus size={13} />
              </button>
              {showEmojiPicker && (
                <EmojiPicker onSelect={(emoji) => { onReaction(emoji, false); setShowEmojiPicker(false); }} onClose={() => setShowEmojiPicker(false)} />
              )}
            </div>
            <button onClick={handleToggleComments} style={{ ...iconBtnStyle, gap: 4, width: 'auto', paddingLeft: 8, paddingRight: 8 }} title="Comments">
              <MessageCircle size={13} />
              {post.commentCount > 0 && <span style={{ fontSize: '0.72rem' }}>{post.commentCount}</span>}
            </button>
            {onRepost && (
              <button onClick={() => setRepostForm(!repostForm)} style={iconBtnStyle} title="Repost">
                <Repeat2 size={13} />
              </button>
            )}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShareMenuOpen(!shareMenuOpen)} style={iconBtnStyle} title="Share">
                <Share2 size={13} />
              </button>
              {shareMenuOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShareMenuOpen(false)} />
                  <div style={{ position: 'absolute', left: 0, bottom: '100%', marginBottom: 4, zIndex: 100, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', minWidth: 170, padding: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                    <button onClick={() => { setSharePickerOpen(true); setShareMenuOpen(false); }} style={shareMenuItemStyle}>
                      <Forward size={14} /> Share
                    </button>
                    <button
                      onClick={async () => {
                        const url = `${window.location.origin}/p/${post.author?.username}/post/${post.id}`;
                        await navigator.clipboard.writeText(url);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                        setShareMenuOpen(false);
                      }}
                      style={shareMenuItemStyle}
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? 'Copied!' : 'Copy link'}
                    </button>
                  </div>
                </>
              )}
            </div>
            {onReport && !isOwn && (
              <button onClick={onReport} style={iconBtnStyle} title="Report">
                <Flag size={13} />
              </button>
            )}
            <div style={{ flex: 1 }} />
            {isOwn && onPin && !post.isPinned && (
              <button onClick={onPin} style={iconBtnStyle} title="Pin post">
                <Pin size={13} />
              </button>
            )}
            {isOwn && onUnpin && post.isPinned && (
              <button onClick={onUnpin} style={{ ...iconBtnStyle, color: 'var(--text-muted)' }} title="Unpin post">
                <Pin size={13} />
              </button>
            )}
            {isOwn && (
              <button onClick={startEdit} style={iconBtnStyle} title="Edit activity">
                <Edit3 size={13} />
              </button>
            )}
            {isOwn && (
              <button onClick={handleDelete} style={{ ...iconBtnStyle, color: 'var(--danger)' }} title="Delete activity">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        )}

        {/* Repost form */}
        {repostForm && (
          <div style={{ marginTop: 8, padding: '0.5rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <textarea value={repostBody} onChange={(e) => setRepostBody(e.target.value)} placeholder="Add a comment (optional)" style={{ ...inputStyle, minHeight: 40, resize: 'vertical', fontSize: '0.82rem' }} maxLength={10000} />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <select value={repostVisibility} onChange={(e) => setRepostVisibility(e.target.value as PersonalVisibility)} style={{ ...inputStyle, width: 'auto', padding: '0.25rem 0.4rem', fontSize: '0.75rem' }}>
                <option value="public">Public</option>
                <option value="followers">Followers</option>
                <option value="spaces">Spaces</option>
                <option value="private">Private</option>
              </select>
              <button onClick={handleRepost} disabled={reposting} style={{ ...accentBtnStyle, fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>
                {reposting ? 'Reposting...' : 'Repost'}
              </button>
              <button onClick={() => setRepostForm(false)} style={{ ...cancelBtnStyle, fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Comments */}
        {showComments && (
          <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            {commentsLoading && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '0.5rem' }}>Loading comments...</div>}
            {comments.map((comment) => (
              <CommentRow
                key={comment.id}
                comment={comment}
                currentUserId={currentUserId}
                postOwnerId={post.userId}
                onDelete={handleDeleteComment}
                onReaction={handleCommentReaction}
                onReply={(id, username) => { setReplyToId(id); setReplyToUsername(username); }}
                depth={0}
              />
            ))}
            {replyToId && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <Reply size={12} />
                <span>Replying to <strong style={{ color: 'var(--accent)' }}>@{replyToUsername}</strong></span>
                <button onClick={() => { setReplyToId(null); setReplyToUsername(null); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                  <X size={12} />
                </button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={replyToId ? `Reply to @${replyToUsername}...` : 'Write a comment...'}
                style={{ ...inputStyle, fontSize: '0.82rem' }}
                maxLength={4000}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
              />
              <button onClick={handleAddComment} disabled={!commentText.trim()} style={{ ...accentBtnStyle, fontSize: '0.75rem', padding: '0.3rem 0.6rem', flexShrink: 0 }}>Post</button>
            </div>
          </div>
        )}
      </div>

      {/* Share picker */}
      {sharePickerOpen && (
        <ShareToSpacePicker contentType="post" itemId={post.id} onClose={() => setSharePickerOpen(false)} onShared={() => setSharePickerOpen(false)} />
      )}

      {/* Full map modal */}
      {showMap && activity.geojson && (
        <Suspense fallback={null}>
          <LazyGpxMapModal
            attachment={{ id: '', url: activity.url || '', filename: '', originalName: activity.name || 'activity.gpx', mimeType: 'application/gpx+xml', size: 0 }}
            gpx={{
              geojson: activity.geojson,
              distanceKm: activity.distanceKm || 0,
              elevationGainM: activity.elevationGainM || 0,
              elevationLossM: activity.elevationLossM || 0,
              durationSec: activity.durationSec || 0,
              trackName: activity.name || 'Activity',
              bounds: activity.bounds,
            }}
            onClose={() => setShowMap(false)}
          />
        </Suspense>
      )}
    </div>
  );
}

// ─── Helpers ───

function insertReply(comments: UserPostComment[], parentId: string, reply: UserPostComment): UserPostComment[] {
  return comments.map((c) => {
    if (c.id === parentId) return { ...c, replies: [...(c.replies || []), { ...reply, replies: [] }] };
    if (c.replies?.length) return { ...c, replies: insertReply(c.replies, parentId, reply) };
    return c;
  });
}

function removeComment(comments: UserPostComment[], commentId: string): UserPostComment[] {
  return comments.filter((c) => c.id !== commentId).map((c) => c.replies?.length ? { ...c, replies: removeComment(c.replies, commentId) } : c);
}

function updateCommentReactions(comments: UserPostComment[], commentId: string, reactions: any): UserPostComment[] {
  return comments.map((c) => {
    if (c.id === commentId) return { ...c, reactions };
    if (c.replies?.length) return { ...c, replies: updateCommentReactions(c.replies, commentId, reactions) };
    return c;
  });
}

// ─── Styles ───

const cardStyle: React.CSSProperties = {
  borderRadius: 'var(--radius)',
  background: 'var(--bg-secondary)',
  overflow: 'hidden',
};

const iconBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, borderRadius: 'var(--radius)',
  border: 'none', background: 'transparent', color: 'var(--text-muted)',
  cursor: 'pointer', padding: 0,
};

const inputStyle: React.CSSProperties = {
  padding: '0.5rem 0.7rem', borderRadius: 'var(--radius)', border: 'none',
  background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '0.9rem',
  outline: 'none', width: '100%', boxSizing: 'border-box',
};

const accentBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '0.4rem 0.8rem', borderRadius: 'var(--radius)', border: 'none',
  background: 'var(--accent)', color: 'white', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
};

const cancelBtnStyle: React.CSSProperties = {
  padding: '0.4rem 0.8rem', borderRadius: 'var(--radius)',
  border: '1px solid var(--border)', background: 'transparent',
  color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
};

const shareMenuItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
  padding: '8px 12px', border: 'none', background: 'transparent',
  color: 'var(--text-primary)', fontSize: '0.82rem', cursor: 'pointer',
  borderRadius: 'var(--radius)', textAlign: 'left',
};
