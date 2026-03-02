import { Avatar } from '../common/Avatar.js';

interface Props {
  avatarUrl: string | null;
  displayName: string;
  username: string;
  baseColor?: string | null;
  accentColor?: string | null;
  followingCount: number;
  followerCount: number;
  onFollowingClick?: () => void;
  onFollowersClick?: () => void;
}

export function ProfileSidebar({
  avatarUrl,
  displayName,
  username,
  baseColor,
  accentColor,
  followingCount,
  followerCount,
  onFollowingClick,
  onFollowersClick,
}: Props) {
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
    background: 'var(--bg-secondary)',
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
};
