import { useState, useEffect } from 'react';
import { Check, HelpCircle, Calendar, MapPin, ChevronDown, ChevronRight, UserCheck } from 'lucide-react';
import type { CalendarEvent } from '@crabac/shared';
import { Permissions } from '@crabac/shared';
import { useCalendarStore } from '../../stores/calendar.js';
import { usePreferencesStore } from '../../stores/preferences.js';
import { formatDistance } from '../../lib/units.js';
import { useHasSpacePermission } from '../settings/SpaceSettingsModal.js';

interface Props {
  spaceId: string;
  events: CalendarEvent[];
  loading: boolean;
  onEventClick: (event: CalendarEvent) => void;
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

function EventRow({
  event,
  spaceId,
  onEventClick,
}: {
  event: CalendarEvent;
  spaceId: string;
  onEventClick: (event: CalendarEvent) => void;
}) {
  const units = usePreferencesStore((s) => s.preferences.distanceUnits);
  const rsvp = useCalendarStore((s) => s.rsvp);

  const handleQuickRsvp = async (e: React.MouseEvent, status: 'going' | 'maybe') => {
    e.stopPropagation();
    try { await rsvp(spaceId, event.id, status); } catch { /* ignore */ }
  };

  return (
    <button
      onClick={() => onEventClick(event)}
      style={{
        ...styles.card,
        ...(event.imageUrl ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.75)), url(${event.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
      }}
    >
      <div style={styles.cardTop}>
        <span style={{ ...styles.dateLabel, ...(event.imageUrl ? { color: 'rgba(255,255,255,0.85)' } : {}) }}>
          {formatEventDate(event.eventDate)}
          {event.eventTime && <span> &middot; {event.eventTime}</span>}
        </span>
        {event.category && (
          <span style={{ ...styles.badge, background: event.category.color }}>{event.category.name}</span>
        )}
      </div>
      <span style={{ ...styles.eventName, ...(event.imageUrl ? { color: '#fff' } : {}) }}>{event.name}</span>
      {event.location && (
        <span style={{ ...styles.locationText, ...(event.imageUrl ? { color: 'rgba(255,255,255,0.7)' } : {}) }}>
          <MapPin size={11} /> {event.location}
        </span>
      )}
      {event.route && (
        <span style={{ ...styles.locationText, ...(event.imageUrl ? { color: 'rgba(255,255,255,0.7)' } : {}) }}>
          {event.route.name} &middot; {formatDistance(event.route.distanceKm, units)}
        </span>
      )}
      {event.organizerNeeded ? (
        <span style={{ ...styles.locationText, color: '#fab005' }}>
          <UserCheck size={11} /> Organizer needed
        </span>
      ) : null}
      <div style={styles.cardBottom}>
        <div style={styles.rsvpCounts}>
          {(event.rsvpCounts?.going || 0) > 0 && (
            <span style={{ ...styles.rsvpCount, color: '#43b581' }}>
              <Check size={11} /> {event.rsvpCounts!.going}
            </span>
          )}
          {(event.rsvpCounts?.maybe || 0) > 0 && (
            <span style={{ ...styles.rsvpCount, color: '#fab005' }}>
              <HelpCircle size={11} /> {event.rsvpCounts!.maybe}
            </span>
          )}
        </div>
        <div style={styles.quickRsvp}>
          <button
            onClick={(e) => handleQuickRsvp(e, 'going')}
            style={{ ...styles.quickBtn, ...(event.myRsvp === 'going' ? { background: 'rgba(67,181,129,0.25)', borderColor: '#43b581', color: '#43b581' } : {}), ...(event.imageUrl ? { borderColor: 'rgba(255,255,255,0.3)', color: event.myRsvp === 'going' ? '#43b581' : 'rgba(255,255,255,0.8)' } : {}) }}
          >
            <Check size={12} />
          </button>
          <button
            onClick={(e) => handleQuickRsvp(e, 'maybe')}
            style={{ ...styles.quickBtn, ...(event.myRsvp === 'maybe' ? { background: 'rgba(250,176,5,0.25)', borderColor: '#fab005', color: '#fab005' } : {}), ...(event.imageUrl ? { borderColor: 'rgba(255,255,255,0.3)', color: event.myRsvp === 'maybe' ? '#fab005' : 'rgba(255,255,255,0.8)' } : {}) }}
          >
            <HelpCircle size={12} />
          </button>
        </div>
      </div>
    </button>
  );
}

export function UpcomingEventsList({ spaceId, events, loading, onEventClick }: Props) {
  const canClaim = useHasSpacePermission(spaceId, Permissions.CLAIM_EVENTS);
  const organizerNeededEvents = useCalendarStore((s) => s.organizerNeededEvents);
  const organizerNeededLoading = useCalendarStore((s) => s.organizerNeededLoading);
  const fetchOrganizerNeeded = useCalendarStore((s) => s.fetchOrganizerNeeded);

  const [upcomingOpen, setUpcomingOpen] = useState(true);
  const [neededOpen, setNeededOpen] = useState(true);

  useEffect(() => {
    if (canClaim) fetchOrganizerNeeded(spaceId);
  }, [spaceId, canClaim, fetchOrganizerNeeded]);

  return (
    <div style={styles.container}>
      <button
        style={styles.sectionHeader}
        onClick={() => setUpcomingOpen((v) => !v)}
      >
        {upcomingOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Calendar size={16} />
        <span style={styles.headerText}>Upcoming Events</span>
        <span style={styles.count}>{events.length}</span>
      </button>
      {upcomingOpen && (
        <div style={styles.list}>
          {loading ? (
            <div style={styles.empty}>Loading...</div>
          ) : events.length === 0 ? (
            <div style={styles.empty}>No upcoming events</div>
          ) : (
            events.map((event) => (
              <EventRow key={event.id} event={event} spaceId={spaceId} onEventClick={onEventClick} />
            ))
          )}
        </div>
      )}

      {canClaim && (
        <>
          <button
            style={styles.sectionHeader}
            onClick={() => setNeededOpen((v) => !v)}
          >
            {neededOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <UserCheck size={16} />
            <span style={styles.headerText}>Organizers Needed</span>
            <span style={styles.count}>{organizerNeededEvents.length}</span>
          </button>
          {neededOpen && (
            <div style={styles.list}>
              {organizerNeededLoading ? (
                <div style={styles.empty}>Loading...</div>
              ) : organizerNeededEvents.length === 0 ? (
                <div style={styles.empty}>No events waiting for an organizer</div>
              ) : (
                organizerNeededEvents.map((event) => (
                  <EventRow key={event.id} event={event} spaceId={spaceId} onEventClick={onEventClick} />
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
    overflowY: 'auto',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    borderBottom: '1px solid var(--border)',
    borderTop: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    flexShrink: 0,
    width: '100%',
    background: 'var(--bg-primary)',
    border: 'none',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: 'var(--border)',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
  },
  headerText: {
    fontSize: '0.85rem',
    fontWeight: 700,
    flex: 1,
  },
  count: {
    fontSize: '0.75rem',
    fontWeight: 600,
    background: 'var(--bg-tertiary)',
    color: 'var(--text-muted)',
    padding: '1px 7px',
    borderRadius: 10,
  },
  list: {
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  empty: {
    textAlign: 'center',
    padding: 24,
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '10px 12px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    textAlign: 'left',
    color: 'inherit',
    transition: 'border-color 0.15s',
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  dateLabel: {
    fontSize: '0.72rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  badge: {
    display: 'inline-block',
    padding: '1px 6px',
    borderRadius: 8,
    fontSize: '0.65rem',
    color: '#fff',
    fontWeight: 600,
    flexShrink: 0,
  },
  eventName: {
    fontSize: '0.88rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    lineHeight: 1.3,
  },
  locationText: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  cardBottom: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  rsvpCounts: {
    display: 'flex',
    gap: 8,
  },
  rsvpCount: {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
    fontSize: '0.72rem',
    fontWeight: 600,
  },
  quickRsvp: {
    display: 'flex',
    gap: 4,
  },
  quickBtn: {
    width: 26,
    height: 26,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    background: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 0,
  },
};
