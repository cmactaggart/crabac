import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Image, Map, CalendarDays, FileText, UserPlus, UserMinus, Check, Clock, MessageSquare, Lock, ArrowLeft, UserCheck, Newspaper, Activity, Bike, Footprints, Mountain } from 'lucide-react';
import { useAuthStore } from '../stores/auth.js';
import { useSpacesStore } from '../stores/spaces.js';
import { useFriendsStore } from '../stores/friends.js';
import { useDMStore } from '../stores/dm.js';
import { usePersonalCollectionsStore } from '../stores/personalCollections.js';
import { useNotificationsStore } from '../stores/notifications.js';
import { useLayoutStore } from '../stores/layout.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { Avatar } from '../components/common/Avatar.js';
import { PostCard as SharedPostCard } from '../components/posts/PostCard.js';
import { ReportModal } from '../components/moderation/ReportModal.js';
import { SpaceSidebar } from '../components/layout/SpaceSidebar.js';
import { ProfileSidebar } from '../components/layout/ProfileSidebar.js';
import { useFollowsStore } from '../stores/follows.js';
import { useIdentityStore } from '../stores/identity.js';
import { api } from '../lib/api.js';
import type { PersonalGalleryItem, PersonalRouteItem, PersonalEvent, PersonalActivityItem, PersonalActivityStats, UserPost, UserPostComment, UserCollectionsSummary, FriendshipStatus, PersonalVisibility, FollowCounts } from '@crabac/shared';

interface ProfileUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio?: string | null;
  baseColor?: string | null;
  accentColor?: string | null;
  status: string;
  createdAt: string;
  canViewProfile: boolean;
  newsletterEnabled?: boolean;
  profileLinks?: { id: string; label: string; url: string; position: number }[];
}

interface SpaceProfile {
  type: 'space';
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  iconUrl: string | null;
  ownerId: string;
  baseColor?: string | null;
  accentColor?: string | null;
  textColor?: string | null;
  memberCount: number;
}

type SubTab = 'feed' | 'photos' | 'activities' | 'events';
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

