import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus, UserMinus, Share2, Copy, MessageSquare, Forward, Check } from 'lucide-react';
import { useAuthStore } from '../stores/auth.js';
import { useSpacesStore } from '../stores/spaces.js';
import { useFollowsStore } from '../stores/follows.js';
import { usePersonalCollectionsStore } from '../stores/personalCollections.js';
import { useLayoutStore } from '../stores/layout.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { SpaceSidebar } from '../components/layout/SpaceSidebar.js';
import { PostCard } from '../components/posts/PostCard.js';
import { ShareToSpacePicker } from '../components/common/ShareToSpacePicker.js';
import { api } from '../lib/api.js';
import type { UserPost, UserPostComment } from '@crabac/shared';

function PostDetailContent() {
  const { username, postId } = useParams();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const { followUser, unfollowUser, getFollowStatus } = useFollowsStore();
  const { fetchComments, addComment, deleteComment, toggleCommentReaction } = usePersonalCollectionsStore();

  const [post, setPost] = useState<UserPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followStatus, setFollowStatus] = useState<{ isFollowing: boolean; isFriend: boolean }>({ isFollowing: false, isFriend: false });
  const [followLoading, setFollowLoading] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [sharePickerOpen, setSharePickerOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const isOwn = post?.userId === currentUser?.id;

  useEffect(() => {
    loadPost();
  }, [postId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadPost = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<UserPost>(`/follows/posts/${postId}`);
      setPost(data);

      // Fetch follow status for post author
      if (data.userId !== currentUser?.id) {
        const status = await getFollowStatus(data.userId);
        setFollowStatus(status);
      }
    } catch {
      setError('Post not found or not accessible.');
    }
    setLoading(false);
  };

  const handleFollow = async () => {
    if (!post || followLoading) return;
    setFollowLoading(true);
    try {
      if (followStatus.isFollowing) {
        await unfollowUser(post.userId);
        setFollowStatus((s) => ({ ...s, isFollowing: false }));
      } else {
        await followUser(post.userId);
        setFollowStatus((s) => ({ ...s, isFollowing: true }));
      }
    } catch {}
    setFollowLoading(false);
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/p/${username}/post/${postId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setShareMenuOpen(false);
  };

  const handleSendDM = () => {
    const url = `${window.location.origin}/p/${username}/post/${postId}`;
    navigate(`/dm?shareText=${encodeURIComponent(`Check out this post: ${url}`)}`);
    setShareMenuOpen(false);
  };

  const handleReaction = async (emoji: string, hasReacted: boolean) => {
    if (!post) return;
    try {
      const method = hasReacted ? 'DELETE' : 'PUT';
      await api(`/users/${post.userId}/posts/${post.id}/reactions/${encodeURIComponent(emoji)}`, { method });
      loadPost();
    } catch {}
  };

  const handleFetchComments = async () => {
    if (!post) return [];
    return fetchComments(post.id, { userId: post.userId });
  };

  const handleAddComment = async (body: string, parentCommentId?: string) => {
    if (!post) throw new Error('No post');
    return addComment(post.id, body, post.userId, parentCommentId);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!post) return;
    return deleteComment(post.id, commentId, post.userId);
  };

  const handleHashtagClick = (tag: string) => {
    navigate(`/feed?hashtag=${encodeURIComponent(tag)}`);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem', fontSize: '0.9rem' }}>
        Loading...
      </div>
    );
  }

  if (error || !post) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 16 }}>
          {error || 'Post not found.'}
        </div>
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: '0.4rem 0.8rem', borderRadius: 'var(--radius)',
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem',
          }}
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: 'var(--radius)',
            border: 'none', background: 'var(--bg-secondary)', color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={16} />
        </button>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Post</span>

        <div style={{ flex: 1 }} />

        {/* Follow/Unfollow button */}
        {!isOwn && !followStatus.isFriend && (
          <button
            onClick={handleFollow}
            disabled={followLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0.4rem 0.8rem', borderRadius: 'var(--radius)',
              border: followStatus.isFollowing ? '1px solid var(--border)' : 'none',
              background: followStatus.isFollowing ? 'transparent' : 'var(--accent)',
              color: followStatus.isFollowing ? 'var(--text-secondary)' : 'white',
              fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            {followStatus.isFollowing ? (
              <><UserMinus size={14} /> Unfollow</>
            ) : (
              <><UserPlus size={14} /> Follow</>
            )}
          </button>
        )}

        {/* Share button */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShareMenuOpen(!shareMenuOpen)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0.4rem 0.8rem', borderRadius: 'var(--radius)',
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Share2 size={14} /> Share
          </button>

          {shareMenuOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShareMenuOpen(false)} />
              <div style={{
                position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 100,
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', minWidth: 180, padding: 4,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}>
                <button onClick={handleSendDM} style={menuBtnStyle}>
                  <MessageSquare size={14} /> Send in DM
                </button>
                <button onClick={() => { setSharePickerOpen(true); setShareMenuOpen(false); }} style={menuBtnStyle}>
                  <Forward size={14} /> Share in channel
                </button>
                <button onClick={handleCopyLink} style={menuBtnStyle}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Post */}
      <PostCard
        post={post}
        currentUserId={currentUser?.id || ''}
        isOwn={isOwn}
        showAuthorLink
        initialShowComments
        onReaction={handleReaction}
        onFetchComments={handleFetchComments}
        onAddComment={handleAddComment}
        onDeleteComment={handleDeleteComment}
        onCommentReaction={(commentId, emoji, hasReacted) => toggleCommentReaction(commentId, emoji, hasReacted)}
        onRepost={!isOwn ? () => {} : undefined}
        onShare={() => setShareMenuOpen(true)}
        onHashtagClick={handleHashtagClick}
      />

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

const menuBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
  padding: '8px 12px', border: 'none', background: 'transparent',
  color: 'var(--text-primary)', fontSize: '0.82rem', cursor: 'pointer',
  borderRadius: 'var(--radius)', textAlign: 'left',
};

export function PostDetailPage() {
  const isMobile = useIsMobile();
  const { spaces, fetchSpaces } = useSpacesStore();
  const { channelSidebarOpen } = useLayoutStore();

  useEffect(() => {
    fetchSpaces();
  }, []);

  if (isMobile) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 56, overflowY: 'auto', padding: '1rem', background: 'linear-gradient(to bottom, var(--bg-primary), color-mix(in srgb, var(--bg-primary), black 18%))' }}>
        <PostDetailContent />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <div style={{ overflow: 'hidden', flexShrink: 0, transition: 'width 0.2s ease', height: '100%' }}>
        <SpaceSidebar spaces={spaces} activeSpaceId={null} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 700 }}>
          <PostDetailContent />
        </div>
      </div>
    </div>
  );
}
