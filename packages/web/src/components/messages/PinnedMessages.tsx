import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useMessagesStore } from '../../stores/messages.js';
import { Markdown } from '../common/Markdown.js';
import type { Message } from '@gud/shared';

interface Props {
  channelId: string;
}

export function PinnedMessages({ channelId }: Props) {
  const { pinnedMessages, fetchPins, unpinMessage, togglePins } = useMessagesStore();

  useEffect(() => {
    fetchPins(channelId);
  }, [channelId, fetchPins]);

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={{ fontWeight: 700 }}>Pinned Messages</span>
        <button onClick={togglePins} style={styles.closeBtn}><X size={18} /></button>
      </div>
      <div style={styles.content}>
        {pinnedMessages.length === 0 ? (
          <div style={styles.empty}>No pinned messages in this channel</div>
        ) : (
          pinnedMessages.map((msg) => (
            <div key={msg.id} style={styles.item}>
              <div style={styles.itemHeader}>
                <strong>{msg.author?.displayName || 'Unknown'}</strong>
                <span style={styles.timestamp}>{formatDate(msg.id)}</span>
              </div>
              <div style={styles.itemContent}><Markdown content={msg.content} /></div>
              <button
                onClick={() => unpinMessage(channelId, msg.id)}
                style={styles.unpinBtn}
              >
                Unpin
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function formatDate(snowflakeId: string): string {
  const EPOCH = 1735689600000;
  try {
    const id = BigInt(snowflakeId);
    const timestamp = Number(id >> 22n) + EPOCH;
    return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: 340,
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
  content: {
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
  item: {
    padding: '10px 12px',
    background: 'var(--bg-primary)',
    borderRadius: 'var(--radius)',
    marginBottom: 8,
  },
  itemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    fontSize: '0.85rem',
  },
  timestamp: {
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
  },
  itemContent: {
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
  },
  unpinBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--danger)',
    fontSize: '0.75rem',
    cursor: 'pointer',
    marginTop: 6,
    padding: 0,
  },
};
