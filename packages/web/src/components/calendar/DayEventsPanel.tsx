import { X } from 'lucide-react';
import type { CalendarEvent } from '@crabac/shared';

interface Props {
  date: string; // YYYY-MM-DD
  events: CalendarEvent[];
  canManage: boolean;
  onClose: () => void;
  onEventClick: (event: CalendarEvent) => void;
  onAddEvent: () => void;
}

export function DayEventsPanel({ date, events, canManage, onClose, onEventClick, onAddEvent }: Props) {
  const d = new Date(date + 'T00:00:00');
  const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>{label}</h3>
          <button onClick={onClose} style={styles.closeBtn}><X size={18} /></button>
        </div>
        <div style={styles.body}>
          {events.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>
              No events on this day
            </p>
          ) : (
            events.map((ev) => (
              <button
                key={ev.id}
                onClick={() => onEventClick(ev)}
                style={styles.eventRow}
              >
                <span
                  style={{
                    ...styles.dot,
                    background: ev.category?.color || 'var(--accent)',
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.eventName}>{ev.name}</div>
                  <div style={styles.eventMeta}>
                    {ev.eventTime && <span>{ev.eventTime}</span>}
                    {ev.category && <span>{ev.category.name}</span>}
                  </div>
                </div>
              </button>
            ))
          )}
          {canManage && (
            <button onClick={onAddEvent} style={styles.addBtn}>
              + Add Event
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  panel: {
    background: 'var(--bg-primary)',
    borderRadius: 'var(--radius)',
    width: 380,
    maxWidth: '90vw',
    maxHeight: '60vh',
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
    padding: '8px 12px 12px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  eventRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 10px',
    background: 'none',
    border: 'none',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    color: 'var(--text-primary)',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
  eventName: {
    fontSize: '0.9rem',
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  eventMeta: {
    display: 'flex',
    gap: 8,
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  addBtn: {
    marginTop: 4,
    padding: '8px 12px',
    background: 'var(--bg-tertiary)',
    border: 'none',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    cursor: 'pointer',
    textAlign: 'center',
  },
};
