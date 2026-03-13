import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Image, Map, CalendarDays, Upload, Plus, Trash2, Share2, Edit3, MapPinned, X, FileText, Users, ImagePlus, MapPin, SmilePlus, Newspaper, LogOut, Activity, Bike, Footprints, Mountain, Timer, TrendingUp, Save } from 'lucide-react';
import { useAuthStore } from '../stores/auth.js';
import { useSpacesStore } from '../stores/spaces.js';
import { usePersonalCollectionsStore } from '../stores/personalCollections.js';
import { useNotificationsStore } from '../stores/notifications.js';
import { useFriendsStore } from '../stores/friends.js';
import { useLayoutStore } from '../stores/layout.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { Avatar } from '../components/common/Avatar.js';
import { FollowListModal } from '../components/common/FollowListModal.js';
import { UserSettingsModal } from '../components/settings/user/UserSettingsModal.js';
import { ShareToSpacePicker } from '../components/common/ShareToSpacePicker.js';
import { FriendTagPicker } from '../components/common/FriendTagPicker.js';
import { FriendMentionAutocomplete } from '../components/common/FriendMentionAutocomplete.js';
import { PostCard as SharedPostCard, VisibilityBadge } from '../components/posts/PostCard.js';
import { useFollowsStore } from '../stores/follows.js';
import { useIdentityStore } from '../stores/identity.js';
import { SpaceSidebar } from '../components/layout/SpaceSidebar.js';
import { ProfileSidebar } from '../components/layout/ProfileSidebar.js';
import { PersonalNewsletterView } from '../components/newsletter/PersonalNewsletterView.js';
import { IdentitySwitcher } from '../components/common/IdentitySwitcher.js';
import { api } from '../lib/api.js';
import type { PersonalGalleryItem, PersonalRouteItem, PersonalEvent, PersonalEventCategory, PersonalActivityItem, PersonalActivityStats, PersonalVisibility, UserPost, ActivityType } from '@crabac/shared';

type SubTab = 'feed' | 'photos' | 'activities' | 'events' | 'newsletter';
type ActivitiesSubTab = 'stats' | 'activities' | 'routes';

const VISIBILITY_LABELS: Record<PersonalVisibility, string> = {
  public: 'Public',
  private: 'Private',
  friends: 'Friends',
  spaces: 'Spaces',
};

const VISIBILITY_COLORS: Record<PersonalVisibility, string> = {
  public: '#43b581',
  private: '#747f8d',
  friends: '#faa61a',
  spaces: '#5865f2',
};

