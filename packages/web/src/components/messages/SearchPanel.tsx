import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useMessagesStore } from '../../stores/messages.js';
import { useNavigate } from 'react-router-dom';
import type { SearchResult } from '@crabac/shared';

interface Props {
  spaceId: string;
}

export function SearchPanel({ spaceId }: Props) {
  const { searchResults, searchQuery, search, clearSearch } = useMessagesStore();
  const [query, setQuery] = useState(searchQuery);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounced search-as-you-type
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) return;

    debounceRef.current = setTimeout(() => {
      search(spaceId, query.trim());
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, spaceId, search]);

  const goToMessage = (result: SearchResult) => {
    navigate(`/space/${spaceId}/channel/${result.channelId}`);
    clearSearch();
  };

  // Extract pure search terms (excluding operators) for highlighting
  const highlightTerms = searchQuery
    .replace(/from:\S+/gi, '')
    .replace(/in:\S+/gi, '')
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={{ fontWeight: 700 }}>Search</span>
        <button onClick={clearSearch} style={styles.closeBtn}><X size={18} /></button>
      </div>

      <div style={styles.searchForm}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search messages... (from:user in:channel)"
          style={styles.searchInput}
          autoFocus
        />
      </div>

      <div style={styles.results}>
        {searchResults.length === 0 && searchQuery && (
          <div style={styles.empty}>No results found for &ldquo;{searchQuery}&rdquo;</div>
        )}
        {searchResults.map((result) => (
          <button
            key={result.id}
            style={styles.resultItem}
            onClick={() => goToMessage(result)}
          >
            <div style={styles.resultHeader}>
              <strong style={{ fontSize: '0.85rem' }}>{result.author?.displayName || 'Unknown'}</strong>
              <span style={styles.channelTag}>#{result.channelName}</span>
              <span style={styles.timestamp}>{formatDate(result.id)}</span>
            </div>
            <div style={styles.resultContent}>
              <HighlightedText text={result.content} terms={highlightTerms} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function HighlightedText({ text, terms }: { text: string; terms: string[] }) {
  if (terms.length === 0) return <>{text}</>;

  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) => {
        const isMatch = terms.some((t) => part.toLowerCase() === t.toLowerCase());
        return isMatch ? (
          <mark key={i} style={{ background: 'rgba(88, 101, 242, 0.3)', color: 'inherit', borderRadius: 2, padding: '0 1px' }}>{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </>
  );
}

function formatDate(snowflakeId: string): string {
  const EPOCH = 1735689600000;
  try {
    const id = BigInt(snowflakeId);
    const timestamp = Number(id >> 22n) + EPOCH;
    return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: 380,
    borderLeft: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '1rem',
    padding: '4px',
  },
  searchForm: {
    padding: '8px 16px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  searchInput: {
    width: '100%',
    padding: '8px 12px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    outline: 'none',
  },
  results: {
    flex: 1,
    overflowY: 'auto',
    padding: 8,
  },
  empty: {
    color: 'var(--text-muted)',
    textAlign: 'center',
    padding: '2rem 1rem',
    fontSize: '0.9rem',
  },
  resultItem: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '10px 12px',
    background: 'var(--bg-primary)',
    border: 'none',
    borderRadius: 'var(--radius)',
    marginBottom: 6,
    cursor: 'pointer',
    color: 'var(--text-primary)',
  },
  resultHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  channelTag: {
    fontSize: '0.75rem',
    color: 'var(--accent)',
    background: 'rgba(88, 101, 242, 0.1)',
    padding: '1px 6px',
    borderRadius: 4,
  },
  timestamp: {
    color: 'var(--text-muted)',
    fontSize: '0.7rem',
    marginLeft: 'auto',
  },
  resultContent: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
};
