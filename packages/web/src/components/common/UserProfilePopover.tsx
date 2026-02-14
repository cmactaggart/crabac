import { useEffect, useRef, useState } from 'react';
import { UserPlus, UserMinus, Check, Clock } from 'lucide-react';
import { api } from '../../lib/api.js';
import { Avatar } from './Avatar.js';
import { useMutesStore } from '../../stores/mutes.js';
import { useFriendsStore } from '../../stores/friends.js';
import type { FriendshipStatus } from '@crabac/shared';

interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
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
}

export function UserProfilePopover({ userId, anchorRect, onClose, onMessage, currentUserId, spaceId }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<MemberRole[]>([]);
  const [friendStatus, setFriendStatus] = useState<FriendshipStatus | null | undefined>(undefined);
  const [friendLoading, setFriendLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const isMuted = useMutesStore((s) => s.isMuted(userId));
  const muteUser = useMutesStore((s) => s.muteUser);
  const unmuteUser = useMutesStore((s) => s.unmuteUser);
  const sendFriendRequest = useFriendsStore((s) => s.sendFriendRequest);
  const acceptFriendRequest = useFriendsStore((s) => s.acceptFriendRequest);
  const removeFriend = useFriendsStore((s) => s.removeFriend);

  useEffect(() => {
    api<UserProfile>(`/users/${userId}`).then(setProfile).catch(() => {});
    if (userId !== currentUserId) {
      api<FriendshipStatus | null>(`/friends/status/${userId}`)
        .then(setFriendStatus)
        .catch(() => setFriendStatus(null));
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

  // Position below the anchor
  const top = anchorRect.bottom + 8;
  const left = Math.min(anchorRect.left, window.innerWidth - 300);

  if (!profile) {
    return (
      <div ref={popoverRef} style={{ ...styles.popover, top, left }}>
        <div style={styles.loading}>Loading...</div>
      </div>
    );
  }

  const memberSince = new Date(profile.createdAt).toLocaleDateString([], {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const handleFriendAction = async () => {
    setFriendLoading(true);
    try {
      if (!friendStatus) {
        await sendFriendRequest(userId);
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
    } catch {
      // ignore
    }
    setFriendLoading(false);
  };

  const renderFriendButton = () => {
    if (userId === currentUserId || friendStatus === undefined) return null;

    if (!friendStatus) {
      return (
        <button onClick={handleFriendAction} disabled={friendLoading} style={styles.friendBtn}>
          <UserPlus size={14} /> Send Friend Request
        </button>
      );
    }

    if (friendStatus.status === 'pending' && friendStatus.direction === 'sent') {
      return (
        <button disabled style={{ ...styles.friendBtn, opacity: 0.6, cursor: 'default' }}>
          <Clock size={14} /> Request Sent
        </button>
      );
    }

    if (friendStatus.status === 'pending' && friendStatus.direction === 'received') {
      return (
        <button onClick={handleFriendAction} disabled={friendLoading} style={{ ...styles.friendBtn, background: 'var(--success)' }}>
          <Check size={14} /> Accept Friend Request
        </button>
      );
    }

    if (friendStatus.status === 'accepted') {
      return (
        <button
          onClick={handleFriendAction}
          disabled={friendLoading}
          style={{ ...styles.friendBtn, background: 'var(--danger)' }}
        >
          <UserMinus size={14} /> Remove Friend
        </button>
      );
    }

    return null;
  };

  return (
    <div ref={popoverRef} style={{ ...styles.popover, top, left }}>
      {/* Banner */}
      <div style={styles.banner} />

      <div style={styles.avatarRow}>
        <Avatar src={profile.avatarUrl} name={profile.displayName} size={64} baseColor={profile.baseColor} accentColor={profile.accentColor} />
      </div>

      <div style={styles.body}>
        <div style={styles.displayName}>{profile.displayName}</div>
        <div style={styles.username}>{profile.username}</div>

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

        {userId !== currentUserId && (
          <>
            {renderFriendButton()}
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
};
