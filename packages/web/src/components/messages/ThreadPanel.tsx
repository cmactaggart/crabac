import { useState } from 'react';
import { X } from 'lucide-react';
import { useMessagesStore } from '../../stores/messages.js';
import { useAuthStore } from '../../stores/auth.js';
import { Markdown } from '../common/Markdown.js';
import type { Message } from '@gud/shared';

interface Props {
  channelId: string;
}

export function ThreadPanel({ channelId }: Props) {
  const { threadParent, threadReplies, closeThread, sendMessage } = useMessagesStore();
  const userId = useAuthStore((s) => s.user?.id);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  if (!threadParent) return null;

  const handleSend = async () => {
    const trimmed = content.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await sendMessage(channelId, trimmed, threadParent.id);
      setContent('');
    } catch {
      // keep content
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={{ fontWeight: 700 }}>Thread</span>
        <button onClick={closeThread} style={styles.closeBtn}><X size={18} /></button>
      </div>

      {/* Parent message */}
      <div style={styles.parentMsg}>
        <div style={styles.msgHeader}>
          <strong>{threadParent.author?.displayName || 'Unknown'}</strong>
          <span style={styles.timestamp}>{formatDate(threadParent.id)}</span>
        </div>
        <div style={styles.msgContent}><Markdown content={threadParent.content} /></div>
      </div>

      <div style={styles.divider}>
        {threadReplies.length} {threadReplies.length === 1 ? 'reply' : 'replies'}
      </div>

      {/* Replies */}
      <div style={styles.replies}>
        {threadReplies.map((msg) => (
          <div key={msg.id} style={styles.reply}>
            <div style={styles.replyAvatar}>
              {(msg.author?.displayName || '?').charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={styles.msgHeader}>
                <strong style={{ fontSize: '0.85rem' }}>{msg.author?.displayName || 'Unknown'}</strong>
                <span style={styles.timestamp}>{formatDate(msg.id)}</span>
              </div>
              <div style={styles.replyContent}><Markdown content={msg.content} /></div>
            </div>
          </div>
        ))}
      </div>

      {/* Reply input */}
      <div style={styles.inputArea}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Reply to thread..."
          rows={1}
          style={styles.textarea}
        />
        <button
          onClick={handleSend}
          disabled={!content.trim() || sending}
          style={{ ...styles.sendBtn, opacity: content.trim() ? 1 : 0.4 }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

function formatDate(snowflakeId: string): string {
  const EPOCH = 1735689600000;
  try {
    const id = BigInt(snowflakeId);
    const timestamp = Number(id >> 22n) + EPOCH;
    const date = new Date(timestamp);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
      ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
  parentMsg: {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  msgHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  timestamp: {
    color: 'var(--text-muted)',
    fontSize: '0.7rem',
  },
  msgContent: {
    fontSize: '0.9rem',
    lineHeight: 1.4,
    color: 'var(--text-primary)',
  },
  divider: {
    padding: '8px 16px',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  replies: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 16px',
  },
  reply: {
    display: 'flex',
    gap: 8,
    marginBottom: 12,
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'var(--bg-tertiary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    fontWeight: 700,
    flexShrink: 0,
  },
  replyContent: {
    fontSize: '0.85rem',
    lineHeight: 1.4,
    color: 'var(--text-primary)',
  },
  inputArea: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
    padding: '12px 16px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-input)',
    flexShrink: 0,
  },
  textarea: {
    flex: 1,
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    resize: 'none',
    outline: 'none',
    lineHeight: 1.4,
    maxHeight: 80,
    overflow: 'auto',
  },
  sendBtn: {
    background: 'var(--accent)',
    border: 'none',
    color: 'white',
    padding: '5px 12px',
    borderRadius: 'var(--radius)',
    fontWeight: 600,
    fontSize: '0.8rem',
    flexShrink: 0,
  },
};
