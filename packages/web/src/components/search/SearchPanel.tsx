import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMessagesStore } from '../../stores/messages.js';
import { useDMStore } from '../../stores/dm.js';
import { useChannelsStore } from '../../stores/channels.js';
import { useSpacesStore } from '../../stores/spaces.js';
import type { SearchResult } from '@crabac/shared';

interface Props {
  mode: 'space' | 'dm';
  spaceId?: string;
  channelId?: string;
  channelName?: string;
  conversationId?: string;
  onClose: () => void;
}

interface FilterChip {
  type: 'in' | 'from';
  value: string;
  label: string;
}

export function SearchPanel({ mode, spaceId, channelId, channelName, conversationId, onClose }: Props) {
  const navigate = useNavigate();

  // Space search state
  const {
    searchResults, searchQuery, search: spaceSearch,
    searchFilters, setSearchFilters,
  } = useMessagesStore();

  // DM search state
  const {
    dmSearchResults, dmSearchQuery, searchDMs, dmSearchConversationId,
    setDMSearchConversationId,
  } = useDMStore();

  // Channel/member lists for autocomplete
  const channels = useChannelsStore((s) => s.channels);
  const members = useSpacesStore((s) => s.members);

  // Active filters
  const [filters, setFilters] = useState<FilterChip[]>(() => {
    const initial: FilterChip[] = [];
    if (mode === 'space' && channelId && channelName) {
      initial.push({ type: 'in', value: channelId, label: channelName });
    }
    return initial;
  });

  // DM scope toggle
  const [dmScope, setDmScope] = useState<'conversation' | 'all'>(conversationId ? 'conversation' : 'all');

  const [query, setQuery] = useState('');
  const [autocomplete, setAutocomplete] = useState<{ type: 'in' | 'from'; items: { id: string; label: string }[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Initialize DM conversation scope
  useEffect(() => {
    if (mode === 'dm' && conversationId && dmScope === 'conversation') {
      setDMSearchConversationId(conversationId);
    } else if (mode === 'dm' && dmScope === 'all') {
      setDMSearchConversationId(undefined);
    }
  }, [mode, conversationId, dmScope, setDMSearchConversationId]);

  // Detect operator typing for autocomplete
  useEffect(() => {
    const match = query.match(/(?:^|\s)(in|from):(\S*)$/i);
    if (!match) {
      setAutocomplete(null);
      return;
    }

    const opType = match[1].toLowerCase() as 'in' | 'from';
    const partial = match[2].toLowerCase().replace(/^#/, '');

    if (opType === 'in' && mode === 'space') {
      const filtered = channels
        .filter((c) => c.name.toLowerCase().includes(partial))
        .slice(0, 8)
        .map((c) => ({ id: c.id, label: c.name }));
      setAutocomplete({ type: 'in', items: filtered });
    } else if (opType === 'from') {
      if (mode === 'space') {
        const filtered = members
          .filter((m) => m.user?.username?.toLowerCase().includes(partial))
          .slice(0, 8)
          .map((m) => ({ id: m.userId, label: m.user?.username || '' }));
        setAutocomplete({ type: 'from', items: filtered });
      } else {
        // DM mode: show conversation participants
        const conversations = useDMStore.getState().conversations;
        const conv = conversationId
          ? conversations.find((c) => c.id === conversationId)
          : null;
        const participants = conv?.participants || [];
        const filtered = participants
          .filter((p) => p.username.toLowerCase().includes(partial))
          .slice(0, 8)
          .map((p) => ({ id: p.id, label: p.username }));
        setAutocomplete({ type: 'from', items: filtered });
      }
    } else {
      setAutocomplete(null);
    }
  }, [query, mode, channels, members, conversationId]);

  // Build search query with filters
  const executeSearch = (rawQuery: string, activeFilters: FilterChip[]) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      // Build operator string from filters
      let fullQuery = rawQuery.trim();

      const fromFilter = activeFilters.find((f) => f.type === 'from');
      const inFilter = activeFilters.find((f) => f.type === 'in');

      if (mode === 'space' && spaceId) {
        // Build query with operators for space search
        let q = fullQuery;
        if (fromFilter) q = `from:${fromFilter.label} ${q}`.trim();
        if (inFilter) q = `in:${inFilter.label} ${q}`.trim();
        spaceSearch(spaceId, q);
      } else if (mode === 'dm') {
        if (fullQuery) {
          searchDMs(fullQuery, dmScope === 'conversation' ? conversationId : undefined);
        }
      }
    }, 300);
  };

  // Re-search when query or filters change
  useEffect(() => {
    if (query.trim() || filters.length > 0) {
      executeSearch(query, filters);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, filters, dmScope]);

  const selectAutocomplete = (item: { id: string; label: string }) => {
    if (!autocomplete) return;

    // Remove the operator text from query
    const cleaned = query.replace(/(?:^|\s)(in|from):\S*$/i, '').trim();
    setQuery(cleaned);

    // Add as filter chip (replace existing of same type)
    setFilters((prev) => {
      const next = prev.filter((f) => f.type !== autocomplete.type);
      next.push({ type: autocomplete.type, value: item.id, label: item.label });
      return next;
    });

    setAutocomplete(null);
    inputRef.current?.focus();
  };

  const removeFilter = (type: 'in' | 'from') => {
    setFilters((prev) => prev.filter((f) => f.type !== type));
  };

  const results = mode === 'space' ? searchResults : dmSearchResults;
  const currentQuery = mode === 'space' ? searchQuery : dmSearchQuery;

  // Highlight terms
  const highlightTerms = useMemo(() => {
    const q = (mode === 'space' ? searchQuery : dmSearchQuery)
      .replace(/from:\S+/gi, '')
      .replace(/in:\S+/gi, '')
      .trim()
      .split(/\s+/)
      .filter((t) => t.length > 0);
    return q;
  }, [mode, searchQuery, dmSearchQuery]);

  const goToResult = (result: any) => {
    if (mode === 'space' && spaceId) {
      navigate(`/space/${spaceId}/channel/${result.channelId}`);
    } else if (mode === 'dm') {
      navigate(`/dm/${result.conversationId}`);
    }
    onClose();
  };

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={{ fontWeight: 700 }}>Search</span>
        <button onClick={onClose} style={styles.closeBtn}><X size={18} /></button>
      </div>

      {/* Filter chips */}
      {filters.length > 0 && (
        <div style={styles.chipsArea}>
          {filters.map((f) => (
            <span key={f.type} style={styles.chip}>
              {f.type === 'in' ? `in: #${f.label}` : `from: ${f.label}`}
              <button onClick={() => removeFilter(f.type)} style={styles.chipClose}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* DM scope toggle */}
      {mode === 'dm' && conversationId && (
        <div style={styles.scopeToggle}>
          <button
            onClick={() => setDmScope('conversation')}
            style={{ ...styles.scopeBtn, ...(dmScope === 'conversation' ? styles.scopeBtnActive : {}) }}
          >
            This conversation
          </button>
          <button
            onClick={() => setDmScope('all')}
            style={{ ...styles.scopeBtn, ...(dmScope === 'all' ? styles.scopeBtnActive : {}) }}
          >
            All messages
          </button>
        </div>
      )}

      {/* Search input */}
      <div style={styles.searchForm}>
        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mode === 'space' ? 'Search messages... (in: from:)' : 'Search messages...'}
            style={styles.searchInput}
            autoFocus
          />

          {/* Autocomplete dropdown */}
          {autocomplete && autocomplete.items.length > 0 && (
            <div style={styles.dropdown}>
              {autocomplete.items.map((item) => (
                <button
                  key={item.id}
                  style={styles.dropdownItem}
                  onClick={() => selectAutocomplete(item)}
                >
                  {autocomplete.type === 'in' ? '#' : '@'}{item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div style={styles.results}>
        {results.length === 0 && (currentQuery || query) && (
          <div style={styles.empty}>
            <Search size={32} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
            <div>No results found</div>
          </div>
        )}
        {results.map((result: any) => (
          <button
            key={result.id}
            style={styles.resultItem}
            onClick={() => goToResult(result)}
          >
            <div style={styles.resultHeader}>
              <strong style={{ fontSize: '0.85rem' }}>{result.author?.displayName || 'Unknown'}</strong>
              {mode === 'space' && result.channelName && (
                <span style={styles.channelTag}>#{result.channelName}</span>
              )}
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
  chipsArea: {
    display: 'flex',
    gap: 6,
    padding: '8px 16px 0',
    flexWrap: 'wrap' as const,
    flexShrink: 0,
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    background: 'rgba(88, 101, 242, 0.15)',
    color: 'var(--accent)',
    borderRadius: 12,
    fontSize: '0.8rem',
    fontWeight: 500,
  },
  chipClose: {
    background: 'none',
    border: 'none',
    color: 'var(--accent)',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
  },
  scopeToggle: {
    display: 'flex',
    gap: 4,
    padding: '8px 16px 0',
    flexShrink: 0,
  },
  scopeBtn: {
    flex: 1,
    padding: '4px 8px',
    fontSize: '0.75rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  scopeBtnActive: {
    background: 'var(--accent)',
    color: 'white',
    borderColor: 'var(--accent)',
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
  dropdown: {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    right: 0,
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    marginTop: 4,
    maxHeight: 200,
    overflowY: 'auto' as const,
    zIndex: 10,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  },
  dropdownItem: {
    display: 'block',
    width: '100%',
    textAlign: 'left' as const,
    padding: '8px 12px',
    border: 'none',
    background: 'none',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    cursor: 'pointer',
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
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
  },
  resultItem: {
    display: 'block',
    width: '100%',
    textAlign: 'left' as const,
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
