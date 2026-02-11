import { useState, useEffect, useRef, useCallback } from 'react';
import { SLASH_COMMANDS } from '../../lib/slashCommands.js';

interface Props {
  query: string;
  onSelect: (command: string) => void;
  onClose: () => void;
}

export function SlashCommandPalette({ query, onSelect, onClose }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const lowerQuery = query.toLowerCase();
  const filtered = SLASH_COMMANDS.filter((cmd) =>
    cmd.name.startsWith(lowerQuery),
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (filtered.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        onSelect(filtered[selectedIndex].name);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [filtered, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  if (filtered.length === 0) return null;

  return (
    <div ref={listRef} style={styles.container}>
      {filtered.map((cmd, i) => (
        <button
          key={cmd.name}
          style={{
            ...styles.item,
            background: i === selectedIndex ? 'var(--bg-tertiary)' : 'transparent',
          }}
          onMouseEnter={() => setSelectedIndex(i)}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(cmd.name);
          }}
        >
          <span style={styles.commandName}>/{cmd.name}</span>
          <span style={styles.commandDesc}>{cmd.description}</span>
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
    maxHeight: 200,
    overflowY: 'auto',
    zIndex: 50,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    textAlign: 'left',
    padding: '8px 12px',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
  },
  commandName: {
    fontWeight: 700,
    color: 'var(--accent)',
    whiteSpace: 'nowrap',
  },
  commandDesc: {
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
};
