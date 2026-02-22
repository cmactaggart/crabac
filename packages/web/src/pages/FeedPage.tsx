import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../stores/auth.js';
import { useFeedStore } from '../stores/feed.js';
import { usePersonalCollectionsStore } from '../stores/personalCollections.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { PostCard } from '../components/posts/PostCard.js';
import { api } from '../lib/api.js';
import type { UserPost } from '@crabac/shared';

/**
 * FeedView — shared feed rendering component used by both FeedPage (mobile)
 * and YouPage (desktop sidebar).
 */
export function FeedView() {
  const currentUser = useAuthStore((s) => s.user);
  const { posts, loading, hasMore, fetchFeed } = useFeedStore();
  const { togglePostReaction, fetchComments, addComment, deleteComment, toggleCommentReaction } = usePersonalCollectionsStore();
  const sentinelRef = useRef<HTMLDivElement>(null);

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
          />
        ))}
      </div>

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
 * FeedPage — full-page wrapper for mobile, with fixed positioning.
 */
export function FeedPage() {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 56, overflowY: 'auto', padding: '1rem' }}>
        <FeedView />
      </div>
    );
  }

  // Desktop: centered layout
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', height: '100vh', overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 700 }}>
        <FeedView />
      </div>
    </div>
  );
}
