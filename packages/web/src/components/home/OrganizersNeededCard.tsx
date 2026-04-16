import { useEffect, useState } from 'react';
import { UserCheck, MapPin } from 'lucide-react';
import type { CalendarEvent } from '@crabac/shared';
import { api } from '../../lib/api.js';

type AggregatedEvent = CalendarEvent & {
  spaceName?: string | null;
  spaceSlug?: string | null;
  spaceIconUrl?: string | null;
};

interface Props {
  onEventClick: (event: AggregatedEvent) => void;
}

function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const eventDay = new Date(d);
  eventDay.setHours(0, 0, 0, 0);

  if (eventDay.getTime() === today.getTime()) return 'Today';
  if (eventDay.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const ACTIVITY_LABELS: Record<string, string> = { ride: 'Ride', run: 'Run', walk: 'Walk' };

export function OrganizersNeededCard({ onEventClick }: Props) {
  const [events, setEvents] = useState<AggregatedEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<AggregatedEvent[]>('/users/me/events/needing-organizer?limit=10')
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || events.length === 0) return null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <UserCheck size={16} />
        <span style={styles.headerText}>Organizers Needed</span>
        <span style={styles.count}>{events.length}</span>
      </div>
      <div style={styles.list}>
        {events.map((event) => (
          <button
            key={event.id}
            onClick={() => onEventClick(event)}
            style={styles.card}
          >
            <div style={styles.cardTopRow}>
              <span style={styles.dateLabel}>
                {formatEventDate(event.eventDate)}
                {event.eventTime && <span> &middot; {event.eventTime}</span>}
              </span>
              {event.spaceName && (
                <span style={styles.spaceBadge}>{event.spaceName}</span>
              )}
            </div>
            <div style={styles.cardName}>{event.name}</div>
            <div style={styles.metaRow}>
              {event.location && (
                <span style={styles.metaItem}>
                  <MapPin size={11} /> {event.location}
                </span>
              )}
              {event.activityType && (
                <span style={styles.activityBadge}>
                  {ACTIVITY_LABELS[event.activityType] || event.activityType}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: '#3a2222',
    padding: '0 1.5rem',
  },
  headerText: {
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    flex: 1,
    color: '#3a2222',
  },
  count: {
    fontSize: '0.7rem',
    fontWeight: 600,
    background: '#fab005',
    color: '#000',
    padding: '1px 7px',
    borderRadius: 10,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '0 1.5rem',
  },
  card: {
    background: 'white',
    border: '1px solid rgba(0,0,0,0.1)',
    borderLeft: '3px solid #fab005',
    borderRadius: 'var(--radius)',
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    cursor: 'pointer',
    color: '#2e1a1a',
    textAlign: 'left',
    fontFamily: 'inherit',
  },
  cardTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  dateLabel: {
    fontSize: '0.7rem',
    fontWeight: 600,
    color: '#7a5a5a',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  spaceBadge: {
    fontSize: '0.65rem',
    fontWeight: 600,
    color: '#7a5a5a',
    background: 'rgba(0,0,0,0.06)',
    padding: '1px 6px',
    borderRadius: 8,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 120,
  },
  cardName: {
    fontSize: '0.9rem',
    fontWeight: 700,
    color: '#2e1a1a',
    lineHeight: 1.3,
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    fontSize: '0.72rem',
    color: '#5a3a3a',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
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
};