export function YouPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightPostId = searchParams.get('post');
  const highlightCommentId = searchParams.get('comment');
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<SubTab>('feed');
  const [showSettings, setShowSettings] = useState(false);
  const [shareItem, setShareItem] = useState<{ type: 'gallery' | 'route' | 'event' | 'post'; id: string } | null>(null);
  const [defaultVisibility, setDefaultVisibility] = useState<PersonalVisibility>('private');
  const [newsletterEnabled, setNewsletterEnabled] = useState(false);

  const {
    galleryItems, routeItems, events, eventCategories, activityItems, activityStats, posts, postsLoading, postsHasMore, summary, loading,
    fetchSummary, fetchGallery, fetchRoutes, fetchEvents, fetchEventCategories, fetchPosts, fetchActivities, fetchActivityStats,
    uploadGalleryItem, uploadRoute, uploadActivity, createEvent, createEventCategory, deleteEventCategory, createPost,
    deleteGalleryItem, deleteRoute, deleteActivity, deleteEvent, deletePost,
    updateGalleryItem, updateRoute, updateActivity, updateEvent, updatePost,
    saveActivityAsRoute,
    togglePostReaction, fetchComments, addComment, deleteComment, toggleCommentReaction,
    createRepost,
  } = usePersonalCollectionsStore();

  const { fetchUnreadCount } = useNotificationsStore();
  const { spaces, fetchSpaces } = useSpacesStore();
  const { channelSidebarOpen } = useLayoutStore();
  const { counts: followCounts, fetchCounts: fetchFollowCounts, followers, following, fetchFollowers, fetchFollowing } = useFollowsStore();
  const [followListMode, setFollowListMode] = useState<'followers' | 'following' | null>(null);
  const activeSpaceId = useIdentityStore((s) => s.activeSpaceId);
  const managedSpaces = useIdentityStore((s) => s.managedSpaces);
  const activeSpace = managedSpaces.find((s) => s.id === activeSpaceId) || null;
  const [spacePosts, setSpacePosts] = useState<UserPost[]>([]);
  const [spacePostsLoading, setSpacePostsLoading] = useState(false);

  useEffect(() => {
    fetchSummary();
    fetchUnreadCount();
    fetchSpaces();
    if (user?.id) fetchFollowCounts(user.id);
    api('/users/preferences').then((prefs: any) => {
      if (prefs.defaultVisibility) setDefaultVisibility(prefs.defaultVisibility);
      if (prefs.newsletterEnabled) setNewsletterEnabled(true);
    }).catch(() => {});
  }, []);

  // Fetch space posts when identity is switched
  useEffect(() => {
    if (activeSpaceId) {
      setSpacePostsLoading(true);
      api<UserPost[]>(`/follows/spaces/${activeSpaceId}/posts`)
        .then(setSpacePosts)
        .catch(() => setSpacePosts([]))
        .finally(() => setSpacePostsLoading(false));
      setActiveTab('feed');
    } else {
      setSpacePosts([]);
    }
  }, [activeSpaceId]);

  useEffect(() => {
    if (activeSpaceId) return; // Skip personal fetches when viewing space
    if (activeTab === 'feed') fetchPosts();
    if (activeTab === 'photos') fetchGallery();
    if (activeTab === 'activities') { fetchActivities(); fetchActivityStats(); fetchRoutes(); }
    if (activeTab === 'events') { fetchEvents(); fetchEventCategories(); }
  }, [activeTab, activeSpaceId]);

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString([], { year: 'numeric', month: 'long' })
    : '';

  if (isMobile) {
    // Mobile: no sidebar, profile card at top, BottomTabBar handles navigation
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 56, overflowY: 'auto', padding: '1rem', background: 'linear-gradient(to bottom, var(--bg-primary), color-mix(in srgb, var(--bg-primary), black 18%))' }}>
        {/* Compact Profile Card — show space or user */}
        {activeSpace ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)' }}>
            <Avatar
              src={activeSpace.iconUrl}
              name={activeSpace.name}
              size={48}
              baseColor={activeSpace.baseColor ?? null}
              accentColor={activeSpace.accentColor ?? null}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{activeSpace.name}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>@{activeSpace.slug}</div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)' }}>
            <Avatar
              src={user?.avatarUrl ?? null}
              name={user?.displayName || '?'}
              size={48}
              baseColor={user?.baseColor ?? null}
              accentColor={user?.accentColor ?? null}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{user?.displayName}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>@{user?.username}</div>
              {user?.bio && (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.3 }}>
                  {user.bio}
                </div>
              )}
              {memberSince && (
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  Member since {memberSince}
                </div>
              )}
            </div>
            <button onClick={() => setShowSettings(true)} style={{ ...styles.editBtn, fontSize: '0.72rem', padding: '0.3rem 0.6rem' }}>
              <Edit3 size={12} /> Edit
            </button>
            <button onClick={logout} style={{ ...styles.editBtn, fontSize: '0.72rem', padding: '0.3rem 0.6rem', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
              <LogOut size={12} />
            </button>
          </div>
        )}

        <IdentitySwitcher />

        <div style={{ maxWidth: '100%' }}>
          {/* When viewing as a space, only show feed */}
          {activeSpace ? (
            <div style={{ marginTop: '1rem', paddingBottom: '2rem' }}>
              <FeedTab
                posts={spacePosts}
                loading={spacePostsLoading}
                hasMore={false}
                onCreatePost={async (formData) => {
                  await createPost(formData);
                  // Refresh space posts
                  api<UserPost[]>(`/follows/spaces/${activeSpaceId}/posts`).then(setSpacePosts).catch(() => {});
                }}
                onDeletePost={async (postId) => {
                  await api(`/users/me/posts/${postId}`, { method: 'DELETE' });
                  setSpacePosts((prev) => prev.filter((p) => p.id !== postId));
                }}
                onUpdatePost={updatePost}
                onLoadMore={() => {}}
                highlightPostId={highlightPostId}
                highlightCommentId={highlightCommentId}
              />
            </div>
          ) : (
            <>
              {/* Collection Counts */}
              {summary && (
                <div style={styles.summaryRow}>
                  <SummaryBadge icon={<FileText size={14} />} label="Feed" count={summary.postCount} active={activeTab === 'feed'} onClick={() => setActiveTab('feed')} />
                  <SummaryBadge icon={<Image size={14} />} label="Photos" count={summary.galleryCount} active={activeTab === 'photos'} onClick={() => setActiveTab('photos')} />
                  <SummaryBadge icon={<Activity size={14} />} label="Active" count={summary.activityCount} active={activeTab === 'activities'} onClick={() => setActiveTab('activities')} />
                  <SummaryBadge icon={<CalendarDays size={14} />} label="Events" count={summary.eventCount} active={activeTab === 'events'} onClick={() => setActiveTab('events')} />
                  {newsletterEnabled && <SummaryBadge icon={<Newspaper size={14} />} label="Newsletter" count={0} active={activeTab === 'newsletter'} onClick={() => setActiveTab('newsletter')} />}
                </div>
              )}

              {/* Sub-tab Content */}
              <div style={{ marginTop: '1rem', paddingBottom: '2rem' }}>
                {activeTab === 'feed' && (
                  <FeedTab
                    posts={posts}
                    loading={postsLoading}
                    hasMore={postsHasMore}
                    onCreatePost={createPost}
                    onDeletePost={deletePost}
                    onUpdatePost={updatePost}
                    onLoadMore={() => {
                      if (posts.length > 0) fetchPosts({ before: posts[posts.length - 1].id });
                    }}
                    highlightPostId={highlightPostId}
                    highlightCommentId={highlightCommentId}
                  />
                )}
                {activeTab === 'photos' && (
                  <PhotosTab
                    items={galleryItems}
                    loading={loading}
                    onUpload={uploadGalleryItem}
                    onDelete={deleteGalleryItem}
                    onUpdate={updateGalleryItem}
                    onShare={(id) => setShareItem({ type: 'gallery', id })}
                  />
                )}
                {activeTab === 'activities' && (
                  <ActivitiesTabContainer
                    activityItems={activityItems}
                    activityStats={activityStats}
                    routeItems={routeItems}
                    loading={loading}
                    onUploadRoute={uploadRoute}
                    onDeleteRoute={deleteRoute}
                    onUpdateRoute={updateRoute}
                    onShareRoute={(id) => setShareItem({ type: 'route', id })}
                    onUpdateActivity={updateActivity}
                    onDeleteActivity={deleteActivity}
                    onSaveAsRoute={saveActivityAsRoute}
                    onFetchActivityStats={fetchActivityStats}
                  />
                )}
                {activeTab === 'events' && (
                  <EventsTab
                    items={events}
                    loading={loading}
                    categories={eventCategories}
                    routes={routeItems}
                    onCreate={createEvent}
                    onDelete={deleteEvent}
                    onUpdate={updateEvent}
                    onShare={(id) => setShareItem({ type: 'event', id })}
                    onCreateCategory={createEventCategory}
                    onDeleteCategory={deleteEventCategory}
                    onFetchRoutes={fetchRoutes}
                  />
                )}
                {activeTab === 'newsletter' && <PersonalNewsletterView />}
              </div>
            </>
          )}
        </div>

        {showSettings && <UserSettingsModal onClose={() => setShowSettings(false)} />}
        {shareItem && (
          <ShareToSpacePicker
            contentType={shareItem.type}
            itemId={shareItem.id}
            onClose={() => setShareItem(null)}
            onShared={() => setShareItem(null)}
          />
        )}
      </div>
    );
  }

  // Desktop layout: Rail | ProfileSidebar | Main content
  return (
    <div style={styles.outerContainer}>
      <div style={styles.sidebarWrap}>
        <SpaceSidebar spaces={spaces} activeSpaceId={null} />
      </div>
      <div style={{ ...styles.sidebarWrap, width: channelSidebarOpen ? 240 : 0 }}>
        {activeSpace ? (
          <ProfileSidebar
            avatarUrl={activeSpace.iconUrl}
            displayName={activeSpace.name}
            username={activeSpace.slug}
            baseColor={activeSpace.baseColor}
            accentColor={activeSpace.accentColor}
            followingCount={0}
            followerCount={0}
          />
        ) : (
          <ProfileSidebar
            avatarUrl={user?.avatarUrl ?? null}
            displayName={user?.displayName || '?'}
            username={user?.username || ''}
            bio={user?.bio}
            baseColor={user?.baseColor}
            accentColor={user?.accentColor}
            followingCount={followCounts.followingCount}
            followerCount={followCounts.followerCount}
            onFollowingClick={() => { if (user?.id) { fetchFollowing(user.id); setFollowListMode('following'); } }}
            onFollowersClick={() => { if (user?.id) { fetchFollowers(user.id); setFollowListMode('followers'); } }}
            onLogout={logout}
          />
        )}
      </div>

      {/* Main Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '2rem',
        display: 'flex',
        justifyContent: 'center',
      }}>
        <div style={{ ...styles.card, maxWidth: 700 }}>
          {/* Profile Card */}
          {activeSpace ? (
            <div style={styles.profileSection}>
              <Avatar
                src={activeSpace.iconUrl}
                name={activeSpace.name}
                size={80}
                baseColor={activeSpace.baseColor ?? null}
                accentColor={activeSpace.accentColor ?? null}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ margin: 0, fontSize: '1.3rem' }}>{activeSpace.name}</h2>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>@{activeSpace.slug}</div>
              </div>
            </div>
          ) : (
            <div style={styles.profileSection}>
              <Avatar
                src={user?.avatarUrl ?? null}
                name={user?.displayName || '?'}
                size={80}
                baseColor={user?.baseColor ?? null}
                accentColor={user?.accentColor ?? null}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ margin: 0, fontSize: '1.3rem' }}>{user?.displayName}</h2>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>@{user?.username}</div>
                {memberSince && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    Member since {memberSince}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSpace ? (
            // Space view: only feed with composer
            <div style={{ marginTop: '1rem' }}>
              <FeedTab
                posts={spacePosts}
                loading={spacePostsLoading}
                hasMore={false}
                defaultVisibility={defaultVisibility}
                onCreatePost={async (formData) => {
                  await createPost(formData);
                  // Refresh space posts
                  api<UserPost[]>(`/follows/spaces/${activeSpaceId}/posts`).then(setSpacePosts).catch(() => {});
                }}
                onDeletePost={async (postId) => {
                  await api(`/users/me/posts/${postId}`, { method: 'DELETE' });
                  setSpacePosts((prev) => prev.filter((p) => p.id !== postId));
                }}
                onUpdatePost={updatePost}
                onLoadMore={() => {}}
                highlightPostId={highlightPostId}
                highlightCommentId={highlightCommentId}
              />
            </div>
          ) : (
            <>
              {/* Collection Counts */}
              {summary && (
                <div style={styles.summaryRow}>
                  <SummaryBadge icon={<FileText size={14} />} label="Feed" count={summary.postCount} active={activeTab === 'feed'} onClick={() => setActiveTab('feed')} />
                  <SummaryBadge icon={<Image size={14} />} label="Photos" count={summary.galleryCount} active={activeTab === 'photos'} onClick={() => setActiveTab('photos')} />
                  <SummaryBadge icon={<Activity size={14} />} label="Active" count={summary.activityCount} active={activeTab === 'activities'} onClick={() => setActiveTab('activities')} />
                  <SummaryBadge icon={<CalendarDays size={14} />} label="Events" count={summary.eventCount} active={activeTab === 'events'} onClick={() => setActiveTab('events')} />
                  {newsletterEnabled && <SummaryBadge icon={<Newspaper size={14} />} label="Newsletter" count={0} active={activeTab === 'newsletter'} onClick={() => setActiveTab('newsletter')} />}
                </div>
              )}

              {/* Sub-tab Content */}
              <div style={{ marginTop: '1rem' }}>
                {activeTab === 'feed' && (
                  <FeedTab
                    posts={posts}
                    loading={postsLoading}
                    hasMore={postsHasMore}
                    defaultVisibility={defaultVisibility}
                    onCreatePost={createPost}
                    onDeletePost={deletePost}
                    onUpdatePost={updatePost}
                    onLoadMore={() => {
                      if (posts.length > 0) fetchPosts({ before: posts[posts.length - 1].id });
                    }}
                    highlightPostId={highlightPostId}
                    highlightCommentId={highlightCommentId}
                  />
                )}
                {activeTab === 'photos' && (
                  <PhotosTab
                    items={galleryItems}
                    loading={loading}
                    defaultVisibility={defaultVisibility}
                    onUpload={uploadGalleryItem}
                    onDelete={deleteGalleryItem}
                    onUpdate={updateGalleryItem}
                    onShare={(id) => setShareItem({ type: 'gallery', id })}
                  />
                )}
                {activeTab === 'activities' && (
                  <ActivitiesTabContainer
                    activityItems={activityItems}
                    activityStats={activityStats}
                    routeItems={routeItems}
                    loading={loading}
                    defaultVisibility={defaultVisibility}
                    onUploadRoute={uploadRoute}
                    onDeleteRoute={deleteRoute}
                    onUpdateRoute={updateRoute}
                    onShareRoute={(id) => setShareItem({ type: 'route', id })}
                    onUpdateActivity={updateActivity}
                    onDeleteActivity={deleteActivity}
                    onSaveAsRoute={saveActivityAsRoute}
                    onFetchActivityStats={fetchActivityStats}
                  />
                )}
                {activeTab === 'events' && (
                  <EventsTab
                    items={events}
                    loading={loading}
                    categories={eventCategories}
                    routes={routeItems}
                    defaultVisibility={defaultVisibility}
                    onCreate={createEvent}
                    onDelete={deleteEvent}
                    onUpdate={updateEvent}
                    onShare={(id) => setShareItem({ type: 'event', id })}
                    onCreateCategory={createEventCategory}
                    onDeleteCategory={deleteEventCategory}
                    onFetchRoutes={fetchRoutes}
                  />
                )}
                {activeTab === 'newsletter' && <PersonalNewsletterView />}
              </div>
            </>
          )}
        </div>
      </div>

      {showSettings && <UserSettingsModal onClose={() => setShowSettings(false)} />}
      {shareItem && (
        <ShareToSpacePicker
          contentType={shareItem.type}
          itemId={shareItem.id}
          onClose={() => setShareItem(null)}
          onShared={() => setShareItem(null)}
        />
      )}
      {followListMode && (
        <FollowListModal
          mode={followListMode}
          users={followListMode === 'followers' ? followers : following}
          onClose={() => setFollowListMode(null)}
        />
      )}
    </div>
  );
}

