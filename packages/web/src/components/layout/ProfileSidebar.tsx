import { useState } from 'react';
import { LogOut, Pencil, ExternalLink } from 'lucide-react';
import { Avatar } from '../common/Avatar.js';
import { UserSettingsModal } from '../settings/user/UserSettingsModal.js';
import { IdentitySwitcher } from '../common/IdentitySwitcher.js';

interface ProfileLink {
  id: string;
  label: string;
  url: string;
  position: number;
}

interface Props {
  avatarUrl: string | null;
  displayName: string;
  username: string;
  bio?: string | null;
  profileLinks?: ProfileLink[];
  baseColor?: string | null;
  accentColor?: string | null;
  followingCount: number;
  followerCount: number;
  onFollowingClick?: () => void;
  onFollowersClick?: () => void;
  onLogout?: () => void;
}

export function ProfileSidebar({
  avatarUrl,
  displayName,
  username,
  bio,
  profileLinks,
  baseColor,
  accentColor,
  followingCount,
  followerCount,
  onFollowingClick,
  onFollowersClick,
  onLogout,
}: Props) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div style={styles.sidebar}>
      <div style={styles.content}>
        <Avatar
          src={avatarUrl}
          name={displayName}
          size={56}
          baseColor={baseColor ?? null}
          accentColor={accentColor ?? null}
        />
        <div style={styles.nameBlock}>
          <div style={styles.displayName}>{displayName}</div>
          <div style={styles.username}>@{username}</div>
        </div>
        {bio && (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.4, padding: '0 0.25rem' }}>
            {bio}
          </div>
        )}
        {profileLinks && profileLinks.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', padding: '0 0.25rem' }}>
            {profileLinks.sort((a, b) => a.position - b.position).map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.75rem',
                  color: 'var(--accent)',
                  textDecoration: 'none',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                <ExternalLink size={12} style={{ flexShrink: 0 }} />
                {link.label}
              </a>
            ))}
          </div>
        )}
        <button onClick={() => setShowSettings(true)} style={styles.editBtn}>
          <Pencil size={12} /> Edit Profile
        </button>
        <div style={styles.followRow}>
          <span
            style={onFollowingClick ? styles.followClickable : styles.followStatic}
            onClick={onFollowingClick}
          >
            <strong>{followingCount}</strong> following
          </span>
          <span
            style={onFollowersClick ? styles.followClickable : styles.followStatic}
            onClick={onFollowersClick}
          >
            <strong>{followerCount}</strong> followers
          </span>
        </div>
      </div>
      <div style={styles.footer}>
        <IdentitySwitcher />
        {onLogout && (
          <button onClick={onLogout} style={styles.logoutBtn}>
            <LogOut size={14} />
            Log Out
          </button>
        )}
      </div>
      {showSettings && <UserSettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 240,
    height: '100%',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid var(--border)',
    background: 'linear-gradient(to bottom, var(--bg-secondary), color-mix(in srgb, var(--bg-secondary), black 18%))',
    overflowY: 'auto',
  },
  content: {
    padding: '1.25rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  nameBlock: {
    textAlign: 'center',
  },
  displayName: {
    fontWeight: 700,
    fontSize: '0.9rem',
  },
  username: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  followRow: {
    display: 'flex',
    gap: 12,
    fontSize: '0.78rem',
    marginTop: 4,
  },
  followClickable: {
    cursor: 'pointer',
    color: 'var(--text-secondary)',
  },
  followStatic: {
    color: 'var(--text-secondary)',
  },
  footer: {
    marginTop: 'auto',
    padding: '0.75rem 1rem',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  editBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '5px 12px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    background: 'none',
    color: 'var(--text-secondary)',
    fontSize: '0.75rem',
    fontWeight: 500,
    cursor: 'pointer',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0.5rem 0.75rem',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'none',
    color: 'var(--text-muted)',
    fontSize: '0.78rem',
    fontWeight: 500,
    cursor: 'pointer',
  },
};
