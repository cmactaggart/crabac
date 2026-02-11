import { useState, useEffect, useRef, useCallback } from 'react';
import { useSpacesStore } from '../../stores/spaces.js';
import { Avatar } from '../common/Avatar.js';

interface Props {
  query: string;
  onSelect: (username: string) => void;
  onClose: () => void;
}

export function MentionAutocomplete({ query, onSelect, onClose }: Props) {
  const members = useSpacesStore((s) => s.members);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const lowerQuery = query.toLowerCase();

  const specialEntries = [
    { username: 'everyone', displayName: '@everyone', avatarUrl: null, isSpecial: true },
    { username: 'here', displayName: '@here', avatarUrl: null, isSpecial: true },
  ].filter((e) => e.username.startsWith(lowerQuery));

  const memberEntries = members
    .filter((m) => {
      const name = m.user?.username?.toLowerCase() || '';
      const display = m.user?.displayName?.toLowerCase() || '';
      return name.includes(lowerQuery) || display.includes(lowerQuery);
    })
    .slice(0, 8)
    .map((m) => ({
      username: m.user?.username || '',
      displayName: m.user?.displayName || '',
      avatarUrl: m.user?.avatarUrl || null,
      isSpecial: false,
    }));

  const entries = [...specialEntries, ...memberEntries];

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
      if (entries[selectedIndex]) {
        onSelect(entries[selectedIndex].username);
      }
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
    <div ref={listRef} style={styles.container}>
      {entries.map((entry, i) => (
        <button
          key={entry.username}
          style={{
            ...styles.item,
            background: i === selectedIndex ? 'var(--bg-tertiary)' : 'transparent',
          }}
          onMouseEnter={() => setSelectedIndex(i)}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(entry.username);
          }}
        >
          {entry.isSpecial ? (
            <div style={styles.specialIcon}>@</div>
          ) : (
            <Avatar src={entry.avatarUrl} name={entry.displayName} size={24} />
          )}
          <span style={styles.username}>@{entry.username}</span>
          {!entry.isSpecial && entry.displayName !== entry.username && (
            <span style={styles.displayName}>{entry.displayName}</span>
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
  specialIcon: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: 'var(--accent)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    fontWeight: 700,
    flexShrink: 0,
  },
  username: {
    fontWeight: 600,
  },
  displayName: {
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
  },
};
