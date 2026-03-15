import { useEffect, useRef, useCallback, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { useAuthStore } from '../stores/auth.js';
import { useSpacesStore } from '../stores/spaces.js';
import { useFeedStore } from '../stores/feed.js';
import { usePersonalCollectionsStore } from '../stores/personalCollections.js';
import { useNotificationsStore } from '../stores/notifications.js';
import { useFollowsStore } from '../stores/follows.js';
import { useIdentityStore } from '../stores/identity.js';
import { useLayoutStore } from '../stores/layout.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { SpaceSidebar } from '../components/layout/SpaceSidebar.js';
import { ProfileSidebar } from '../components/layout/ProfileSidebar.js';
import { PostCard } from '../components/posts/PostCard.js';
import { ReportModal } from '../components/moderation/ReportModal.js';
import { IdentitySwitcher } from '../components/common/IdentitySwitcher.js';
import { api } from '../lib/api.js';
import type { UserPost } from '@crabac/shared';

/**
 * FeedView — shared feed rendering component.
 */
export function FeedView() {
  const currentUser = useAuthStore((s) => s.user);
  const { posts, loading, hasMore, searchQuery, searchHashtag, fetchFeed, searchPosts, clearSearch } = useFeedStore();
  const { togglePostReaction, fetchComments, addComment, deleteComment, toggleCommentReaction } = usePersonalCollectionsStore();
  const activeSpaceId = useIdentityStore((s) => s.activeSpaceId);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [reportPost, setReportPost] = useState<UserPost | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const isSearching = !!(searchQuery || searchHashtag);

  // Handle URL search params changes
  useEffect(() => {
    const hashtag = searchParams.get('hashtag');
    const q = searchParams.get('q');
    if (hashtag || q) {
      if (hashtag) setSearchInput(`#${hashtag}`);
      else if (q) setSearchInput(q);
      searchPosts({ hashtag: hashtag || undefined, q: q || undefined });
    } else {
      setSearchInput('');
      clearSearch();
      fetchFeed();
    }
  }, [searchParams.toString()]); // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll
  const loadMore = useCallback(() => {
    if (loading || !hasMore || posts.length === 0) return;
    const lastId = posts[posts.length - 1].id;
    if (isSearching) {
      searchPosts({ q: searchQuery || undefined, hashtag: searchHashtag || undefined, before: lastId });
    } else {
      fetchFeed({ before: lastId });
    }
  }, [loading, hasMore, posts, fetchFeed, searchPosts, isSearching, searchQuery, searchHashtag]);

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const input = searchInput.trim();
    if (!input) return;

    // If input starts with #, treat as hashtag search
    if (input.startsWith('#') && input.length > 1) {
      const tag = input.slice(1);
      setSearchParams({ hashtag: tag });
      searchPosts({ hashtag: tag });
    } else {
      setSearchParams({ q: input });
      searchPosts({ q: input });
    }
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchParams({});
    clearSearch();
    fetchFeed();
  };

  const handleHashtagClick = (tag: string) => {
    setSearchInput(`#${tag}`);
    setSearchParams({ hashtag: tag });
    searchPosts({ hashtag: tag });
  };

  const handleReaction = async (post: UserPost, emoji: string, hasReacted: boolean) => {
    try {
      const method = hasReacted ? 'DELETE' : 'PUT';
      await api(`/users/${post.userId}/posts/${post.id}/reactions/${encodeURIComponent(emoji)}`, { method });
      // Refresh feed
      if (isSearching) {
        searchPosts({ q: searchQuery || undefined, hashtag: searchHashtag || undefined });
      } else {
        fetchFeed();
      }
    } catch {}
  };

  const handleFetchComments = async (postId: string, post: UserPost) => {
    return fetchComments(postId, { userId: post.userId });
  };

  const handleAddComment = async (postId: string, body: string, post: UserPost, parentCommentId?: string) => {
    return addComment(postId, body, post.userId, parentCommentId, activeSpaceId || undefined);
  };

  const handleDeleteComment = async (postId: string, commentId: string, post: UserPost) => {
    return deleteComment(postId, commentId, post.userId);
  };

  return (
    <div>
      {/* Search bar */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search posts or #hashtags..."
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              paddingLeft: '2rem',
              borderRadius: 'var(--radius)',
              border: 'none',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        </div>
        {isSearching && (
          <button
            type="button"
            onClick={handleClearSearch}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '0.4rem 0.7rem', borderRadius: 'var(--radius)',
              border: 'none', background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
              fontSize: '0.8rem', cursor: 'pointer',
            }}
          >
            <X size={14} /> Clear
          </button>
        )}
      </form>

      {/* Search indicator */}
      {isSearching && (
        <div style={{ marginBottom: 12, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {searchHashtag ? (
            <>Showing posts tagged <strong style={{ color: 'var(--accent)' }}>#{searchHashtag}</strong></>
          ) : (
            <>Search results for <strong style={{ color: 'var(--text-primary)' }}>{searchQuery}</strong></>
          )}
        </div>
      )}

      {posts.length === 0 && !loading && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem 1rem', fontSize: '0.9rem' }}>
          {isSearching ? 'No posts found.' : 'No posts yet. Follow some users to see their posts here!'}
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
            onAddComment={(body, parentCommentId) => handleAddComment(post.id, body, post, parentCommentId)}
            onDeleteComment={(commentId) => handleDeleteComment(post.id, commentId, post)}
            onCommentReaction={(commentId, emoji, hasReacted) => toggleCommentReaction(commentId, emoji, hasReacted)}
            onRepost={post.userId !== currentUser?.id ? () => {} : undefined}
            onShare={() => {}}
            onReport={post.userId !== currentUser?.id ? () => setReportPost(post) : undefined}
            onHashtagClick={handleHashtagClick}
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
  const [profileLinks, setProfileLinks] = useState<{ id: string; label: string; url: string; position: number }[]>([]);

  useEffect(() => {
    fetchSpaces();
    fetchUnreadCount();
    if (user?.id) fetchFollowCounts(user.id);
    api<{ id: string; label: string; url: string; position: number }[]>('/users/me/profile-links')
      .then(setProfileLinks).catch(() => {});
  }, []);

  if (isMobile) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 56, overflowY: 'auto', padding: '1rem', background: 'linear-gradient(to bottom, var(--bg-primary), color-mix(in srgb, var(--bg-primary), black 18%))' }}>
        <div style={{ marginBottom: 12 }}>
          <IdentitySwitcher />
        </div>
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
          profileLinks={profileLinks}
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
