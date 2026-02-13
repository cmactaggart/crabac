import { useState } from 'react';
import { X, Pencil, Trash2, Send } from 'lucide-react';
import type { CalendarEvent } from '@crabac/shared';
import { useCalendarStore } from '../../stores/calendar.js';
import { useChannelsStore } from '../../stores/channels.js';
import { useMessagesStore } from '../../stores/messages.js';

interface Props {
  event: CalendarEvent;
  spaceId: string;
  canManage: boolean;
  onClose: () => void;
  onEdit: () => void;
}

export function EventDetailModal({ event, spaceId, canManage, onClose, onEdit }: Props) {
  const deleteEvent = useCalendarStore((s) => s.deleteEvent);
  const channels = useChannelsStore((s) => s.channels);
  const sendMessage = useMessagesStore((s) => s.sendMessage);

  const [showPost, setShowPost] = useState(false);
  const [postChannelId, setPostChannelId] = useState('');
  const [posting, setPosting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const textChannels = channels.filter((c) => c.type === 'text' && !c.isAdmin && !c.isPortal);

  const d = new Date(event.eventDate + 'T00:00:00');
  const dateLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const handleDelete = async () => {
    try {
      await deleteEvent(spaceId, event.id);
      onClose();
    } catch { /* ignore */ }
  };

  const handlePost = async () => {
    if (!postChannelId) return;
    setPosting(true);
    try {
      const embed = JSON.stringify({
        id: event.id,
        spaceId,
        name: event.name,
        eventDate: event.eventDate,
        eventTime: event.eventTime,
        description: event.description,
        categoryName: event.category?.name || null,
        categoryColor: event.category?.color || null,
      });
      await sendMessage(postChannelId, `[calendar-event:${embed}]`);
      setShowPost(false);
    } catch { /* ignore */ }
    setPosting(false);
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{event.name}</h3>
            {event.category && (
              <span style={{ ...styles.categoryBadge, background: event.category.color }}>
                {event.category.name}
              </span>
            )}
          </div>
          <button onClick={onClose} style={styles.closeBtn}><X size={18} /></button>
        </div>

        <div style={styles.body}>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Date</span>
            <span>{dateLabel}</span>
          </div>
          {event.eventTime && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Time</span>
              <span>{event.eventTime}</span>
            </div>
          )}
          {event.creator && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Created by</span>
              <span>{event.creator.displayName}</span>
            </div>
          )}
          {event.description && (
            <div style={{ marginTop: 8 }}>
              <span style={styles.detailLabel}>Description</span>
              <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                {event.description}
              </p>
            </div>
          )}

          {/* Post to Channel */}
          {!showPost ? (
            <button
              onClick={() => setShowPost(true)}
              style={styles.postBtn}
            >
              <Send size={14} /> Post to Channel
            </button>
          ) : (
            <div style={styles.postForm}>
              <label style={styles.detailLabel}>Channel</label>
              <select
                value={postChannelId}
                onChange={(e) => setPostChannelId(e.target.value)}
                style={styles.input}
              >
                <option value="">Select a channel...</option>
                {textChannels.map((c) => (
                  <option key={c.id} value={c.id}>#{c.name}</option>
                ))}
              </select>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                A rich event card will be posted to the channel.
              </span>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowPost(false)} style={styles.cancelBtn}>Cancel</button>
                <button
                  onClick={handlePost}
                  disabled={posting || !postChannelId}
                  style={styles.saveBtn}
                >
                  {posting ? 'Posting...' : 'Post'}
                </button>
              </div>
            </div>
          )}
        </div>

        {canManage && (
          <div style={styles.footer}>
            {confirmDelete ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleDelete} style={styles.dangerBtn}>Confirm Delete</button>
                <button onClick={() => setConfirmDelete(false)} style={styles.cancelBtn}>Cancel</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} style={styles.trashBtn}>
                <Trash2 size={14} /> Delete
              </button>
            )}
            <button onClick={onEdit} style={styles.editBtn}>
              <Pencil size={14} /> Edit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  modal: {
    background: 'var(--bg-primary)',
    borderRadius: 'var(--radius)',
    width: 480,
    maxWidth: '90vw',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '14px 16px',
    borderBottom: '1px solid var(--border)',
    gap: 12,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 4,
    borderRadius: 'var(--radius)',
    flexShrink: 0,
  },
  categoryBadge: {
    display: 'inline-block',
    marginTop: 4,
    padding: '2px 8px',
    borderRadius: 10,
    fontSize: '0.7rem',
    color: '#fff',
    fontWeight: 600,
  },
  body: {
    padding: '16px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  detailRow: {
    display: 'flex',
    gap: 12,
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
  },
  detailLabel: {
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
    minWidth: 80,
  },
  postBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    padding: '8px 12px',
    background: 'var(--bg-tertiary)',
    border: 'none',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  postForm: {
    marginTop: 8,
    padding: '12px',
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  input: {
    padding: '8px 12px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderTop: '1px solid var(--border)',
  },
  editBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 12px',
    background: 'var(--bg-tertiary)',
    border: 'none',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  trashBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: 'none',
    border: 'none',
    color: 'var(--danger)',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
  },
  dangerBtn: {
    padding: '6px 12px',
    background: 'var(--danger)',
    border: 'none',
    color: '#fff',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
  cancelBtn: {
    padding: '6px 12px',
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  saveBtn: {
    padding: '6px 12px',
    background: 'var(--accent)',
    border: 'none',
    borderRadius: 'var(--radius)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
};
