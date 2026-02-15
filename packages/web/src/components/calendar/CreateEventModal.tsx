import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useCalendarStore } from '../../stores/calendar.js';
import type { CalendarEvent } from '@crabac/shared';

interface Props {
  spaceId: string;
  prefillDate?: string; // YYYY-MM-DD
  editEvent?: CalendarEvent | null;
  onClose: () => void;
  onCreated?: (event: CalendarEvent) => void;
}

export function CreateEventModal({ spaceId, prefillDate, editEvent, onClose, onCreated }: Props) {
  const categories = useCalendarStore((s) => s.categories);
  const fetchCategories = useCalendarStore((s) => s.fetchCategories);
  const createEvent = useCalendarStore((s) => s.createEvent);
  const updateEvent = useCalendarStore((s) => s.updateEvent);

  useEffect(() => { fetchCategories(spaceId); }, [spaceId, fetchCategories]);

  const [name, setName] = useState(editEvent?.name || '');
  const [description, setDescription] = useState(editEvent?.description || '');
  const [eventDate, setEventDate] = useState(editEvent?.eventDate || prefillDate || '');
  const [eventTime, setEventTime] = useState(editEvent?.eventTime || '');
  const [categoryId, setCategoryId] = useState(editEvent?.categoryId || '');
  const [isPublic, setIsPublic] = useState(editEvent?.isPublic || false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !eventDate) return;
    setSaving(true);
    setError('');
    try {
      const data = {
        name: name.trim(),
        description: description.trim() || null,
        eventDate,
        eventTime: eventTime || null,
        categoryId: categoryId || null,
        isPublic,
      };

      if (editEvent) {
        await updateEvent(spaceId, editEvent.id, data);
      } else {
        const created = await createEvent(spaceId, data);
        onCreated?.(created);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>
            {editEvent ? 'Edit Event' : 'Create Event'}
          </h3>
          <button onClick={onClose} style={styles.closeBtn}><X size={18} /></button>
        </div>
        <div style={styles.body}>
          {error && <div style={styles.error}>{error}</div>}

          <label style={styles.label}>Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Event name"
            style={styles.input}
            autoFocus
          />

          <label style={styles.label}>Date</label>
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            style={styles.input}
          />

          <label style={styles.label}>Time (optional)</label>
          <input
            type="time"
            value={eventTime}
            onChange={(e) => setEventTime(e.target.value)}
            style={styles.input}
          />

          <label style={styles.label}>Category (optional)</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            style={styles.input}
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <label style={{ ...styles.label, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 4 }}>
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              style={{ margin: 0 }}
            />
            <span style={{ textTransform: 'none', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>Make Public</span>
          </label>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: -4 }}>
            Visible on the public calendar web view
          </span>

          <label style={styles.label}>Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Event description..."
            style={{ ...styles.input, minHeight: 80, resize: 'vertical' }}
          />
        </div>
        <div style={styles.footer}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={saving || !name.trim() || !eventDate}
            style={styles.saveBtn}
          >
            {saving ? 'Saving...' : editEvent ? 'Save' : 'Create'}
          </button>
        </div>
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
    width: 440,
    maxWidth: '90vw',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 16px',
    borderBottom: '1px solid var(--border)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 4,
    borderRadius: 'var(--radius)',
  },
  body: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    overflowY: 'auto',
  },
  label: {
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
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
    fontFamily: 'inherit',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    padding: '12px 16px',
    borderTop: '1px solid var(--border)',
  },
  cancelBtn: {
    padding: '8px 16px',
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  saveBtn: {
    padding: '8px 16px',
    background: 'var(--accent)',
    border: 'none',
    borderRadius: 'var(--radius)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
  error: {
    background: 'rgba(237, 66, 69, 0.15)',
    color: 'var(--danger)',
    padding: '8px 12px',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
  },
};
