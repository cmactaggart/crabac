import { useState, useEffect, useRef, useCallback } from 'react';
import { useChannelsStore } from '../../stores/channels.js';
import { Hash } from 'lucide-react';

interface Props {
  query: string;
  onSelect: (channelName: string) => void;
  onClose: () => void;
}

export function ChannelAutocomplete({ query, onSelect, onClose }: Props) {
  const channels = useChannelsStore((s) => s.channels);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const lowerQuery = query.toLowerCase();

  const entries = channels
    .filter((ch) => ch.name.toLowerCase().includes(lowerQuery))
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
      if (entries[selectedIndex]) {
        onSelect(entries[selectedIndex].name);
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
      {entries.map((channel, i) => (
        <button
          key={channel.id}
          style={{
            ...styles.item,
            background: i === selectedIndex ? 'var(--bg-tertiary)' : 'transparent',
          }}
          onMouseEnter={() => setSelectedIndex(i)}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(channel.name);
          }}
        >
          <div style={styles.hashIcon}>
            <Hash size={14} />
          </div>
          <span style={styles.channelName}>{channel.name}</span>
          {channel.topic && (
            <span style={styles.topic}>{channel.topic}</span>
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
    textAlign: 'left' as const,
    padding: '6px 12px',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
  },
  hashIcon: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  channelName: {
    fontWeight: 600,
  },
  topic: {
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
};