export function PublicProfilePage() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentUser = useAuthStore((s) => s.user);
  const isMobile = useIsMobile();
  const { spaces, fetchSpaces } = useSpacesStore();
  const { channelSidebarOpen } = useLayoutStore();
  const { fetchUnreadCount } = useNotificationsStore();

  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [spaceProfile, setSpaceProfile] = useState<SpaceProfile | null>(null);
  const [spacePosts, setSpacePosts] = useState<UserPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const highlightPostId = searchParams.get('post');
  const highlightCommentId = searchParams.get('comment');
  const [activeTab, setActiveTab] = useState<SubTab>('feed');
  const [summary, setSummary] = useState<UserCollectionsSummary | null>(null);
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [galleryItems, setGalleryItems] = useState<PersonalGalleryItem[]>([]);
  const [routeItems, setRouteItems] = useState<PersonalRouteItem[]>([]);
  const [activityItems, setActivityItems] = useState<PersonalActivityItem[]>([]);
  const [activityStats, setActivityStats] = useState<PersonalActivityStats | null>(null);
  const [events, setEvents] = useState<PersonalEvent[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  // Friends
  const [friendStatus, setFriendStatus] = useState<FriendshipStatus | null | undefined>(undefined);
  const [friendLoading, setFriendLoading] = useState(false);

  // Follows
  const [followStatus, setFollowStatus] = useState<{ isFollowing: boolean; isFriend: boolean } | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [followCounts, setFollowCounts] = useState<FollowCounts>({ followingCount: 0, followerCount: 0 });
  const { followUser: doFollow, unfollowUser: doUnfollow, getFollowStatus, fetchCounts, counts: currentUserFollowCounts } = useFollowsStore();
  const { fetchComments, addComment, deleteComment, toggleCommentReaction } = usePersonalCollectionsStore();
  const activeSpaceId = useIdentityStore((s) => s.activeSpaceId);
  const sendFriendRequest = useFriendsStore((s) => s.sendFriendRequest);
  const acceptFriendRequest = useFriendsStore((s) => s.acceptFriendRequest);
  const removeFriend = useFriendsStore((s) => s.removeFriend);
  const createConversation = useDMStore((s) => s.createConversation);

  // Redirect to /you if viewing own profile (preserve query params)
  useEffect(() => {
    if (currentUser && username === currentUser.username) {
      const qs = searchParams.toString();
      navigate(`/you${qs ? `?${qs}` : ''}`, { replace: true });
    }
  }, [currentUser, username, navigate]);

  // Fetch sidebar data (spaces, unread notifications)
  useEffect(() => {
    fetchUnreadCount();
    fetchSpaces();
  }, []);

  // Fetch profile (user-first, then space)
  useEffect(() => {
    if (!username) return;
    setLoading(true);
    setNotFound(false);
    setProfile(null);
    setSpaceProfile(null);

    api<any>(`/users/profiles/${encodeURIComponent(username)}`)
      .then((data) => {
        if (data.type === 'space') {
          setSpaceProfile(data as SpaceProfile);
          // Fetch space posts
          api<UserPost[]>(`/follows/spaces/${data.id}/posts`)
            .then(setSpacePosts)
            .catch(() => {});
        } else {
          // User profile (type === 'user' or no type field from by-username)
          const userData = data as ProfileUser;
          setProfile(userData);
          // Fetch friend status + follow status if not self
          if (currentUser && userData.id !== currentUser.id) {
            api<FriendshipStatus | null>(`/friends/status/${userData.id}`)
              .then(setFriendStatus)
              .catch(() => setFriendStatus(null));
            getFollowStatus(userData.id).then(setFollowStatus);
          }
          // Fetch follow counts
          api<FollowCounts>(`/follows/counts/${userData.id}`)
            .then(setFollowCounts)
            .catch(() => {});
          // Fetch summary if can view
          if (userData.canViewProfile) {
            api<UserCollectionsSummary>(`/users/${userData.id}/collections/summary`)
              .then((s) => { if (s && !('profilePrivate' in (s as any))) setSummary(s); })
              .catch(() => {});
          }
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [username, currentUser]);

  // Fetch tab data
  useEffect(() => {
    if (!profile?.canViewProfile) return;
    setTabLoading(true);
    const userId = profile.id;

    if (activeTab === 'feed') {
      api<UserPost[]>(`/users/${userId}/posts`)
        .then((data) => { if (!('profilePrivate' in (data as any))) setPosts(data); })
        .catch(() => {})
        .finally(() => setTabLoading(false));
    } else if (activeTab === 'photos') {
      api<PersonalGalleryItem[]>(`/users/${userId}/collections/gallery`)
        .then((data) => { if (!('profilePrivate' in (data as any))) setGalleryItems(data); })
        .catch(() => {})
        .finally(() => setTabLoading(false));
    } else if (activeTab === 'activities') {
      Promise.all([
        api<PersonalActivityItem[]>(`/users/${userId}/collections/activities`),
        api<PersonalActivityStats>(`/users/${userId}/collections/activities/stats`),
        api<PersonalRouteItem[]>(`/users/${userId}/collections/routes`),
      ]).then(([activities, stats, routes]) => {
        if (!('profilePrivate' in (activities as any))) setActivityItems(activities);
        if (!('profilePrivate' in (stats as any))) setActivityStats(stats);
        if (!('profilePrivate' in (routes as any))) setRouteItems(routes);
      }).catch(() => {}).finally(() => setTabLoading(false));
    } else if (activeTab === 'events') {
      api<PersonalEvent[]>(`/users/${userId}/collections/events`)
        .then((data) => { if (!('profilePrivate' in (data as any))) setEvents(data); })
        .catch(() => {})
        .finally(() => setTabLoading(false));
    }
  }, [profile, activeTab]);

  const handleFriendAction = async () => {
    if (!profile) return;
    setFriendLoading(true);
    try {
      if (!friendStatus) {
        await sendFriendRequest(profile.id);
        setFriendStatus({ id: '', status: 'pending', direction: 'sent' });
      } else if (friendStatus.status === 'pending' && friendStatus.direction === 'received') {
        await acceptFriendRequest(friendStatus.id);
        setFriendStatus({ ...friendStatus, status: 'accepted' });
      } else if (friendStatus.status === 'accepted') {
        if (confirm('Remove this friend?')) {
          await removeFriend(friendStatus.id);
          setFriendStatus(null);
        }
      }
    } catch {}
    setFriendLoading(false);
  };

  const handleMessage = async () => {
    if (!profile) return;
    try {
      const conv = await createConversation(profile.id);
      navigate(`/dm/${conv.id}`);
    } catch {}
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Loading...</div>
      </div>
    );
  }

  // Space profile view
  if (spaceProfile) {
    const spaceContent = (
      <div style={{ width: '100%', maxWidth: 700 }}>
        {/* Space Profile Card */}
        <div style={styles.profileSection}>
          <Avatar
            src={spaceProfile.iconUrl}
            name={spaceProfile.name}
            size={isMobile ? 56 : 80}
            baseColor={spaceProfile.baseColor}
            accentColor={spaceProfile.accentColor}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: isMobile ? '1.1rem' : '1.3rem' }}>{spaceProfile.name}</h2>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {spaceProfile.memberCount} member{spaceProfile.memberCount !== 1 ? 's' : ''}
            </div>
            {spaceProfile.description && (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 }}>
                {spaceProfile.description}
              </div>
            )}
          </div>
        </div>

        {/* Space Posts */}
        <div style={{ marginTop: '1rem' }}>
          {spacePosts.length === 0 ? (
            <div style={styles.emptyState}>No posts yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {spacePosts.map((post) => (
                <SharedPostCard
                  key={post.id}
                  post={post}
                  currentUserId={currentUser?.id || ''}
                  isOwn={false}
                  showAuthorLink
                  onReaction={(emoji, hasReacted) => {
                    const method = hasReacted ? 'DELETE' : 'PUT';
                    api(`/users/${post.userId}/posts/${post.id}/reactions/${encodeURIComponent(emoji)}`, { method })
                      .then(() => api<UserPost[]>(`/follows/spaces/${spaceProfile.id}/posts`).then(setSpacePosts))
                      .catch(() => {});
                  }}
                  onFetchComments={() => fetchComments(post.id, { userId: post.userId })}
                  onAddComment={(body, parentCommentId) => addComment(post.id, body, post.userId, parentCommentId, activeSpaceId || undefined)}
                  onDeleteComment={(commentId) => deleteComment(post.id, commentId, post.userId)}
                  onCommentReaction={(commentId, emoji, hasReacted) => toggleCommentReaction(commentId, emoji, hasReacted)}
                  onShare={() => {}}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );

    if (isMobile) {
      return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 56, overflowY: 'auto', padding: '1rem', background: 'linear-gradient(to bottom, var(--bg-primary), color-mix(in srgb, var(--bg-primary), black 18%))' }}>
          <button onClick={() => navigate(-1)} style={{ ...styles.backBtn, marginBottom: 12 }}>
            <ArrowLeft size={16} /> Back
          </button>
          {spaceContent}
        </div>
      );
    }

    return (
      <div style={styles.outerContainer}>
        <div style={styles.sidebarWrap}>
          <SpaceSidebar spaces={spaces} activeSpaceId={null} />
        </div>
        <div style={{ ...styles.sidebarWrap, width: channelSidebarOpen ? 240 : 0 }}>
          <ProfileSidebar
            avatarUrl={spaceProfile.iconUrl}
            displayName={spaceProfile.name}
            username={spaceProfile.slug}
            baseColor={spaceProfile.baseColor}
            accentColor={spaceProfile.accentColor}
            followingCount={0}
            followerCount={spaceProfile.memberCount}
          />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', display: 'flex', justifyContent: 'center' }}>
          {spaceContent}
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12 }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>User not found</div>
        <button onClick={() => navigate(-1)} style={styles.backBtn}>
          <ArrowLeft size={16} /> Go Back
        </button>
      </div>
    );
  }

  const memberSince = new Date(profile.createdAt).toLocaleDateString([], {
    year: 'numeric', month: 'long',
  });

  const isOwnProfile = currentUser?.id === profile.id;

  const renderFriendButton = () => {
    if (isOwnProfile || friendStatus === undefined) return null;

    if (!friendStatus) {
      return (
        <button onClick={handleFriendAction} disabled={friendLoading} style={styles.actionBtn}>
          <UserPlus size={14} /> Add Friend
        </button>
      );
    }
    if (friendStatus.status === 'pending' && friendStatus.direction === 'sent') {
      return (
        <button disabled style={{ ...styles.actionBtn, opacity: 0.6, cursor: 'default' }}>
          <Clock size={14} /> Request Sent
        </button>
      );
    }
    if (friendStatus.status === 'pending' && friendStatus.direction === 'received') {
      return (
        <button onClick={handleFriendAction} disabled={friendLoading} style={{ ...styles.actionBtn, background: 'var(--success)' }}>
          <Check size={14} /> Accept Request
        </button>
      );
    }
    if (friendStatus.status === 'accepted') {
      return (
        <button onClick={handleFriendAction} disabled={friendLoading} style={{ ...styles.actionBtn, background: 'var(--danger)' }}>
          <UserMinus size={14} /> Remove Friend
        </button>
      );
    }
    return null;
  };

  const renderFollowButton = () => {
    if (isOwnProfile || !followStatus) return null;
    // If friends, no follow button needed (implicit)
    if (followStatus.isFriend) return null;

    if (followStatus.isFollowing) {
      return (
        <button
          onClick={async () => {
            setFollowLoading(true);
            try {
              await doUnfollow(profile!.id);
              setFollowStatus({ ...followStatus, isFollowing: false });
              setFollowCounts((c) => ({ ...c, followerCount: Math.max(0, c.followerCount - 1) }));
            } catch {}
            setFollowLoading(false);
          }}
          disabled={followLoading}
          style={{ ...styles.actionBtn, background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
        >
          <UserCheck size={14} /> Following
        </button>
      );
    }

    return (
      <button
        onClick={async () => {
          setFollowLoading(true);
          try {
            await doFollow(profile!.id);
            setFollowStatus({ ...followStatus, isFollowing: true });
            setFollowCounts((c) => ({ ...c, followerCount: c.followerCount + 1 }));
          } catch {}
          setFollowLoading(false);
        }}
        disabled={followLoading}
        style={{ ...styles.actionBtn, background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
      >
        <UserPlus size={14} /> Follow
      </button>
    );
  };

  // Private profile view
  if (!profile.canViewProfile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16, padding: '2rem' }}>
        <Avatar
          src={profile.avatarUrl}
          name={profile.displayName}
          size={80}
          baseColor={profile.baseColor}
          accentColor={profile.accentColor}
        />
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.3rem' }}>{profile.displayName}</h2>
          <div
            style={{ fontSize: '0.85rem', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
            onClick={() => navigate(`/p/${profile.username}`)}
          >@{profile.username}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          <Lock size={16} /> This account is private
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {renderFriendButton()}
          {!isOwnProfile && (
            <button onClick={handleMessage} style={{ ...styles.actionBtn, background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
              <MessageSquare size={14} /> Message
            </button>
          )}
        </div>
        <button onClick={() => navigate(-1)} style={styles.backBtn}>
          <ArrowLeft size={16} /> Go Back
        </button>
      </div>
    );
  }

  // Public profile view
  const content = (
    <div style={{ width: '100%', maxWidth: 700 }}>
      {/* Profile Card */}
      <div style={styles.profileSection}>
        <Avatar
          src={profile.avatarUrl}
          name={profile.displayName}
          size={isMobile ? 56 : 80}
          baseColor={profile.baseColor}
          accentColor={profile.accentColor}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: isMobile ? '1.1rem' : '1.3rem' }}>{profile.displayName}</h2>
          <div
            style={{ fontSize: '0.85rem', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
            onClick={() => navigate(`/p/${profile.username}`)}
          >@{profile.username}</div>
          {profile.bio && (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 }}>
              {profile.bio}
            </div>
          )}
          {memberSince && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Member since {memberSince}
            </div>
          )}
        </div>
      </div>

      {/* Profile Links */}
      {profile.profileLinks && profile.profileLinks.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {profile.profileLinks.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, background: 'var(--bg-tertiary)', color: 'var(--accent)', textDecoration: 'none', border: '1px solid var(--border)' }}
            >
              {link.label}
            </a>
          ))}
        </div>
      )}

      {/* Follower/Following counts */}
      <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
        <span><strong>{followCounts.followingCount}</strong> following</span>
        <span><strong>{followCounts.followerCount}</strong> followers</span>
      </div>

      {/* Action Buttons */}
      {!isOwnProfile && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {renderFriendButton()}
          {renderFollowButton()}
          <button onClick={handleMessage} style={{ ...styles.actionBtn, background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
            <MessageSquare size={14} /> Message
          </button>
        </div>
      )}

      {/* Summary Tabs */}
      {summary && (
        <div style={styles.summaryRow}>
          <SummaryBadge icon={<FileText size={14} />} label="Feed" count={summary.postCount} active={activeTab === 'feed'} onClick={() => setActiveTab('feed')} />
          <SummaryBadge icon={<Image size={14} />} label="Photos" count={summary.galleryCount} active={activeTab === 'photos'} onClick={() => setActiveTab('photos')} />
          <SummaryBadge icon={<Activity size={14} />} label="Active" count={summary.activityCount} active={activeTab === 'activities'} onClick={() => setActiveTab('activities')} />
          <SummaryBadge icon={<CalendarDays size={14} />} label="Events" count={summary.eventCount} active={activeTab === 'events'} onClick={() => setActiveTab('events')} />
          {profile.newsletterEnabled && <SummaryBadge icon={<Newspaper size={14} />} label="Newsletter" count={0} active={false} onClick={() => navigate(`/newsletter/u/${profile.username}`)} />}
        </div>
      )}

      {/* Tab Content */}
      <div style={{ marginTop: '1rem' }}>
        {tabLoading && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Loading...</div>
        )}

        {!tabLoading && activeTab === 'feed' && (
          <ReadOnlyFeedTab
            posts={posts}
            setPosts={setPosts}
            profileUserId={profile.id}
            friendStatus={friendStatus}
            handleFriendAction={handleFriendAction}
            friendLoading={friendLoading}
            displayName={profile.displayName}
            highlightPostId={highlightPostId}
            highlightCommentId={highlightCommentId}
          />
        )}
        {!tabLoading && activeTab === 'photos' && (
          <ReadOnlyPhotosTab items={galleryItems} />
        )}
        {!tabLoading && activeTab === 'activities' && (
          <ReadOnlyActivitiesTabContainer
            activityItems={activityItems}
            activityStats={activityStats}
            routeItems={routeItems}
            userId={profile.id}
            onFetchStats={(opts) => {
              api<PersonalActivityStats>(`/users/${profile.id}/collections/activities/stats?period=${opts.period || 'ytd'}`)
                .then((data) => { if (!('profilePrivate' in (data as any))) setActivityStats(data); })
                .catch(() => {});
            }}
          />
        )}
        {!tabLoading && activeTab === 'events' && (
          <ReadOnlyEventsTab items={events} />
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 56, overflowY: 'auto', padding: '1rem', background: 'linear-gradient(to bottom, var(--bg-primary), color-mix(in srgb, var(--bg-primary), black 18%))' }}>
        <button onClick={() => navigate(-1)} style={{ ...styles.backBtn, marginBottom: 12 }}>
          <ArrowLeft size={16} /> Back
        </button>
        {content}
      </div>
    );
  }

  // Desktop: Rail | ProfileSidebar (viewed user) | Main content
  return (
    <div style={styles.outerContainer}>
      <div style={styles.sidebarWrap}>
        <SpaceSidebar spaces={spaces} activeSpaceId={null} />
      </div>
      <div style={{ ...styles.sidebarWrap, width: channelSidebarOpen ? 240 : 0 }}>
        <ProfileSidebar
          avatarUrl={profile.avatarUrl}
          displayName={profile.displayName}
          username={profile.username}
          baseColor={profile.baseColor}
          accentColor={profile.accentColor}
          followingCount={followCounts.followingCount}
          followerCount={followCounts.followerCount}
        />
      </div>

      {/* Main Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '2rem',
        display: 'flex',
        justifyContent: 'center',
      }}>
        {content}
      </div>
    </div>
  );
}

// ─── Summary Badge ───

function SummaryBadge({ icon, label, count, active, onClick }: {
  icon: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.summaryBadge,
        background: active ? 'var(--accent)' : 'var(--bg-tertiary)',
        color: active ? 'white' : 'var(--text-secondary)',
      }}
    >
      {icon}
      <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{count}</span>
      <span style={{ fontSize: '0.72rem' }}>{label}</span>
    </button>
  );
}

// ─── Read-Only Feed Tab ───

function ReadOnlyFeedTab({ posts, setPosts, profileUserId, friendStatus, handleFriendAction, friendLoading, displayName, highlightPostId, highlightCommentId }: {
  posts: UserPost[];
  setPosts: (posts: UserPost[]) => void;
  profileUserId: string;
  friendStatus: FriendshipStatus | null | undefined;
  handleFriendAction: () => void;
  friendLoading: boolean;
  displayName: string;
  highlightPostId?: string | null;
  highlightCommentId?: string | null;
}) {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const { togglePostReaction, fetchComments, addComment, deleteComment, toggleCommentReaction, createRepost } = usePersonalCollectionsStore();
  const activeSpaceId = useIdentityStore((s) => s.activeSpaceId);
  const currentUserId = currentUser?.id || '';
  const [reportPost, setReportPost] = useState<UserPost | null>(null);

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

  const handleReaction = async (postId: string, emoji: string, hasReacted: boolean) => {
    try {
      const prefix = `/users/${profileUserId}`;
      const method = hasReacted ? 'DELETE' : 'PUT';
      const reactions = await api(`${prefix}/posts/${postId}/reactions/${encodeURIComponent(emoji)}`, { method });
      setPosts(posts.map((p) => p.id === postId ? { ...p, reactions: reactions as any } : p));
    } catch {}
  };

  const handleFetchComments = async (postId: string) => {
    return fetchComments(postId, { userId: profileUserId });
  };

  const handleAddComment = async (postId: string, body: string, parentCommentId?: string) => {
    const comment = await addComment(postId, body, profileUserId, parentCommentId, activeSpaceId || undefined);
    setPosts(posts.map((p) => p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p));
    return comment;
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    await deleteComment(postId, commentId, profileUserId);
    setPosts(posts.map((p) => p.id === postId ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p));
  };

  return (
    <div>
      {/* Friend Banner */}
      {friendStatus === null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.75rem 1rem', background: 'rgba(88, 101, 242, 0.08)', borderRadius: 'var(--radius)', marginBottom: 12, fontSize: '0.85rem' }}>
          <UserPlus size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span style={{ flex: 1 }}>Add <strong>{displayName}</strong> as a friend to see more content</span>
          <button onClick={handleFriendAction} disabled={friendLoading} style={styles.actionBtn}>
            <UserPlus size={14} /> Add Friend
          </button>
        </div>
      )}
      {friendStatus?.status === 'pending' && friendStatus.direction === 'sent' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.75rem 1rem', background: 'rgba(250, 166, 26, 0.08)', borderRadius: 'var(--radius)', marginBottom: 12, fontSize: '0.85rem' }}>
          <Clock size={16} style={{ color: '#faa61a', flexShrink: 0 }} />
          <span>Friend request sent to <strong>{displayName}</strong></span>
        </div>
      )}
      {friendStatus?.status === 'pending' && friendStatus.direction === 'received' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.75rem 1rem', background: 'rgba(67, 181, 129, 0.08)', borderRadius: 'var(--radius)', marginBottom: 12, fontSize: '0.85rem' }}>
          <Check size={16} style={{ color: '#43b581', flexShrink: 0 }} />
          <span style={{ flex: 1 }}><strong>{displayName}</strong> wants to be friends</span>
          <button onClick={handleFriendAction} disabled={friendLoading} style={{ ...styles.actionBtn, background: 'var(--success, #43b581)' }}>
            <Check size={14} /> Accept
          </button>
        </div>
      )}

      {posts.length === 0 && (
        <div style={styles.emptyState}>No posts yet</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {posts.map((post) => (
          <SharedPostCard
            key={post.id}
            post={post}
            currentUserId={currentUserId}
            isOwn={false}
            onReaction={(emoji, hasReacted) => handleReaction(post.id, emoji, hasReacted)}
            onFetchComments={(opts) => handleFetchComments(post.id)}
            onAddComment={(body, parentCommentId) => handleAddComment(post.id, body, parentCommentId)}
            onDeleteComment={(commentId) => handleDeleteComment(post.id, commentId)}
            onCommentReaction={(commentId, emoji, hasReacted) => toggleCommentReaction(commentId, emoji, hasReacted)}
            onRepost={post.userId !== currentUserId && !post.repostOfId ? () => {} : undefined}
            onShare={() => {}}
            onReport={post.userId !== currentUserId ? () => setReportPost(post) : undefined}
            showAuthorLink={true}
            initialShowComments={highlightPostId === post.id && !!highlightCommentId}
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
    </div>
  );
}

// ─── Read-Only Photos Tab ───

function ReadOnlyPhotosTab({ items }: { items: PersonalGalleryItem[] }) {
  const [selected, setSelected] = useState<PersonalGalleryItem | null>(null);

  if (items.length === 0) {
    return <div style={styles.emptyState}>No photos yet</div>;
  }

  return (
    <>
      <div style={styles.photoGrid}>
        {items.map((item) => {
          const firstAttachment = item.attachments[0];
          if (!firstAttachment) return null;
          const isVideo = firstAttachment.mimeType.startsWith('video/');
          return (
            <div
              key={item.id}
              style={styles.photoCell}
              onClick={() => setSelected(item)}
            >
              {isVideo ? (
                <video src={firstAttachment.url} style={styles.photoImg} muted />
              ) : (
                <img src={firstAttachment.url} alt={item.caption || ''} style={styles.photoImg} />
              )}
              {item.attachments.length > 1 && (
                <span style={styles.multiIndicator}>+{item.attachments.length - 1}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Simple overlay */}
      {selected && (
        <div style={styles.overlay} onClick={() => setSelected(null)}>
          <div style={styles.overlayContent} onClick={(e) => e.stopPropagation()}>
            {selected.attachments.map((a) => (
              a.mimeType.startsWith('video/') ? (
                <video key={a.id} src={a.url} controls style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 'var(--radius)' }} />
              ) : (
                <img key={a.id} src={a.url} alt={selected.caption || ''} style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 'var(--radius)' }} />
              )
            ))}
            {selected.caption && (
              <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: '0.9rem' }}>{selected.caption}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Read-Only Activities Tab Container ───

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

function formatDuration(totalSec: number): string {
  if (!totalSec) return '0m';
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function ReadOnlyActivitiesTabContainer({
  activityItems, activityStats, routeItems, userId, onFetchStats,
}: {
  activityItems: PersonalActivityItem[];
  activityStats: PersonalActivityStats | null;
  routeItems: PersonalRouteItem[];
  userId: string;
  onFetchStats: (opts: { period: string }) => void;
}) {
  const [subTab, setSubTab] = useState<ActivitiesSubTab>('stats');
  const [statsPeriod, setStatsPeriod] = useState('ytd');

  return (
    <div>
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
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>Activity Stats</h4>
            <select
              value={statsPeriod}
              onChange={(e) => {
                setStatsPeriod(e.target.value);
                onFetchStats({ period: e.target.value });
              }}
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem', borderRadius: 'var(--radius)', border: 'none', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
            >
              {Object.entries(STATS_PERIOD_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          {!activityStats || activityStats.stats.length === 0 ? (
            <div style={styles.emptyState}>No activity data for this period</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
              {activityStats.stats.map((s) => (
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
      )}

      {subTab === 'activities' && (
        <div>
          {activityItems.length === 0 ? (
            <div style={styles.emptyState}>No activities yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activityItems.map((item) => (
                <div key={item.id} style={styles.routeCard}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--accent)', flexShrink: 0 }}>
                      {ACTIVITY_TYPE_ICONS[item.activityType] || <Activity size={18} />}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 2 }}>
                        {item.distanceKm != null && <span>{item.distanceKm.toFixed(1)} km</span>}
                        {item.durationSec != null && <span>{formatDuration(item.durationSec)}</span>}
                        {item.elevationGainM != null && <span>{Math.round(item.elevationGainM)}m gain</span>}
                        <span style={{ textTransform: 'capitalize' }}>{ACTIVITY_TYPE_LABELS[item.activityType]}</span>
                      </div>
                    </div>
                    <span style={{
                      fontSize: '0.65rem',
                      padding: '2px 6px',
                      borderRadius: 8,
                      background: VISIBILITY_COLORS[item.visibility] + '22',
                      color: VISIBILITY_COLORS[item.visibility],
                      fontWeight: 600,
                    }}>
                      {VISIBILITY_LABELS[item.visibility]}
                    </span>
                  </div>
                  {item.description && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 6 }}>{item.description}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === 'routes' && (
        <ReadOnlyRoutesTab items={routeItems} />
      )}
    </div>
  );
}

// ─── Read-Only Routes Tab ───

function ReadOnlyRoutesTab({ items }: { items: PersonalRouteItem[] }) {
  if (items.length === 0) {
    return <div style={styles.emptyState}>No routes yet</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item) => (
        <div key={item.id} style={styles.routeCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Map size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 2 }}>
                <span>{item.distanceKm.toFixed(1)} km</span>
                {item.elevationGainM != null && <span>{Math.round(item.elevationGainM)}m gain</span>}
                {item.activityType && <span style={{ textTransform: 'capitalize' }}>{item.activityType}</span>}
              </div>
            </div>
            <span style={{
              fontSize: '0.65rem',
              padding: '2px 6px',
              borderRadius: 8,
              background: VISIBILITY_COLORS[item.visibility] + '22',
              color: VISIBILITY_COLORS[item.visibility],
              fontWeight: 600,
            }}>
              {VISIBILITY_LABELS[item.visibility]}
            </span>
          </div>
          {item.description && (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 6 }}>{item.description}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Read-Only Events Tab ───

function ReadOnlyEventsTab({ items }: { items: PersonalEvent[] }) {
  if (items.length === 0) {
    return <div style={styles.emptyState}>No events yet</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item) => (
        <div key={item.id} style={styles.routeCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarDays size={18} style={{ color: item.color || item.category?.color || 'var(--accent)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 2 }}>
                <span>{new Date(item.eventDate + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                {item.eventTime && <span>{item.eventTime}</span>}
                {item.location && <span>{item.location}</span>}
              </div>
            </div>
            <span style={{
              fontSize: '0.65rem',
              padding: '2px 6px',
              borderRadius: 8,
              background: VISIBILITY_COLORS[item.visibility] + '22',
              color: VISIBILITY_COLORS[item.visibility],
              fontWeight: 600,
            }}>
              {VISIBILITY_LABELS[item.visibility]}
            </span>
          </div>
          {item.description && (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 6 }}>{item.description}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Styles ───

const styles: Record<string, React.CSSProperties> = {
  outerContainer: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
    background: 'linear-gradient(to bottom, var(--bg-primary), color-mix(in srgb, var(--bg-primary), black 18%))',
  },
  sidebarWrap: {
    overflow: 'hidden',
    flexShrink: 0,
    transition: 'width 0.2s ease',
    height: '100%',
  },
  profileSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '1rem',
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
  },
  summaryRow: {
    display: 'flex',
    gap: 8,
    marginTop: 16,
    flexWrap: 'nowrap',
    overflowX: 'auto',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  },
  summaryBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 'var(--radius)',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.8rem',
    flex: 1,
    minWidth: 0,
    flexShrink: 0,
    justifyContent: 'center',
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--accent)',
    color: 'white',
    fontWeight: 600,
    fontSize: '0.82rem',
    cursor: 'pointer',
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontWeight: 600,
    fontSize: '0.82rem',
    cursor: 'pointer',
  },
  postCard: {
    padding: '1rem',
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
  },
  photoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: 6,
  },
  photoCell: {
    position: 'relative',
    aspectRatio: '1',
    cursor: 'pointer',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
  },
  photoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  multiIndicator: {
    position: 'absolute',
    top: 6,
    right: 6,
    background: 'rgba(0,0,0,0.6)',
    color: 'white',
    fontSize: '0.7rem',
    fontWeight: 700,
    padding: '2px 6px',
    borderRadius: 8,
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.8)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
  },
  overlayContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    maxWidth: '90vw',
  },
  routeCard: {
    padding: '0.75rem 1rem',
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
  },
  emptyState: {
    textAlign: 'center',
    color: 'var(--text-muted)',
    padding: '2rem',
    fontSize: '0.9rem',
  },
};
