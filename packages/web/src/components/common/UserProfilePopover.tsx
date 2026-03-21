import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, UserMinus, Check, Clock, Ban, Shield, UserX, ExternalLink } from 'lucide-react';
import { api } from '../../lib/api.js';
import { Avatar } from './Avatar.js';
import { useMutesStore } from '../../stores/mutes.js';
import { useBlocksStore } from '../../stores/blocks.js';
import { useFollowsStore } from '../../stores/follows.js';
import { useHasSpacePermission } from '../settings/SpaceSettingsModal.js';
import { Permissions } from '@crabac/shared';
import type { FollowStatus } from '@crabac/shared';

interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio?: string | null;
  baseColor?: string | null;
  accentColor?: string | null;
  status: string;
  createdAt: string;
}

interface MemberRole {
  id: string;
  name: string;
  color: string | null;
  position: number;
}

interface Props {
  userId: string;
  anchorRect: DOMRect;
  onClose: () => void;
  onMessage: (userId: string) => void;
  currentUserId: string;
  spaceId?: string;
  onOpenSettings?: () => void;
}

export function UserProfilePopover({ userId, anchorRect, onClose, onMessage, currentUserId, spaceId, onOpenSettings }: Props) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<MemberRole[]>([]);
  const [followStatus, setFollowStatus] = useState<FollowStatus | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const isMuted = useMutesStore((s) => s.isMuted(userId));
  const muteUser = useMutesStore((s) => s.muteUser);
  const unmuteUser = useMutesStore((s) => s.unmuteUser);
  const isBlockedByMe = useBlocksStore((s) => s.isBlockedByMe(userId));
  const blockUser = useBlocksStore((s) => s.blockUser);
  const unblockUser = useBlocksStore((s) => s.unblockUser);
  const followUserAction = useFollowsStore((s) => s.followUser);
  const unfollowUserAction = useFollowsStore((s) => s.unfollowUser);
  const acceptFollowRequest = useFollowsStore((s) => s.acceptFollowRequest);
  const canManageMembers = useHasSpacePermission(spaceId || '', Permissions.MANAGE_MEMBERS);

  useEffect(() => {
    api<UserProfile>(`/users/${userId}`).then(setProfile).catch(() => {});
    if (userId !== currentUserId) {
      api<FollowStatus>(`/follows/status/${userId}`)
        .then(setFollowStatus)
        .catch(() => setFollowStatus(null));
    }
    if (spaceId) {
      api<{ roles: MemberRole[] }>(`/spaces/${spaceId}/members/${userId}/roles`)
        .then((data) => setRoles(data.roles))
        .catch(() => {});
    }
  }, [userId, currentUserId, spaceId]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Position below anchor, but flip above if it would go off-screen
  const [pos, setPos] = useState({ top: anchorRect.bottom + 8, left: Math.min(anchorRect.left, window.innerWidth - 300) });
  useEffect(() => {
    if (!popoverRef.current) return;
    const rect = popoverRef.current.getBoundingClientRect();
    let { top, left } = pos;
    if (rect.bottom > window.innerHeight) {
      top = anchorRect.top - rect.height - 8;
    }
    if (top < 0) top = 8;
    if (rect.right > window.innerWidth) {
      left = window.innerWidth - rect.width - 8;
    }
    if (left < 0) left = 8;
    if (top !== pos.top || left !== pos.left) setPos({ top, left });
  }, [profile]); // re-check when profile loads since that changes height

  if (!profile) {
    return (
      <div ref={popoverRef} style={{ ...styles.popover, top: pos.top, left: pos.left }}>
        <div style={styles.loading}>Loading...</div>
      </div>
    );
  }

  const memberSince = new Date(profile.createdAt).toLocaleDateString([], {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const handleFollowAction = async () => {
    if (!followStatus) return;
    setFollowLoading(true);
    try {
      if (followStatus.isFollowing) {
        // Unfollow
        if (confirm('Unfollow this user?')) {
          await unfollowUserAction(userId);
          setFollowStatus({ ...followStatus, isFollowing: false });
        }
      } else if (followStatus.followRequestPending) {
        // Cancel pending - unfollow removes pending too
        await unfollowUserAction(userId);
        setFollowStatus({ ...followStatus, followRequestPending: false });
      } else if (followStatus.incomingRequestPending) {
        // Accept incoming request
        await acceptFollowRequest(userId);
        setFollowStatus({ ...followStatus, incomingRequestPending: false, isFollowedBy: true });
      } else {
        // Follow
        const result = await followUserAction(userId);
        if (result.status === 'pending') {
          setFollowStatus({ ...followStatus, followRequestPending: true });
        } else {
          setFollowStatus({ ...followStatus, isFollowing: true });
        }
      }
    } catch {
      // ignore
    }
    setFollowLoading(false);
  };

  const renderFollowButton = () => {
    if (userId === currentUserId || !followStatus) return null;

    if (followStatus.isFollowing) {
      return (
        <button
          onClick={handleFollowAction}
          disabled={followLoading}
          style={{ ...styles.friendBtn, background: 'var(--danger)' }}
        >
          <UserMinus size={14} /> Unfollow
        </button>
      );
    }

    if (followStatus.followRequestPending) {
      return (
        <button onClick={handleFollowAction} disabled={followLoading} style={{ ...styles.friendBtn, opacity: 0.6 }}>
          <Clock size={14} /> Request Sent
        </button>
      );
    }

    if (followStatus.incomingRequestPending) {
      return (
        <button onClick={handleFollowAction} disabled={followLoading} style={{ ...styles.friendBtn, background: 'var(--success)' }}>
          <Check size={14} /> Accept Follow Request
        </button>
      );
    }

    return (
      <button onClick={handleFollowAction} disabled={followLoading} style={styles.friendBtn}>
        <UserPlus size={14} /> Follow
      </button>
    );
  };

  return (
    <div ref={popoverRef} style={{ ...styles.popover, top: pos.top, left: pos.left }}>
      {/* Banner */}
      <div style={styles.banner} />

      <div style={styles.avatarRow}>
        <Avatar src={profile.avatarUrl} name={profile.displayName} size={64} baseColor={profile.baseColor} accentColor={profile.accentColor} />
      </div>

      <div style={styles.body}>
        <div style={styles.displayName}>{profile.displayName}</div>
        <div style={styles.username}>{profile.username}</div>
        {profile.bio && (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 }}>
            {profile.bio}
          </div>
        )}
        <button
          onClick={() => {
            navigate(userId === currentUserId ? '/you' : `/p/${profile.username}`);
            onClose();
          }}
          style={styles.viewProfileBtn}
        >
          <ExternalLink size={12} /> View Profile
        </button>

        <div style={styles.divider} />

        <div style={styles.section}>
          <div style={styles.sectionLabel}>Member Since</div>
          <div style={styles.sectionValue}>{memberSince}</div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionLabel}>Status</div>
          <div style={{ ...styles.sectionValue, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: profile.status === 'online' ? 'var(--success)' :
                         profile.status === 'idle' ? '#faa61a' :
                         profile.status === 'dnd' ? 'var(--danger)' : 'var(--text-muted)',
              display: 'inline-block',
            }} />
            {profile.status}
          </div>
        </div>

        {roles.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionLabel}>Roles</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {roles.map((role) => (
                <span
                  key={role.id}
                  style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: role.color || 'var(--bg-tertiary)',
                    color: role.color ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  {role.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {userId === currentUserId && onOpenSettings && (
          <button
            onClick={() => { onOpenSettings(); onClose(); }}
            style={styles.messageBtn}
          >
            Edit Profile
          </button>
        )}

        {userId !== currentUserId && (
          <>
            {renderFollowButton()}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button
                onClick={() => { onMessage(userId); onClose(); }}
                style={{ ...styles.messageBtn, flex: 1, marginTop: 0 }}
              >
                Message
              </button>
              <button
                onClick={() => { isMuted ? unmuteUser(userId) : muteUser(userId); }}
                style={{
                  ...styles.messageBtn,
                  flex: 1,
                  marginTop: 0,
                  background: isMuted ? 'var(--bg-tertiary)' : 'var(--danger)',
                  border: isMuted ? '1px solid var(--border)' : 'none',
                  color: isMuted ? 'var(--text-secondary)' : 'white',
                }}
              >
                {isMuted ? 'Unmute' : 'Mute'}
              </button>
            </div>
            <button
              onClick={async () => {
                if (isBlockedByMe) {
                  await unblockUser(userId);
                } else if (confirm(`Block ${profile.displayName}? They won't be able to message you and their messages will be hidden.`)) {
                  await blockUser(userId);
                }
              }}
              style={{
                ...styles.modBtn,
                background: isBlockedByMe ? 'var(--bg-tertiary)' : 'transparent',
                color: isBlockedByMe ? 'var(--text-secondary)' : 'var(--danger)',
                border: `1px solid ${isBlockedByMe ? 'var(--border)' : 'var(--danger)'}`,
              }}
            >
              <Ban size={14} /> {isBlockedByMe ? 'Unblock' : 'Block'}
            </button>
            {spaceId && canManageMembers && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={async () => {
                    if (confirm(`Kick ${profile.displayName} from this space?`)) {
                      try {
                        await api(`/spaces/${spaceId}/members/${userId}`, { method: 'DELETE' });
                        onClose();
                      } catch (err: any) {
                        alert(err.message || 'Failed to kick user');
                      }
                    }
                  }}
                  style={{ ...styles.modBtn, flex: 1, color: 'var(--warning, #faa61a)', borderColor: 'var(--warning, #faa61a)' }}
                >
                  <UserX size={14} /> Kick
                </button>
                <button
                  onClick={async () => {
                    const reason = prompt(`Ban ${profile.displayName} from this space? Enter a reason (optional):`);
                    if (reason !== null) {
                      try {
                        await api(`/spaces/${spaceId}/bans/${userId}`, {
                          method: 'POST',
                          body: JSON.stringify({ reason: reason || undefined }),
                        });
                        onClose();
                      } catch (err: any) {
                        alert(err.message || 'Failed to ban user');
                      }
                    }
                  }}
                  style={{ ...styles.modBtn, flex: 1, color: 'var(--danger)', borderColor: 'var(--danger)' }}
                >
                  <Shield size={14} /> Ban
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  popover: {
    position: 'fixed',
    zIndex: 150,
    width: 280,
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    overflow: 'hidden',
  },
  loading: {
    padding: '2rem',
    textAlign: 'center',
    color: 'var(--text-muted)',
  },
  banner: {
    height: 60,
    background: 'linear-gradient(135deg, var(--accent), var(--bg-tertiary))',
  },
  avatarRow: {
    marginTop: -32,
    paddingLeft: 16,
  },
  body: {
    padding: '8px 16px 16px',
  },
  displayName: {
    fontSize: '1.1rem',
    fontWeight: 700,
    marginTop: 4,
  },
  username: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  viewProfileBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    padding: '3px 8px',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--bg-tertiary)',
    color: 'var(--accent)',
    fontSize: '0.72rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  divider: {
    height: 1,
    background: 'var(--border)',
    margin: '10px 0',
  },
  section: {
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: '0.65rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
    marginBottom: 2,
  },
  sectionValue: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
  },
  friendBtn: {
    width: '100%',
    padding: '7px 8px',
    marginTop: 8,
    background: 'var(--accent)',
    border: 'none',
    color: 'white',
    borderRadius: 'var(--radius)',
    fontWeight: 600,
    fontSize: '0.8rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  messageBtn: {
    width: '100%',
    padding: '8px',
    marginTop: 8,
    background: 'var(--accent)',
    border: 'none',
    color: 'white',
    borderRadius: 'var(--radius)',
    fontWeight: 600,
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  modBtn: {
    width: '100%',
    padding: '6px 8px',
    marginTop: 6,
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontWeight: 600,
    fontSize: '0.8rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
};
