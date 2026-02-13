import { useEffect, useRef, useCallback } from 'react';
import { ThreadCard } from './ThreadCard.js';
import type { ForumThreadSummary } from '@crabac/shared';

interface Props {
  threads: ForumThreadSummary[];
  loading: boolean;
  onThreadClick: (thread: ForumThreadSummary) => void;
  onLoadMore: (before: string) => void;
}

export function ThreadList({ threads, loading, onThreadClick, onLoadMore }: Props) {
  const observerRef = useRef<HTMLDivElement>(null);

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && threads.length > 0 && !loading) {
        const last = threads[threads.length - 1];
        onLoadMore(last.id);
      }
    },
    [threads, loading, onLoadMore],
  );

  useEffect(() => {
    const el = observerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleIntersect, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleIntersect]);

  if (loading && threads.length === 0) {
    return (
      <div style={styles.loading}>
        <span style={{ color: 'var(--text-muted)' }}>Loading threads...</span>
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div style={styles.empty}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          No threads yet. Start a discussion!
        </span>
      </div>
    );
  }

  return (
    <div style={styles.list}>
      {threads.map((thread) => (
        <ThreadCard
          key={thread.id}
          thread={thread}
          onClick={() => onThreadClick(thread)}
        />
      ))}
      <div ref={observerRef} style={{ height: 1 }} />
      {loading && (
        <div style={{ textAlign: 'center', padding: 12, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Loading more...
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '0 16px 16px',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
  },
};
