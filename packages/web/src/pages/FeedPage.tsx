import { useEffect, useRef, useCallback, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, X, ImagePlus, MapPin, Users } from 'lucide-react';
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
import { FriendMentionAutocomplete } from '../components/common/FriendMentionAutocomplete.js';
import { FollowingTagPicker } from '../components/common/FollowingTagPicker.js';
import { api } from '../lib/api.js';
import type { UserPost, PersonalVisibility } from '@crabac/shared';

function ComposeArea({ onPostCreated }: { onPostCreated: () => void }) {
  const currentUser = useAuthStore((s) => s.user);
  const { createPost } = usePersonalCollectionsStore();
  const activeSpaceId = useIdentityStore((s) => s.activeSpaceId);
  const { following, fetchFollowing } = useFollowsStore();
  const defaultVisibility: PersonalVisibility = 'followers';

  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [visibility, setVisibility] = useState<PersonalVisibility>(defaultVisibility as PersonalVisibility);
  const [posting, setPosting] = useState(false);
  const [taggedIds, setTaggedIds] = useState<string[]>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const gpxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentUser?.id && following.length === 0) fetchFollowing(currentUser.id);
  }, [currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setBody(val);
    const cursorPos = e.target.selectionStart ?? val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_-]*)$/);
    setMentionQuery(match ? match[1] : null);
  };

  const handleMentionSelect = useCallback((name: string, id: string, type?: 'user' | 'space') => {
    const ta = textareaRef.current;
    if (!ta) return;
    const cursorPos = ta.selectionStart ?? body.length;
    const textBeforeCursor = body.slice(0, cursorPos);
    const matchIdx = textBeforeCursor.lastIndexOf('@');
    if (matchIdx === -1) return;

    if (type === 'space') {
      const insertion = `[${name}](/space/${id}) `;
      const newBody = body.slice(0, matchIdx) + insertion + body.slice(cursorPos);
      setBody(newBody);
      setMentionQuery(null);
      requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(matchIdx + insertion.length, matchIdx + insertion.length); });
    } else {
      const newBody = body.slice(0, matchIdx) + `@${name} ` + body.slice(cursorPos);
      setBody(newBody);
      setMentionQuery(null);
      if (!taggedIds.includes(id)) setTaggedIds((prev) => [...prev, id]);
      requestAnimationFrame(() => { const p = matchIdx + name.length + 2; ta.focus(); ta.setSelectionRange(p, p); });
    }
  }, [body, taggedIds]);

  const handlePost = async () => {
    if (!body.trim() && files.length === 0) return;
    setPosting(true);
    try {
      const allTaggedIds = [...taggedIds];
      for (const m of body.matchAll(/@([a-zA-Z0-9_-]+)/g)) {
        const followedUser = following.find((f: any) => f.username?.toLowerCase() === m[1].toLowerCase());
        if (followedUser && !allTaggedIds.includes(followedUser.id)) allTaggedIds.push(followedUser.id);
      }
      const formData = new FormData();
      if (body.trim()) formData.append('body', body.trim());
      formData.append('visibility', activeSpaceId ? 'public' : visibility);
      files.forEach((f) => formData.append('files', f));
      if (allTaggedIds.length > 0) formData.append('taggedUserIds', JSON.stringify(allTaggedIds));
      if (activeSpaceId) formData.append('spaceId', activeSpaceId);
      await createPost(formData);
      setBody(''); setFiles([]); setTaggedIds([]); setVisibility(defaultVisibility as PersonalVisibility);
      onPostCreated();
    } catch {}
    setPosting(false);
  };

  return (
    <div style={composeStyles.container}>
      <div style={{ position: 'relative' }}>
        {mentionQuery !== null && (
          <FriendMentionAutocomplete query={mentionQuery} onSelect={handleMentionSelect} onClose={() => setMentionQuery(null)} />
        )}
        <textarea
          ref={textareaRef}
          value={body}
          onChange={handleBodyChange}
          placeholder={activeSpaceId ? 'Post as your space...' : "What's on your mind?"}
          style={composeStyles.textarea}
          maxLength={10000}
        />
      </div>

      {files.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {files.map((f, i) => (
            <div key={i} style={composeStyles.fileBadge}>
              <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {taggedIds.length > 0 && (
        <div style={{ fontSize: '0.72rem', color: 'var(--accent)' }}>
          <Users size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
          {taggedIds.length} friend{taggedIds.length > 1 ? 's' : ''} tagged
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={() => fileRef.current?.click()} style={composeStyles.actionBtn} title="Add media">
          <ImagePlus size={13} /> Media
        </button>
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple onChange={(e) => { if (e.target.files) setFiles((p) => [...p, ...Array.from(e.target.files!)]); if (fileRef.current) fileRef.current.value = ''; }} style={{ display: 'none' }} />

        <button onClick={() => gpxRef.current?.click()} style={composeStyles.actionBtn} title="Add GPX">
          <MapPin size={13} /> GPX
        </button>
        <input ref={gpxRef} type="file" accept=".gpx" multiple onChange={(e) => { if (e.target.files) setFiles((p) => [...p, ...Array.from(e.target.files!)]); if (gpxRef.current) gpxRef.current.value = ''; }} style={{ display: 'none' }} />

        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowTagPicker(!showTagPicker)} style={composeStyles.actionBtn} title="Tag friends">
            <Users size={13} /> Tag
          </button>
          {showTagPicker && (
            <FollowingTagPicker selectedIds={taggedIds} onChange={setTaggedIds} onClose={() => setShowTagPicker(false)} />
          )}
        </div>

        <select value={visibility} onChange={(e) => setVisibility(e.target.value as PersonalVisibility)} style={composeStyles.visSelect}>
          <option value="private">Private</option>
          <option value="followers">Followers</option>
          <option value="spaces">Shared Spaces</option>
          <option value="public">Public</option>
        </select>

        <button onClick={handlePost} disabled={posting || (!body.trim() && files.length === 0)} style={{ ...composeStyles.postBtn, opacity: posting || (!body.trim() && files.length === 0) ? 0.5 : 1 }}>
          {posting ? 'Posting...' : 'Post'}
        </button>
      </div>
    </div>
  );
}

const composeStyles: Record<string, React.CSSProperties> = {
  container: {
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    padding: '12px 14px',
    marginBottom: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    border: '1px solid var(--border)',
  },
  textarea: {
    width: '100%',
    minHeight: 50,
    resize: 'vertical',
    padding: '0.5rem 0.7rem',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: '0.88rem',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  },
  fileBadge: {
    position: 'relative',
    padding: '3px 8px',
    background: 'var(--bg-tertiary)',
    borderRadius: 'var(--radius)',
    fontSize: '0.72rem',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 8px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  visSelect: {
    padding: '3px 6px',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: '0.72rem',
    outline: 'none',
  },
  postBtn: {
    marginLeft: 'auto',
    padding: '5px 14px',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--accent)',
    color: 'white',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
};

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

  const refreshFeed = () => {
    clearSearch();
    fetchFeed();
  };

  return (
    <div>
      {/* Compose area */}
      <ComposeArea onPostCreated={refreshFeed} />

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
