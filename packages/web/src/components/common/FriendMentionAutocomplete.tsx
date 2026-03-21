import { useState, useEffect, useCallback } from 'react';
import { useFollowsStore } from '../../stores/follows.js';
import { useAuthStore } from '../../stores/auth.js';
import { useSpacesStore } from '../../stores/spaces.js';
import { Avatar } from './Avatar.js';
import { LetterIcon } from '../icons/LetterIcon.js';

interface Props {
  query: string;
  onSelect: (name: string, id: string, type?: 'user' | 'space') => void;
  onClose: () => void;
}

type Entry =
  | { kind: 'user'; id: string; username: string; displayName: string; avatarUrl: string | null; baseColor: string | null; accentColor: string | null }
  | { kind: 'space'; id: string; name: string; slug: string; iconUrl: string | null; baseColor: string | null; accentColor: string | null };

export function FriendMentionAutocomplete({ query, onSelect, onClose }: Props) {
  const { following, fetchFollowing } = useFollowsStore();
  const userId = useAuthStore((s) => s.user?.id);
  const spaces = useSpacesStore((s) => s.spaces);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (following.length === 0 && userId) fetchFollowing(userId);
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const lowerQuery = query.toLowerCase();

  const followingEntries: Entry[] = following
    .filter((f) => {
      const uname = f.username.toLowerCase();
      const dname = f.displayName.toLowerCase();
      return uname.includes(lowerQuery) || dname.includes(lowerQuery);
    })
    .slice(0, 6)
    .map((f) => ({
      kind: 'user',
      id: f.id,
      username: f.username,
      displayName: f.displayName,
      avatarUrl: f.avatarUrl ?? null,
      baseColor: f.baseColor ?? null,
      accentColor: f.accentColor ?? null,
    }));

  const spaceEntries: Entry[] = spaces
    .filter((s) => s.isPublic)
    .filter((s) => {
      const sname = s.name.toLowerCase();
      const sslug = s.slug.toLowerCase();
      return sname.includes(lowerQuery) || sslug.includes(lowerQuery);
    })
    .slice(0, 4)
    .map((s) => ({
      kind: 'space',
      id: s.id,
      name: s.name,
      slug: s.slug,
      iconUrl: s.iconUrl ?? null,
      baseColor: s.baseColor ?? null,
      accentColor: s.accentColor ?? null,
    }));

  const entries = [...followingEntries, ...spaceEntries];

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = useCallback((entry: Entry) => {
    if (entry.kind === 'user') {
      onSelect(entry.username, entry.id, 'user');
    } else {
      onSelect(entry.name, entry.id, 'space');
    }
  }, [onSelect]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (entries.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, entries.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault();
      const entry = entries[selectedIndex];
      if (entry) handleSelect(entry);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [entries, selectedIndex, handleSelect, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  if (entries.length === 0) return null;

  return (
    <div style={styles.container}>
      {entries.map((entry, i) => (
        <button
          key={entry.kind + ':' + entry.id}
          style={{
            ...styles.item,
            background: i === selectedIndex ? 'var(--bg-tertiary)' : 'transparent',
          }}
          onMouseEnter={() => setSelectedIndex(i)}
          onMouseDown={(e) => {
            e.preventDefault();
            handleSelect(entry);
          }}
        >
          {entry.kind === 'user' ? (
            <>
              <Avatar
                src={entry.avatarUrl}
                name={entry.displayName}
                size={24}
                baseColor={entry.baseColor}
                accentColor={entry.accentColor}
              />
              <span style={styles.username}>@{entry.username}</span>
              {entry.displayName !== entry.username && (
                <span style={styles.displayName}>{entry.displayName}</span>
              )}
            </>
          ) : (
            <>
              {entry.iconUrl ? (
                <div style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                  <img src={entry.iconUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ) : (
                <LetterIcon
                  letter={entry.name.charAt(0)}
                  size={24}
                  bg={entry.baseColor || 'var(--accent)'}
                  gradient={entry.baseColor && entry.accentColor ? { base: entry.baseColor, accent: entry.accentColor } : undefined}
                />
              )}
              <span style={styles.username}>{entry.name}</span>
              <span style={styles.displayName}>/{entry.slug}</span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    marginBottom: 4,
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    boxShadow: '0 -4px 16px rgba(0,0,0,0.3)',
    maxHeight: 240,
    overflowY: 'auto',
    zIndex: 50,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    textAlign: 'left',
    padding: '6px 12px',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
  },
  username: {
    fontWeight: 600,
  },
  displayName: {
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
  },
};