function SummaryBadge({ icon, label, count, active, onClick }: {
  icon: React.ReactNode; label: string; count: number; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      ...styles.summaryBadge,
      background: active ? 'var(--accent)' : 'var(--bg-input)',
      color: active ? 'white' : 'var(--text-secondary)',
    }}>
      {icon}
      <span style={{ fontWeight: 600 }}>{count}</span>
      <span style={{ fontSize: '0.75rem' }}>{label}</span>
    </button>
  );
}

// VisibilityBadge imported from components/posts/PostCard.tsx

// ─── Photos Tab ───

function PhotosTab({ items, loading, defaultVisibility = 'private', onUpload, onDelete, onUpdate, onShare }: {
  items: PersonalGalleryItem[]; loading: boolean;
  defaultVisibility?: PersonalVisibility;
  onUpload: (files: File[], caption?: string, visibility?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpdate: (id: string, data: Record<string, any>) => Promise<void>;
  onShare: (id: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [visibility, setVisibility] = useState<PersonalVisibility>(defaultVisibility);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      await onUpload(Array.from(files), undefined, visibility);
    } catch {}
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div>
      <div style={styles.tabHeader}>
        <h3 style={styles.tabTitle}>My Photos</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select value={visibility} onChange={(e) => setVisibility(e.target.value as PersonalVisibility)} style={{ ...styles.formInput, width: 'auto', padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}>
            <option value="private">Private</option>
            <option value="friends">Friends</option>
            <option value="spaces">Shared Spaces</option>
            <option value="public">Public</option>
          </select>
          <button onClick={() => fileRef.current?.click()} disabled={uploading} style={styles.uploadBtn}>
            <Upload size={14} /> {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple onChange={handleUpload} style={{ display: 'none' }} />
      </div>

      {items.length === 0 && !loading && (
        <div style={styles.emptyState}>No photos yet. Upload some to get started!</div>
      )}

      <div style={styles.photoGrid}>
        {items.map((item) => (
          <div key={item.id} style={styles.photoCard}>
            {item.attachments[0] && (
              item.attachments[0].mimeType.startsWith('video/') ? (
                <video src={item.attachments[0].url} style={styles.photoImg} />
              ) : (
                <img src={item.attachments[0].url} alt={item.caption || ''} style={styles.photoImg} />
              )
            )}
            <div style={styles.photoOverlay}>
              <VisibilityBadge visibility={item.visibility} />
              <div style={styles.photoActions}>
                <button onClick={() => onShare(item.id)} style={styles.iconBtn} title="Share to Space">
                  <Share2 size={14} />
                </button>
                <button onClick={() => {
                  if (confirm('Delete this photo?')) onDelete(item.id);
                }} style={{ ...styles.iconBtn, color: 'var(--danger)' }} title="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            {item.caption && <div style={styles.photoCaption}>{item.caption}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Activities Tab Container (Stats / Activities / Routes sub-tabs) ───

const ACTIVITY_TYPE_LABELS: Record<string, string> = { run: 'Running', bike: 'Cycling', walk: 'Walking', hike: 'Hiking' };
const ACTIVITY_TYPE_ICONS: Record<string, React.ReactNode> = {
  run: <Footprints size={16} />,
  bike: <Bike size={16} />,
  walk: <Footprints size={16} />,
  hike: <Mountain size={16} />,
};
const STATS_PERIOD_LABELS: Record<string, string> = {
  ytd: 'Year to Date',
  year: 'This Year',
  previous_year: 'Previous Year',
  month: 'This Month',
  week: 'This Week',
  all: 'All Time',
};

function ActivitiesTabContainer({
  activityItems, activityStats, routeItems, loading,
  defaultVisibility = 'private',
  onUploadRoute, onDeleteRoute, onUpdateRoute, onShareRoute,
  onUpdateActivity, onDeleteActivity, onSaveAsRoute, onFetchActivityStats,
}: {
  activityItems: PersonalActivityItem[];
  activityStats: PersonalActivityStats | null;
  routeItems: PersonalRouteItem[];
  loading: boolean;
  defaultVisibility?: PersonalVisibility;
  onUploadRoute: (file: File, name: string, data?: any) => Promise<void>;
  onDeleteRoute: (id: string) => Promise<void>;
  onUpdateRoute: (id: string, data: Record<string, any>) => Promise<void>;
  onShareRoute: (id: string) => void;
  onUpdateActivity: (id: string, data: Record<string, any>) => Promise<void>;
  onDeleteActivity: (id: string) => Promise<void>;
  onSaveAsRoute: (id: string) => Promise<any>;
  onFetchActivityStats: (opts?: { period?: string; year?: number }) => Promise<void>;
}) {
  const [subTab, setSubTab] = useState<ActivitiesSubTab>('stats');
  const [statsPeriod, setStatsPeriod] = useState('ytd');

  return (
    <div>
      {/* Sub-tab navigation */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', padding: 4 }}>
        {(['stats', 'activities', 'routes'] as ActivitiesSubTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 'calc(var(--radius) - 2px)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 600,
              background: subTab === tab ? 'var(--accent)' : 'transparent',
              color: subTab === tab ? 'white' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            {tab === 'stats' ? 'Stats' : tab === 'activities' ? 'Activities' : 'Routes'}
          </button>
        ))}
      </div>

      {subTab === 'stats' && (
        <ActivityStatsView
          stats={activityStats}
          period={statsPeriod}
          onPeriodChange={(p) => {
            setStatsPeriod(p);
            onFetchActivityStats({ period: p });
          }}
        />
      )}
      {subTab === 'activities' && (
        <ActivityFeedView
          items={activityItems}
          loading={loading}
          onUpdate={onUpdateActivity}
          onDelete={onDeleteActivity}
          onSaveAsRoute={onSaveAsRoute}
        />
      )}
      {subTab === 'routes' && (
        <RoutesTab
          items={routeItems}
          loading={loading}
          defaultVisibility={defaultVisibility}
          onUpload={onUploadRoute}
          onDelete={onDeleteRoute}
          onUpdate={onUpdateRoute}
          onShare={onShareRoute}
        />
      )}
    </div>
  );
}

// ─── Activity Stats View ───

function ActivityStatsView({ stats, period, onPeriodChange }: {
  stats: PersonalActivityStats | null;
  period: string;
  onPeriodChange: (period: string) => void;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={styles.tabTitle}>Activity Stats</h3>
        <select
          value={period}
          onChange={(e) => onPeriodChange(e.target.value)}
          style={{ ...styles.formInput, width: 'auto', padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
        >
          {Object.entries(STATS_PERIOD_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {!stats || stats.stats.length === 0 ? (
        <div style={styles.emptyState}>No activity data for this period</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
          {stats.stats.map((s) => (
            <div key={s.activityType} style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                {ACTIVITY_TYPE_ICONS[s.activityType]}
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                  {ACTIVITY_TYPE_LABELS[s.activityType] || s.activityType}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Distance</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{s.totalDistanceKm.toFixed(1)} km</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Time</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{formatDuration(s.totalDurationSec)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Elevation</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{Math.round(s.totalElevationGainM)}m</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Activities</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{s.activityCount}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDuration(totalSec: number): string {
  if (!totalSec) return '0m';
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// ─── Activity Feed View ───

function ActivityFeedView({ items, loading, onUpdate, onDelete, onSaveAsRoute }: {
  items: PersonalActivityItem[];
  loading: boolean;
  onUpdate: (id: string, data: Record<string, any>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSaveAsRoute: (id: string) => Promise<any>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editVisibility, setEditVisibility] = useState<PersonalVisibility>('private');
  const [savingRoute, setSavingRoute] = useState<string | null>(null);

  const startEdit = (item: PersonalActivityItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditDescription(item.description || '');
    setEditVisibility(item.visibility);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    await onUpdate(editingId, {
      name: editName.trim(),
      description: editDescription.trim() || null,
      visibility: editVisibility,
    });
    setEditingId(null);
  };

  const handleSaveAsRoute = async (id: string) => {
    setSavingRoute(id);
    try {
      await onSaveAsRoute(id);
      alert('Activity saved as route!');
    } catch {
      alert('Failed to save as route');
    }
    setSavingRoute(null);
  };

  if (items.length === 0 && !loading) {
    return <div style={styles.emptyState}>No activities yet. Record an activity in the mobile app to get started!</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item) => (
        <div key={item.id} style={{ ...styles.routeCard, flexDirection: 'column', alignItems: 'stretch' }}>
          {editingId === item.id ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} style={styles.formInput} placeholder="Activity name" />
              <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} style={{ ...styles.formInput, minHeight: 40, resize: 'vertical', fontFamily: 'inherit' }} placeholder="Description (optional)" />
              <select value={editVisibility} onChange={(e) => setEditVisibility(e.target.value as PersonalVisibility)} style={styles.formInput}>
                <option value="private">Private</option>
                <option value="friends">Friends</option>
                <option value="spaces">Shared Spaces</option>
                <option value="public">Public</option>
              </select>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={saveEdit} style={styles.uploadBtn}>Save</button>
                <button onClick={() => setEditingId(null)} style={styles.cancelBtn}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--accent)', flexShrink: 0 }}>
                  {ACTIVITY_TYPE_ICONS[item.activityType] || <Activity size={16} />}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600 }}>{item.name}</span>
                    <VisibilityBadge visibility={item.visibility} />
                    <span style={styles.activityBadge}>{ACTIVITY_TYPE_LABELS[item.activityType] || item.activityType}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {item.distanceKm != null && <span>{item.distanceKm.toFixed(1)} km</span>}
                    {item.durationSec != null && <span>{formatDuration(item.durationSec)}</span>}
                    {item.elevationGainM != null && <span>{Math.round(item.elevationGainM)}m gain</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => startEdit(item)} style={styles.iconBtn} title="Edit">
                    <Edit3 size={13} />
                  </button>
                  <button onClick={() => handleSaveAsRoute(item.id)} disabled={savingRoute === item.id} style={styles.iconBtn} title="Save as Route">
                    <Save size={13} />
                  </button>
                  <button onClick={() => { if (confirm('Delete this activity?')) onDelete(item.id); }} style={{ ...styles.iconBtn, color: 'var(--danger)' }} title="Delete">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              {item.description && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 6, paddingLeft: 24 }}>
                  {item.description}
                </div>
              )}
              {item.startedAt && (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2, paddingLeft: 24 }}>
                  {new Date(item.startedAt).toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                  {' '}
                  {new Date(item.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Routes Tab ───

function RoutesTab({ items, loading, defaultVisibility = 'private', onUpload, onDelete, onUpdate, onShare }: {
  items: PersonalRouteItem[]; loading: boolean;
  defaultVisibility?: PersonalVisibility;
  onUpload: (file: File, name: string, data?: any) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpdate: (id: string, data: Record<string, any>) => Promise<void>;
  onShare: (id: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [visibility, setVisibility] = useState<PersonalVisibility>(defaultVisibility);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setRouteName(file.name.replace(/\.gpx$/i, ''));
    setShowForm(true);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleUpload = async () => {
    if (!selectedFile || !routeName.trim()) return;
    setUploading(true);
    try {
      await onUpload(selectedFile, routeName.trim(), { visibility });
      setShowForm(false);
      setSelectedFile(null);
      setRouteName('');
      setVisibility(defaultVisibility);
    } catch {}
    setUploading(false);
  };

  return (
    <div>
      <div style={styles.tabHeader}>
        <h3 style={styles.tabTitle}>My Routes</h3>
        <button onClick={() => fileRef.current?.click()} style={styles.uploadBtn}>
          <Upload size={14} /> Upload GPX
        </button>
        <input ref={fileRef} type="file" accept=".gpx" onChange={handleFileSelect} style={{ display: 'none' }} />
      </div>

      {showForm && (
        <div style={styles.inlineForm}>
          <input
            value={routeName}
            onChange={(e) => setRouteName(e.target.value)}
            placeholder="Route name"
            style={styles.formInput}
          />
          <label style={styles.formLabel}>Visibility</label>
          <select value={visibility} onChange={(e) => setVisibility(e.target.value as PersonalVisibility)} style={styles.formInput}>
            <option value="private">Private</option>
            <option value="friends">Friends</option>
            <option value="spaces">Shared Spaces</option>
            <option value="public">Public</option>
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleUpload} disabled={uploading || !routeName.trim()} style={styles.uploadBtn}>
              {uploading ? 'Uploading...' : 'Save'}
            </button>
            <button onClick={() => { setShowForm(false); setSelectedFile(null); setVisibility(defaultVisibility); }} style={styles.cancelBtn}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {items.length === 0 && !loading && !showForm && (
        <div style={styles.emptyState}>No routes yet. Upload a GPX file to get started!</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item) => (
          <div key={item.id} style={styles.routeCard}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600 }}>{item.name}</span>
                <VisibilityBadge visibility={item.visibility} />
                {item.activityType && (
                  <span style={styles.activityBadge}>{item.activityType}</span>
                )}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                {item.distanceKm != null && <span>{item.distanceKm.toFixed(1)} km</span>}
                {item.elevationGainM != null && <span> · {item.elevationGainM}m gain</span>}
                {item.durationSec != null && <span> · {Math.round(item.durationSec / 60)} min</span>}
              </div>
              {item.description && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                  {item.description}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => onShare(item.id)} style={styles.iconBtn} title="Share to Space">
                <Share2 size={14} />
              </button>
              <button onClick={() => {
                if (confirm('Delete this route?')) onDelete(item.id);
              }} style={{ ...styles.iconBtn, color: 'var(--danger)' }} title="Delete">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Events Tab ───

function EventsTab({ items, loading, categories, routes, defaultVisibility = 'private', onCreate, onDelete, onUpdate, onShare, onCreateCategory, onDeleteCategory, onFetchRoutes }: {
  items: PersonalEvent[]; loading: boolean;
  categories: PersonalEventCategory[];
  routes: PersonalRouteItem[];
  defaultVisibility?: PersonalVisibility;
  onCreate: (data: Record<string, any>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpdate: (id: string, data: Record<string, any>) => Promise<void>;
  onShare: (id: string) => void;
  onCreateCategory: (data: { name: string; color?: string }) => Promise<PersonalEventCategory>;
  onDeleteCategory: (id: string) => Promise<void>;
  onFetchRoutes: () => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [activityType, setActivityType] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [routeId, setRouteId] = useState('');
  const [showRouteSelect, setShowRouteSelect] = useState(false);
  const [color, setColor] = useState('');
  const [visibility, setVisibility] = useState<PersonalVisibility>(defaultVisibility);
  const [creating, setCreating] = useState(false);
  const [routesFetched, setRoutesFetched] = useState(false);

  // Category inline creation
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#5865f2');

  const routeLinked = showRouteSelect && !!routeId;

  const resetForm = () => {
    setEventName('');
    setEventDate('');
    setEventTime('');
    setLocation('');
    setDescription('');
    setActivityType('');
    setCategoryId('');
    setRouteId('');
    setShowRouteSelect(false);
    setColor('');
    setVisibility(defaultVisibility);
  };

  const handleCreate = async () => {
    if (!eventName.trim() || !eventDate) return;
    if (routeLinked && !location.trim()) return;
    setCreating(true);
    try {
      await onCreate({
        name: eventName.trim(),
        eventDate,
        eventTime: eventTime || null,
        location: location.trim() || null,
        description: description.trim() || null,
        activityType: activityType || null,
        categoryId: categoryId || null,
        routeId: (showRouteSelect && routeId) ? routeId : null,
        color: color || null,
        visibility,
      });
      setShowForm(false);
      resetForm();
    } catch {}
    setCreating(false);
  };

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const cat = await onCreateCategory({ name: newCatName.trim(), color: newCatColor });
      setCategoryId(cat.id);
      setShowNewCategory(false);
      setNewCatName('');
      setNewCatColor('#5865f2');
    } catch {}
  };

  // Fetch routes when route selection is enabled
  useEffect(() => {
    if (showRouteSelect && !routesFetched) {
      onFetchRoutes();
      setRoutesFetched(true);
    }
  }, [showRouteSelect]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div style={styles.tabHeader}>
        <h3 style={styles.tabTitle}>My Events</h3>
        <button onClick={() => { setShowForm(!showForm); if (showForm) resetForm(); }} style={styles.uploadBtn}>
          <Plus size={14} /> New Event
        </button>
      </div>

      {showForm && (
        <div style={styles.inlineForm}>
          {/* Name */}
          <label style={styles.formLabel}>Name</label>
          <input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Event name" style={styles.formInput} />

          {/* Date & Time */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={styles.formLabel}>Date</label>
              <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} style={styles.formInput} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={styles.formLabel}>{routeLinked ? 'Time' : 'Time (optional)'}</label>
              <input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} style={styles.formInput} />
            </div>
          </div>

          {/* Location */}
          <label style={styles.formLabel}>{routeLinked ? 'Meet Point' : 'Location (optional)'}</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Coffee shop parking lot" style={styles.formInput} maxLength={500} />

          {/* Activity Type */}
          <label style={styles.formLabel}>Activity Type (optional)</label>
          <select value={activityType} onChange={(e) => setActivityType(e.target.value)} style={styles.formInput}>
            <option value="">None</option>
            <option value="ride">Ride</option>
            <option value="run">Run</option>
            <option value="walk">Walk</option>
          </select>

          {/* Category */}
          <label style={styles.formLabel}>Category (optional)</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ ...styles.formInput, flex: 1 }}>
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              onClick={() => setShowNewCategory(!showNewCategory)}
              style={{ ...styles.cancelBtn, padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
              title="Add category"
            >
              <Plus size={12} />
            </button>
          </div>
          {showNewCategory && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)' }}>
              <input
                type="color"
                value={newCatColor}
                onChange={(e) => setNewCatColor(e.target.value)}
                style={{ width: 28, height: 28, border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', padding: 0, background: 'transparent' }}
              />
              <input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Category name"
                style={{ ...styles.formInput, flex: 1 }}
                maxLength={100}
              />
              <button onClick={handleCreateCategory} disabled={!newCatName.trim()} style={{ ...styles.uploadBtn, padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}>
                Add
              </button>
            </div>
          )}

          {/* Route Linking */}
          <div style={{ marginTop: 4 }}>
            <label style={{ ...styles.formLabel, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showRouteSelect}
                onChange={(e) => {
                  setShowRouteSelect(e.target.checked);
                  if (!e.target.checked) setRouteId('');
                }}
                style={{ margin: 0 }}
              />
              <MapPinned size={14} />
              <span style={{ textTransform: 'none', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>Link a Route</span>
            </label>
            {showRouteSelect && (
              <div style={{ marginTop: 8, padding: 10, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)' }}>
                {routes.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No personal routes yet. Upload routes first.</div>
                ) : (
                  <select value={routeId} onChange={(e) => setRouteId(e.target.value)} style={styles.formInput}>
                    <option value="">Select a route...</option>
                    {routes.map((r) => (
                      <option key={r.id} value={r.id}>{r.name} ({r.distanceKm?.toFixed(1)} km)</option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          {/* Color */}
          <label style={styles.formLabel}>Color (optional)</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="color"
              value={color || '#5865f2'}
              onChange={(e) => setColor(e.target.value)}
              style={{ width: 32, height: 32, border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', padding: 0, background: 'transparent' }}
            />
            <input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="#5865f2"
              style={{ ...styles.formInput, width: 90, fontSize: '0.8rem' }}
            />
            {color && (
              <button onClick={() => setColor('')} style={{ ...styles.cancelBtn, padding: '0.3rem 0.5rem', fontSize: '0.7rem' }}>
                Clear
              </button>
            )}
          </div>

          {/* Visibility */}
          <label style={styles.formLabel}>Visibility</label>
          <select value={visibility} onChange={(e) => setVisibility(e.target.value as PersonalVisibility)} style={styles.formInput}>
            <option value="private">Private</option>
            <option value="friends">Friends</option>
            <option value="spaces">Shared Spaces</option>
            <option value="public">Public</option>
          </select>

          {/* Description */}
          <label style={styles.formLabel}>Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Event description..."
            style={{ ...styles.formInput, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }}
            maxLength={5000}
          />

          {/* Submit */}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              onClick={handleCreate}
              disabled={creating || !eventName.trim() || !eventDate || (routeLinked && !location.trim())}
              style={{
                ...styles.uploadBtn,
                opacity: creating || !eventName.trim() || !eventDate ? 0.5 : 1,
              }}
            >
              {creating ? 'Creating...' : 'Create Event'}
            </button>
            <button onClick={() => { setShowForm(false); resetForm(); }} style={styles.cancelBtn}>Cancel</button>
          </div>
        </div>
      )}

      {items.length === 0 && !loading && !showForm && (
        <div style={styles.emptyState}>No events yet. Create one to get started!</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item) => {
          const dateStr = new Date(item.eventDate + 'T00:00:00').toLocaleDateString([], {
            weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
          });

          return (
            <div key={item.id} style={styles.eventCard}>
              {(item.color || item.category?.color) && (
                <div style={{ width: 4, borderRadius: 2, background: item.color || item.category?.color || 'var(--accent)', flexShrink: 0, alignSelf: 'stretch' }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600 }}>{item.name}</span>
                  <VisibilityBadge visibility={item.visibility} />
                  {item.activityType && (
                    <span style={{ ...styles.activityBadge, background: 'var(--accent)', color: '#fff' }}>{item.activityType}</span>
                  )}
                  {item.category && (
                    <span style={{ ...styles.activityBadge, background: `${item.category.color}22`, color: item.category.color }}>{item.category.name}</span>
                  )}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  {dateStr}
                  {item.eventTime && ` at ${item.eventTime}`}
                  {item.location && ` · ${item.location}`}
                </div>
                {item.route && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--accent)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPinned size={12} />
                    {item.route.name} ({item.route.distanceKm?.toFixed(1)} km)
                  </div>
                )}
                {item.description && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                    {item.description}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => onShare(item.id)} style={styles.iconBtn} title="Share to Space">
                  <Share2 size={14} />
                </button>
                <button onClick={() => {
                  if (confirm('Delete this event?')) onDelete(item.id);
                }} style={{ ...styles.iconBtn, color: 'var(--danger)' }} title="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Feed Tab ───

function FeedTab({ posts, loading, hasMore, defaultVisibility = 'private', onCreatePost, onDeletePost, onUpdatePost, onLoadMore, highlightPostId, highlightCommentId }: {
  posts: UserPost[]; loading: boolean; hasMore: boolean;
  defaultVisibility?: PersonalVisibility;
  onCreatePost: (formData: FormData) => Promise<void>;
  onDeletePost: (id: string) => Promise<void>;
  onUpdatePost: (id: string, data: Record<string, any>) => Promise<void>;
  onLoadMore: () => void;
  highlightPostId?: string | null;
  highlightCommentId?: string | null;
}) {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const { togglePostReaction, fetchComments, addComment, deleteComment, toggleCommentReaction, createRepost, pinPost, unpinPost } = usePersonalCollectionsStore();
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<PersonalVisibility>(defaultVisibility);
  const [files, setFiles] = useState<File[]>([]);
  const [taggedIds, setTaggedIds] = useState<string[]>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [editVisibility, setEditVisibility] = useState<PersonalVisibility>('private');
  const activeSpaceId = useIdentityStore((s) => s.activeSpaceId);

  // Scroll to highlighted post after posts load
  useEffect(() => {
    if (!highlightPostId || posts.length === 0) return;
    const el = document.querySelector(`[data-post-id="${highlightPostId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (el as HTMLElement).style.boxShadow = '0 0 0 2px var(--accent)';
      const timer = setTimeout(() => { (el as HTMLElement).style.boxShadow = ''; }, 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightPostId, posts]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const gpxRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const friends = useFriendsStore((s) => s.friends);

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = e.target.files;
    if (!newFiles) return;
    setFiles((prev) => [...prev, ...Array.from(newFiles)]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleAddGpx = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = e.target.files;
    if (!newFiles) return;
    setFiles((prev) => [...prev, ...Array.from(newFiles)]);
    if (gpxRef.current) gpxRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setBody(val);
    // Detect @mention query from text before cursor
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
      // Insert markdown link for space
      const insertion = `[${name}](/space/${id}) `;
      const newBody = body.slice(0, matchIdx) + insertion + body.slice(cursorPos);
      setBody(newBody);
      setMentionQuery(null);
      requestAnimationFrame(() => {
        const newPos = matchIdx + insertion.length;
        ta.focus();
        ta.setSelectionRange(newPos, newPos);
      });
    } else {
      // Insert @username for user
      const newBody = body.slice(0, matchIdx) + `@${name} ` + body.slice(cursorPos);
      setBody(newBody);
      setMentionQuery(null);
      if (!taggedIds.includes(id)) {
        setTaggedIds((prev) => [...prev, id]);
      }
      requestAnimationFrame(() => {
        const newPos = matchIdx + name.length + 2; // @ + username + space
        ta.focus();
        ta.setSelectionRange(newPos, newPos);
      });
    }
  }, [body, taggedIds]);

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // When mention autocomplete is open, let it handle these keys
    if (mentionQuery !== null && ['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
      // The FriendMentionAutocomplete listens on document keydown (capture) and will handle it
      return;
    }
  };

  const handlePost = async () => {
    if (!body.trim() && files.length === 0) return;
    setPosting(true);
    try {
      // Also scan body for @username patterns and resolve to userIds
      const allTaggedIds = [...taggedIds];
      const mentionMatches = body.matchAll(/@([a-zA-Z0-9_-]+)/g);
      for (const m of mentionMatches) {
        const friend = friends.find((f) => f.user.username.toLowerCase() === m[1].toLowerCase());
        if (friend && !allTaggedIds.includes(friend.user.id)) {
          allTaggedIds.push(friend.user.id);
        }
      }

      const formData = new FormData();
      if (body.trim()) formData.append('body', body.trim());
      formData.append('visibility', activeSpaceId ? 'public' : visibility);
      files.forEach((f) => formData.append('files', f));
      if (allTaggedIds.length > 0) formData.append('taggedUserIds', JSON.stringify(allTaggedIds));
      if (activeSpaceId) formData.append('spaceId', activeSpaceId);
      await onCreatePost(formData);
      setBody('');
      setFiles([]);
      setTaggedIds([]);
      setVisibility(defaultVisibility);
    } catch {}
    setPosting(false);
  };

  const startEdit = (post: UserPost) => {
    setEditingId(post.id);
    setEditBody(post.body || '');
    setEditVisibility(post.visibility);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await onUpdatePost(editingId, { body: editBody.trim() || null, visibility: editVisibility });
    setEditingId(null);
  };

  return (
    <div>
      <h3 style={styles.tabTitle}>My Feed</h3>

      {/* Compose Area */}
      <div style={{ ...styles.inlineForm, marginBottom: '1rem' }}>
        <div style={{ position: 'relative' }}>
          {mentionQuery !== null && (
            <FriendMentionAutocomplete
              query={mentionQuery}
              onSelect={handleMentionSelect}
              onClose={() => setMentionQuery(null)}
            />
          )}
          <textarea
            ref={textareaRef}
            value={body}
            onChange={handleBodyChange}
            onKeyDown={handleTextareaKeyDown}
            placeholder={activeSpaceId ? 'Post as your space...' : "What's on your mind?"}
            style={{ ...styles.formInput, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }}
            maxLength={10000}
          />
        </div>

        {/* File previews */}
        {files.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {files.map((f, i) => (
              <div key={i} style={{ position: 'relative', padding: '4px 8px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                <button onClick={() => removeFile(i)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Tagged friends */}
        {taggedIds.length > 0 && (
          <div style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>
            <Users size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {taggedIds.length} friend{taggedIds.length > 1 ? 's' : ''} tagged
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => fileRef.current?.click()} style={styles.cancelBtn} title="Add media">
            <ImagePlus size={14} /> Media
          </button>
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple onChange={handleAddFiles} style={{ display: 'none' }} />

          <button onClick={() => gpxRef.current?.click()} style={styles.cancelBtn} title="Add GPX">
            <MapPin size={14} /> GPX
          </button>
          <input ref={gpxRef} type="file" accept=".gpx" multiple onChange={handleAddGpx} style={{ display: 'none' }} />

          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowTagPicker(!showTagPicker)} style={styles.cancelBtn} title="Tag friends">
              <Users size={14} /> Tag
            </button>
            {showTagPicker && (
              <FriendTagPicker
                selectedIds={taggedIds}
                onChange={setTaggedIds}
                onClose={() => setShowTagPicker(false)}
              />
            )}
          </div>

          <select value={visibility} onChange={(e) => setVisibility(e.target.value as PersonalVisibility)} style={{ ...styles.formInput, width: 'auto', padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}>
            <option value="private">Private</option>
            <option value="friends">Friends</option>
            <option value="spaces">Shared Spaces</option>
            <option value="public">Public</option>
          </select>

          <button
            onClick={handlePost}
            disabled={posting || (!body.trim() && files.length === 0)}
            style={{ ...styles.uploadBtn, marginLeft: 'auto', opacity: posting || (!body.trim() && files.length === 0) ? 0.5 : 1 }}
          >
            {posting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>

      {/* Posts List */}
      {posts.length === 0 && !loading && (
        <div style={styles.emptyState}>No posts yet. Share something!</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {posts.map((post) => (
          <SharedPostCard
            key={post.id}
            post={post}
            currentUserId={currentUser?.id || ''}
            isOwn={true}
            isEditing={editingId === post.id}
            editBody={editBody}
            editVisibility={editVisibility}
            onEditBodyChange={setEditBody}
            onEditVisibilityChange={setEditVisibility}
            onStartEdit={() => startEdit(post)}
            onSaveEdit={saveEdit}
            onCancelEdit={() => setEditingId(null)}
            onDelete={() => { if (confirm('Delete this post?')) onDeletePost(post.id); }}
            onReaction={(emoji, hasReacted) => togglePostReaction(post.id, emoji, hasReacted)}
            onFetchComments={(opts) => fetchComments(post.id, opts)}
            onAddComment={(text, parentCommentId) => addComment(post.id, text, undefined, parentCommentId, activeSpaceId || undefined)}
            onDeleteComment={(commentId) => deleteComment(post.id, commentId)}
            onCommentReaction={(commentId, emoji, hasReacted) => toggleCommentReaction(commentId, emoji, hasReacted)}
            onRepost={undefined}
            onShare={() => {}}
            onPin={() => pinPost(post.id)}
            onUnpin={() => unpinPost(post.id)}
            initialShowComments={highlightPostId === post.id && !!highlightCommentId}
          />
        ))}
      </div>

      {/* Load More */}
      {hasMore && posts.length > 0 && (
        <button onClick={onLoadMore} disabled={loading} style={{ ...styles.cancelBtn, width: '100%', marginTop: 12, textAlign: 'center' }}>
          {loading ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  outerContainer: {
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
  card: {
    width: '100%',
    maxWidth: 700,
  },
  profileSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1.5rem',
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
  },
  editBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0.4rem 0.8rem',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
  },
  summaryRow: {
    display: 'flex',
    gap: 8,
    marginTop: '1rem',
    overflowX: 'auto',
    flexWrap: 'nowrap',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  },
  summaryBadge: {
    flex: 1,
    minWidth: 0,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '10px 12px',
    borderRadius: 'var(--radius)',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  tabHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.75rem',
  },
  tabTitle: {
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: 700,
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
  emptyState: {
    padding: '2rem',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
  },
  photoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 8,
  },
  photoCard: {
    position: 'relative',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    background: 'var(--bg-secondary)',
  },
  photoImg: {
    width: '100%',
    aspectRatio: '1',
    objectFit: 'cover',
    display: 'block',
  },
  photoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 6,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 100%)',
  },
  photoActions: {
    display: 'flex',
    gap: 4,
  },
  photoCaption: {
    padding: '6px 8px',
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
  },
  iconBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'rgba(0,0,0,0.3)',
    color: 'white',
    cursor: 'pointer',
    padding: 0,
  },
  routeCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '0.75rem',
    borderRadius: 'var(--radius)',
    background: 'var(--bg-secondary)',
  },
  eventCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '0.75rem',
    borderRadius: 'var(--radius)',
    background: 'var(--bg-secondary)',
  },
  postCard: {
    padding: '1rem',
    borderRadius: 'var(--radius)',
    background: 'var(--bg-secondary)',
  },
  activityBadge: {
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: 10,
    fontSize: '0.65rem',
    fontWeight: 600,
    background: 'var(--bg-tertiary)',
    color: 'var(--text-muted)',
    textTransform: 'capitalize',
  },
  inlineForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '0.75rem',
    borderRadius: 'var(--radius)',
    background: 'var(--bg-secondary)',
    marginBottom: '0.75rem',
  },
  formLabel: {
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
    marginTop: 2,
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
};
