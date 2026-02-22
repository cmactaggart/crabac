import { useState, useEffect, useCallback } from 'react';
import { useFriendsStore } from '../../stores/friends.js';
import { Avatar } from './Avatar.js';

interface Props {
  query: string;
  onSelect: (username: string, userId: string) => void;
  onClose: () => void;
}

export function FriendMentionAutocomplete({ query, onSelect, onClose }: Props) {
  const { friends, fetchFriends } = useFriendsStore();
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (friends.length === 0) fetchFriends();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const lowerQuery = query.toLowerCase();

  const entries = friends
    .filter((f) => {
      const uname = f.user.username.toLowerCase();
      const dname = f.user.displayName.toLowerCase();
      return uname.includes(lowerQuery) || dname.includes(lowerQuery);
    })
    .slice(0, 8);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

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
      if (entry) onSelect(entry.user.username, entry.user.id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [entries, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  if (entries.length === 0) return null;

  return (
    <div style={styles.container}>
      {entries.map((entry, i) => (
        <button
          key={entry.user.id}
          style={{
            ...styles.item,
            background: i === selectedIndex ? 'var(--bg-tertiary)' : 'transparent',
          }}
          onMouseEnter={() => setSelectedIndex(i)}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(entry.user.username, entry.user.id);
          }}
        >
          <Avatar
            src={entry.user.avatarUrl ?? null}
            name={entry.user.displayName}
            size={24}
            baseColor={entry.user.baseColor ?? null}
            accentColor={entry.user.accentColor ?? null}
          />
          <span style={styles.username}>@{entry.user.username}</span>
          {entry.user.displayName !== entry.user.username && (
            <span style={styles.displayName}>{entry.user.displayName}</span>
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
