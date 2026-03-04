import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuthStore } from '../stores/auth.js';
import { useSpacesStore } from '../stores/spaces.js';
import { useFeedStore } from '../stores/feed.js';
import { usePersonalCollectionsStore } from '../stores/personalCollections.js';
import { useNotificationsStore } from '../stores/notifications.js';
import { useFollowsStore } from '../stores/follows.js';
import { useLayoutStore } from '../stores/layout.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { SpaceSidebar } from '../components/layout/SpaceSidebar.js';
import { ProfileSidebar } from '../components/layout/ProfileSidebar.js';
import { PostCard } from '../components/posts/PostCard.js';
import { ReportModal } from '../components/moderation/ReportModal.js';
import { api } from '../lib/api.js';
import type { UserPost } from '@crabac/shared';

/**
 * FeedView — shared feed rendering component.
 */
export function FeedView() {
  const currentUser = useAuthStore((s) => s.user);
  const { posts, loading, hasMore, fetchFeed } = useFeedStore();
  const { togglePostReaction, fetchComments, addComment, deleteComment, toggleCommentReaction } = usePersonalCollectionsStore();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [reportPost, setReportPost] = useState<UserPost | null>(null);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  // Infinite scroll
  const loadMore = useCallback(() => {
    if (loading || !hasMore || posts.length === 0) return;
    fetchFeed({ before: posts[posts.length - 1].id });
  }, [loading, hasMore, posts, fetchFeed]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const handleReaction = async (post: UserPost, emoji: string, hasReacted: boolean) => {
    try {
      const method = hasReacted ? 'DELETE' : 'PUT';
      await api(`/users/${post.userId}/posts/${post.id}/reactions/${encodeURIComponent(emoji)}`, { method });
      // Refresh feed
      fetchFeed();
    } catch {}
  };

  const handleFetchComments = async (postId: string, post: UserPost) => {
    return fetchComments(postId, { userId: post.userId });
  };

  const handleAddComment = async (postId: string, body: string, post: UserPost) => {
    return addComment(postId, body, post.userId);
  };

  const handleDeleteComment = async (postId: string, commentId: string, post: UserPost) => {
    return deleteComment(postId, commentId, post.userId);
  };

  return (
    <div>
      {posts.length === 0 && !loading && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem 1rem', fontSize: '0.9rem' }}>
          No posts yet. Follow some users to see their posts here!
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={currentUser?.id || ''}
            isOwn={post.userId === currentUser?.id}
            showAuthorLink
            onReaction={(emoji, hasReacted) => handleReaction(post, emoji, hasReacted)}
            onFetchComments={() => handleFetchComments(post.id, post)}
            onAddComment={(body) => handleAddComment(post.id, body, post)}
            onDeleteComment={(commentId) => handleDeleteComment(post.id, commentId, post)}
            onCommentReaction={(commentId, emoji, hasReacted) => toggleCommentReaction(commentId, emoji, hasReacted)}
            onRepost={post.userId !== currentUser?.id ? () => {} : undefined}
            onShare={() => {}}
            onReport={post.userId !== currentUser?.id ? () => setReportPost(post) : undefined}
          />
        ))}
      </div>

      {reportPost && (
        <ReportModal
          reportedUserId={reportPost.userId}
          reportedUsername={reportPost.author?.username || ''}
          postId={reportPost.id}
          messagePreview={reportPost.body?.slice(0, 200) || undefined}
          contentLabel="Post"
          onClose={() => setReportPost(null)}
        />
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} style={{ height: 1 }} />

      {loading && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem', fontSize: '0.85rem' }}>
          Loading...
        </div>
      )}
    </div>
  );
}

/**
 * FeedPage — full-page wrapper with rail + profile sidebar on desktop.
 */
export function FeedPage() {
  const isMobile = useIsMobile();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { spaces, fetchSpaces } = useSpacesStore();
  const { channelSidebarOpen } = useLayoutStore();
  const { fetchUnreadCount } = useNotificationsStore();
  const { counts: followCounts, fetchCounts: fetchFollowCounts } = useFollowsStore();

  useEffect(() => {
    fetchSpaces();
    fetchUnreadCount();
    if (user?.id) fetchFollowCounts(user.id);
  }, []);

  if (isMobile) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 56, overflowY: 'auto', padding: '1rem', background: 'linear-gradient(to bottom, var(--bg-primary), color-mix(in srgb, var(--bg-primary), black 18%))' }}>
        <FeedView />
      </div>
    );
  }

  // Desktop: Rail | ProfileSidebar | FeedView
  return (
    <div style={styles.layout}>
      <div style={styles.sidebarWrap}>
        <SpaceSidebar spaces={spaces} activeSpaceId={null} />
      </div>
      <div style={{ ...styles.sidebarWrap, width: channelSidebarOpen ? 240 : 0 }}>
        <ProfileSidebar
          avatarUrl={user?.avatarUrl ?? null}
          displayName={user?.displayName || '?'}
          username={user?.username || ''}
          bio={user?.bio}
          baseColor={user?.baseColor}
          accentColor={user?.accentColor}
          followingCount={followCounts.followingCount}
          followerCount={followCounts.followerCount}
          onLogout={logout}
        />
      </div>
      <div style={styles.main}>
        <div style={{ width: '100%', maxWidth: 700 }}>
          <FeedView />
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  layout: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
  },
  sidebarWrap: {
    overflow: 'hidden',
    flexShrink: 0,
    transition: 'width 0.2s ease',
    height: '100%',
  },
  main: {
    flex: 1,
    overflowY: 'auto',
    padding: '2rem',
    display: 'flex',
    justifyContent: 'center',
  },
};
