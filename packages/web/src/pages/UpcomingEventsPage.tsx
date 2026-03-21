import { useEffect, useState } from 'react';
import { ArrowLeft, Calendar, Clock, MapPin, Check, HelpCircle, X, Mountain } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { CalendarEvent } from '@crabac/shared';
import { useAuthStore } from '../stores/auth.js';
import { useSpacesStore } from '../stores/spaces.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { usePreferencesStore } from '../stores/preferences.js';
import { SpaceSidebar } from '../components/layout/SpaceSidebar.js';
import { EventDetailModal } from '../components/calendar/EventDetailModal.js';
import { MiniMap } from '../components/common/MiniMap.js';
import { formatDistance, formatElevation } from '../lib/units.js';
import { api } from '../lib/api.js';

type AggregatedEvent = CalendarEvent & {
  spaceName?: string | null;
  spaceSlug?: string | null;
  spaceIconUrl?: string | null;
};

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

function UpcomingEventsView() {
  const navigate = useNavigate();
  const units = usePreferencesStore((s) => s.preferences.distanceUnits);
  const [events, setEvents] = useState<AggregatedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<AggregatedEvent | null>(null);

  useEffect(() => {
    api<AggregatedEvent[]>('/users/me/events/upcoming?limit=50')
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleRsvp = async (eventId: string, spaceId: string, status: string) => {
    try {
      const result = await api<any>(`/spaces/${spaceId}/calendar/events/${eventId}/rsvp`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      setEvents((prev) => prev.map((e) =>
        e.id === eventId ? { ...e, rsvpCounts: result.rsvpCounts, myRsvp: status as any } : e,
      ));
    } catch { /* ignore */ }
  };

  // Group events by date
  const grouped = new Map<string, AggregatedEvent[]>();
  for (const event of events) {
    const existing = grouped.get(event.eventDate) || [];
    existing.push(event);
    grouped.set(event.eventDate, existing);
  }

  return (
    <div style={{ width: '100%', maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => navigate(-1)} style={styles.backBtn}>
          <ArrowLeft size={18} />
        </button>
        <Calendar size={20} style={{ color: 'var(--accent)' }} />
        <h1 style={{ margin: 0, fontSize: '1.2rem' }}>Upcoming Events</h1>
      </div>

      {loading && (
        <div style={styles.empty}>Loading...</div>
      )}

      {!loading && events.length === 0 && (
        <div style={styles.empty}>No upcoming events</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[...grouped.entries()].map(([date, dateEvents]) => (
          <div key={date}>
            <div style={styles.dateHeader}>{formatEventDate(date)}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dateEvents.map((event) => (
                <div key={event.id} style={styles.card}>
                  {/* Header image */}
                  {event.imageUrl && (
                    <div style={styles.cardImage} onClick={() => setSelectedEvent(event)}>
                      <img src={event.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}

                  <div style={styles.cardBody} onClick={() => setSelectedEvent(event)}>
                    <div style={styles.topRow}>
                      <span style={styles.timeLabel}>
                        {event.eventTime || 'All day'}
                      </span>
                      {event.spaceName && (
                        <span style={styles.spaceBadge}>{event.spaceName}</span>
                      )}
                    </div>

                    <div style={styles.eventName}>{event.name}</div>

                    <div style={styles.metaRow}>
                      {event.location && (
                        <span style={styles.metaItem}><MapPin size={11} /> {event.location}</span>
                      )}
                      {event.activityType && (
                        <span style={styles.activityBadge}>
                          {ACTIVITY_LABELS[event.activityType] || event.activityType}
                        </span>
                      )}
                      {event.category && (
                        <span style={{ ...styles.categoryBadge, background: event.category.color }}>
                          {event.category.name}
                        </span>
                      )}
                    </div>

                    {event.route && (
                      <div style={styles.routeSection}>
                        {event.route.geojson && (
                          <div style={{ height: 80, overflow: 'hidden' }}>
                            <MiniMap geojson={event.route.geojson} height={80} />
                          </div>
                        )}
                        <div style={styles.routeInfo}>
                          <Mountain size={11} style={{ color: 'var(--text-muted)' }} />
                          <span style={{ fontWeight: 600 }}>{event.route.name}</span>
                          <span style={{ color: 'var(--text-muted)' }}>{formatDistance(event.route.distanceKm, units)}</span>
                          {event.route.elevationGainM != null && (
                            <span style={{ color: 'var(--text-muted)' }}>+{formatElevation(event.route.elevationGainM, units)}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* RSVP row */}
                  <div style={styles.rsvpRow}>
                    {(['going', 'maybe', 'not_going'] as const).map((status) => {
                      const config = {
                        going: { icon: <Check size={11} />, label: 'Going', color: '#43b581', countKey: 'going' as const },
                        maybe: { icon: <HelpCircle size={11} />, label: 'Maybe', color: '#faa61a', countKey: 'maybe' as const },
                        not_going: { icon: <X size={11} />, label: "Can't Go", color: 'var(--danger, #ed4245)', countKey: 'notGoing' as const },
                      }[status];
                      const active = event.myRsvp === status;
                      const count = event.rsvpCounts?.[config.countKey] || 0;
                      return (
                        <button
                          key={status}
                          onClick={(e) => { e.stopPropagation(); handleRsvp(event.id, event.spaceId, active ? 'none' : status); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px',
                            borderRadius: 'var(--radius)', border: `1px solid ${active ? config.color : 'var(--border)'}`,
                            background: active ? `${config.color}22` : 'transparent',
                            color: active ? config.color : 'var(--text-secondary)',
                            cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, lineHeight: 1,
                          }}
                        >
                          {config.icon} {config.label}
                          {count > 0 && <span style={{ marginLeft: 1 }}>({count})</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          spaceId={selectedEvent.spaceId}
          canManage={false}
          onClose={() => setSelectedEvent(null)}
          onEdit={() => {}}
        />
      )}
    </div>
  );
}

export function UpcomingEventsPage() {
  const isMobile = useIsMobile();
  const { spaces, fetchSpaces } = useSpacesStore();

  useEffect(() => { fetchSpaces(); }, [fetchSpaces]);

  if (isMobile) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 56, overflowY: 'auto', padding: '1rem', background: 'linear-gradient(to bottom, var(--bg-primary), color-mix(in srgb, var(--bg-primary), black 18%))' }}>
        <UpcomingEventsView />
      </div>
    );
  }

  return (
    <div style={layoutStyles.layout}>
      <div style={layoutStyles.sidebarWrap}>
        <SpaceSidebar spaces={spaces} activeSpaceId={null} />
      </div>
      <div style={layoutStyles.main}>
        <UpcomingEventsView />
      </div>
    </div>
  );
}

const layoutStyles: Record<string, React.CSSProperties> = {
  layout: { display: 'flex', height: '100vh', overflow: 'hidden' },
  sidebarWrap: { overflow: 'hidden', flexShrink: 0, transition: 'width 0.2s ease', height: '100%' },
  main: { flex: 1, overflowY: 'auto', padding: '2rem', display: 'flex', justifyContent: 'center' },
};

const styles: Record<string, React.CSSProperties> = {
  backBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, borderRadius: 'var(--radius)',
    border: 'none', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer',
  },
  empty: {
    textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem',
  },
  dateHeader: {
    fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em',
    color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 2,
  },
  card: {
    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', overflow: 'hidden',
  },
  cardImage: { height: 120, overflow: 'hidden', cursor: 'pointer' },
  cardBody: { padding: '10px 14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4 },
  topRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  timeLabel: {
    fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)',
    display: 'flex', alignItems: 'center', gap: 4,
  },
  spaceBadge: {
    fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)',
    background: 'var(--bg-tertiary)', padding: '1px 6px', borderRadius: 8,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140,
  },
  eventName: {
    fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3,
  },
  metaRow: {
    display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8,
    fontSize: '0.75rem', color: 'var(--text-secondary)',
  },
  metaItem: { display: 'flex', alignItems: 'center', gap: 3 },
  activityBadge: {
    display: 'inline-block', padding: '1px 7px', borderRadius: 10,
    fontSize: '0.65rem', fontWeight: 600, color: '#fff', background: 'var(--accent)',
  },
  categoryBadge: {
    display: 'inline-block', padding: '1px 6px', borderRadius: 8,
    fontSize: '0.65rem', color: '#fff', fontWeight: 600,
  },
  routeSection: {
    borderRadius: 'var(--radius)', overflow: 'hidden', background: 'var(--bg-tertiary)',
  },
  routeInfo: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px',
    fontSize: '0.72rem', color: 'var(--text-secondary)',
  },
  rsvpRow: {
    display: 'flex', gap: 5, padding: '6px 14px 8px', borderTop: '1px solid var(--border)',
  },
};
