import { useState } from 'react';
import { X, Clock, MapPin, Check, HelpCircle, Mountain } from 'lucide-react';
import type { CalendarEvent } from '@crabac/shared';
import { api } from '../../lib/api.js';

interface Props {
  date: string; // YYYY-MM-DD
  events: CalendarEvent[];
  canManage: boolean;
  spaceId: string;
  onClose: () => void;
  onEventClick: (event: CalendarEvent) => void;
  onAddEvent: () => void;
}

const ACTIVITY_LABELS: Record<string, string> = {
  ride: 'Ride',
  run: 'Run',
  walk: 'Walk',
};

export function DayEventsPanel({ date, events, canManage, spaceId, onClose, onEventClick, onAddEvent }: Props) {
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
              <EventCard
                key={ev.id}
                ev={ev}
                spaceId={spaceId}
                onEventClick={onEventClick}
              />
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

function EventCard({ ev, spaceId, onEventClick }: {
  ev: CalendarEvent;
  spaceId: string;
  onEventClick: (event: CalendarEvent) => void;
}) {
  const [rsvpCounts, setRsvpCounts] = useState(ev.rsvpCounts ?? { going: 0, maybe: 0, notGoing: 0 });
  const [myRsvp, setMyRsvp] = useState<string | null>(ev.myRsvp ?? null);
  const [rsvpLoading, setRsvpLoading] = useState(false);

  const accentColor = ev.category?.color || 'var(--accent)';

  const handleRsvp = async (status: string) => {
    setRsvpLoading(true);
    try {
      if (status === 'none') {
        const result = await api<any>(`/spaces/${spaceId}/calendar/events/${ev.id}/rsvp`, {
          method: 'DELETE',
        });
        setRsvpCounts(result.rsvpCounts);
        setMyRsvp(null);
      } else {
        const result = await api<any>(`/spaces/${spaceId}/calendar/events/${ev.id}/rsvp`, {
          method: 'POST',
          body: JSON.stringify({ status }),
        });
        setRsvpCounts(result.rsvpCounts);
        setMyRsvp(status);
      }
    } catch { /* ignore */ }
    setRsvpLoading(false);
  };

  return (
    <div
      style={{ ...styles.eventCard, borderLeftColor: accentColor }}
    >
      {/* Header image */}
      {ev.imageUrl && (
        <div style={styles.eventImage} onClick={() => onEventClick(ev)}>
          <img
            src={ev.imageUrl}
            alt={ev.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      )}

      {/* Clickable content area */}
      <div style={styles.eventContent} onClick={() => onEventClick(ev)}>
        {/* Event name */}
        <div style={styles.eventName}>
          <span style={{ ...styles.nameAccent, background: accentColor }} />
          {ev.name}
        </div>

        {/* Time + Location + Activity Type */}
        <div style={styles.metaRow}>
          {ev.eventTime && (
            <span style={styles.metaItem}>
              <Clock size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              {ev.eventTime}
            </span>
          )}
          {ev.location && (
            <span style={styles.metaItem}>
              <MapPin size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <span style={styles.metaText}>{ev.location}</span>
            </span>
          )}
          {ev.activityType && (
            <span style={styles.activityBadge}>
              {ACTIVITY_LABELS[ev.activityType] || ev.activityType}
            </span>
          )}
        </div>

        {/* Route info */}
        {ev.route && (
          <div style={styles.routeRow}>
            <Mountain size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span style={styles.routeName}>{ev.route.name}</span>
            <span style={styles.routeStat}>{ev.route.distanceKm.toFixed(1)} km</span>
            <span style={styles.routeStat}>+{ev.route.elevationGainM} m</span>
          </div>
        )}
      </div>

      {/* RSVP buttons */}
      <div style={styles.rsvpRow}>
        <CompactRsvpButton
          icon={<Check size={11} />}
          label="Going"
          count={rsvpCounts.going}
          active={myRsvp === 'going'}
          disabled={rsvpLoading}
          onClick={() => handleRsvp(myRsvp === 'going' ? 'none' : 'going')}
          color="var(--success, #43b581)"
        />
        <CompactRsvpButton
          icon={<HelpCircle size={11} />}
          label="Maybe"
          count={rsvpCounts.maybe}
          active={myRsvp === 'maybe'}
          disabled={rsvpLoading}
          onClick={() => handleRsvp(myRsvp === 'maybe' ? 'none' : 'maybe')}
          color="#faa61a"
        />
        <CompactRsvpButton
          icon={<X size={11} />}
          label="Can't Go"
          count={rsvpCounts.notGoing}
          active={myRsvp === 'not_going'}
          disabled={rsvpLoading}
          onClick={() => handleRsvp(myRsvp === 'not_going' ? 'none' : 'not_going')}
          color="var(--danger, #ed4245)"
        />
      </div>
    </div>
  );
}

function CompactRsvpButton({ icon, label, count, active, disabled, onClick, color }: {
  icon: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        padding: '3px 8px',
        borderRadius: 'var(--radius)',
        border: `1px solid ${active ? color : 'var(--border)'}`,
        background: active ? `${color}22` : 'transparent',
        color: active ? color : 'var(--text-secondary)',
        cursor: disabled ? 'default' : 'pointer',
        fontSize: '0.7rem',
        fontWeight: 600,
        opacity: disabled ? 0.6 : 1,
        lineHeight: 1,
      }}
    >
      {icon}
      {label}
      {count > 0 && <span style={{ marginLeft: 1 }}>({count})</span>}
    </button>
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
    width: 420,
    maxWidth: '90vw',
    maxHeight: '70vh',
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
    gap: 8,
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

  // Event card styles
  eventCard: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderLeft: '4px solid var(--accent)',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
  },
  eventImage: {
    height: 80,
    overflow: 'hidden',
    cursor: 'pointer',
  },
  eventContent: {
    padding: '8px 12px 4px',
    cursor: 'pointer',
  },
  eventName: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: '0.9rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  nameAccent: {
    display: 'inline-block',
    width: 3,
    height: 14,
    borderRadius: 2,
    flexShrink: 0,
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 140,
  },
  activityBadge: {
    display: 'inline-block',
    padding: '1px 7px',
    borderRadius: 10,
    fontSize: '0.65rem',
    fontWeight: 600,
    color: '#fff',
    background: 'var(--accent)',
  },
  routeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    fontSize: '0.72rem',
    color: 'var(--text-secondary)',
  },
  routeName: {
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 160,
  },
  routeStat: {
    color: 'var(--text-muted)',
  },
  rsvpRow: {
    display: 'flex',
    gap: 5,
    padding: '6px 12px 8px',
    borderTop: '1px solid var(--border)',
    marginTop: 4,
  },
};
