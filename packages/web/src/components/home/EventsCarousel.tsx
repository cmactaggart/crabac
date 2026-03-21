import { useEffect, useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Check, HelpCircle, X, Clock, MapPin, Mountain, Calendar } from 'lucide-react';
import type { CalendarEvent } from '@crabac/shared';
import { usePreferencesStore } from '../../stores/preferences.js';
import { formatDistance, formatElevation } from '../../lib/units.js';
import { MiniMap } from '../common/MiniMap.js';
import { api } from '../../lib/api.js';

type AggregatedEvent = CalendarEvent & {
  spaceName?: string | null;
  spaceSlug?: string | null;
  spaceIconUrl?: string | null;
  spaceBaseColor?: string | null;
  spaceAccentColor?: string | null;
};

interface Props {
  onEventClick: (event: AggregatedEvent) => void;
  onShowMore: () => void;
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

export function EventsCarousel({ onEventClick, onShowMore }: Props) {
  const [events, setEvents] = useState<AggregatedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  // Touch swipe state
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const swiping = useRef(false);

  useEffect(() => {
    api<AggregatedEvent[]>('/users/me/events/upcoming?limit=20')
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const prev = () => setCurrentIndex((i) => Math.max(0, i - 1));
  const next = () => setCurrentIndex((i) => Math.min(events.length - 1, i + 1));

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
    swiping.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.touches[0].clientX - touchStartX.current;
    touchDeltaX.current = delta;
    // Only start swiping after a small horizontal threshold to avoid hijacking vertical scroll
    if (Math.abs(delta) > 10) swiping.current = true;
    if (swiping.current) setSwipeOffset(delta);
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null) return;
    const threshold = 50;
    if (touchDeltaX.current < -threshold && currentIndex < events.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else if (touchDeltaX.current > threshold && currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
    touchStartX.current = null;
    touchDeltaX.current = 0;
    swiping.current = false;
    setSwipeOffset(0);
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <Calendar size={16} />
          <span style={styles.headerText}>Upcoming Events</span>
        </div>
        <div style={styles.empty}>Loading...</div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <Calendar size={16} />
          <span style={styles.headerText}>Upcoming Events</span>
        </div>
        <div style={styles.empty}>No upcoming events</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <Calendar size={16} />
        <span style={styles.headerText}>Upcoming Events</span>
        <span style={styles.count}>{events.length}</span>
      </div>

      {/* Carousel */}
      <div
        style={styles.carouselWrap}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {events.length > 1 && currentIndex > 0 && (
          <button onClick={prev} style={{ ...styles.navBtn, left: 6 }}>
            <ChevronLeft size={18} />
          </button>
        )}

        <div ref={trackRef} style={styles.carouselTrack}>
          <div style={{
            transform: `translateX(calc(-${currentIndex * 100}% + ${swipeOffset}px))`,
            transition: swipeOffset ? 'none' : 'transform 0.3s ease',
            display: 'flex',
            width: '100%',
          }}>
            {events.map((event) => (
              <div key={event.id} style={{ minWidth: '100%', boxSizing: 'border-box' }}>
                <EventCarouselCard event={event} onClick={() => onEventClick(event)} />
              </div>
            ))}
          </div>
        </div>

        {events.length > 1 && currentIndex < events.length - 1 && (
          <button onClick={next} style={{ ...styles.navBtn, right: 6 }}>
            <ChevronRight size={18} />
          </button>
        )}
      </div>

      {/* Dots indicator */}
      {events.length > 1 && (
        <div style={styles.dots}>
          {events.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              style={{
                ...styles.dot,
                background: i === currentIndex ? 'var(--accent)' : 'var(--border)',
              }}
            />
          ))}
        </div>
      )}

      <button onClick={onShowMore} style={styles.showMore}>
        Show more
      </button>
    </div>
  );
}

function EventCarouselCard({ event, onClick }: { event: AggregatedEvent; onClick: () => void }) {
  const units = usePreferencesStore((s) => s.preferences.distanceUnits);
  const [rsvpCounts, setRsvpCounts] = useState(event.rsvpCounts ?? { going: 0, maybe: 0, notGoing: 0 });
  const [myRsvp, setMyRsvp] = useState<string | null>(event.myRsvp ?? null);
  const [rsvpLoading, setRsvpLoading] = useState(false);

  const handleRsvp = async (e: React.MouseEvent, status: string) => {
    e.stopPropagation();
    setRsvpLoading(true);
    try {
      if (status === myRsvp) {
        const result = await api<any>(`/spaces/${event.spaceId}/calendar/events/${event.id}/rsvp`, { method: 'DELETE' });
        setRsvpCounts(result.rsvpCounts);
        setMyRsvp(null);
      } else {
        const result = await api<any>(`/spaces/${event.spaceId}/calendar/events/${event.id}/rsvp`, {
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
    <div style={styles.card} onClick={onClick}>
      {/* Header image */}
      {event.imageUrl && (
        <div style={styles.cardImage}>
          <img src={event.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}

      <div style={styles.cardBody}>
        {/* Date + space */}
        <div style={styles.cardTopRow}>
          <span style={styles.dateLabel}>
            {formatEventDate(event.eventDate)}
            {event.eventTime && <span> &middot; {event.eventTime}</span>}
          </span>
          {event.spaceName && (
            <span style={styles.spaceBadge}>{event.spaceName}</span>
          )}
        </div>

        {/* Event name */}
        <div style={styles.cardName}>{event.name}</div>

        {/* Meta row: location, activity type */}
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

        {/* Route preview */}
        {event.route && (
          <div style={styles.routeSection}>
            {event.route.geojson && (
              <div style={styles.miniMapWrap}>
                <MiniMap geojson={event.route.geojson} height={80} />
              </div>
            )}
            <div style={styles.routeInfo}>
              <Mountain size={11} style={{ color: '#7a5a5a', flexShrink: 0 }} />
              <span style={{ fontWeight: 600 }}>{event.route.name}</span>
              <span style={{ color: '#7a5a5a' }}>{formatDistance(event.route.distanceKm, units)}</span>
              {event.route.elevationGainM != null && (
                <span style={{ color: '#7a5a5a' }}>+{formatElevation(event.route.elevationGainM, units)}</span>
              )}
            </div>
          </div>
        )}

        {/* Category badge */}
        {event.category && (
          <span style={{ ...styles.categoryBadge, background: event.category.color }}>
            {event.category.name}
          </span>
        )}
      </div>

      {/* RSVP buttons */}
      <div style={styles.rsvpRow}>
        <RsvpButton icon={<Check size={11} />} label="Going" count={rsvpCounts.going}
          active={myRsvp === 'going'} disabled={rsvpLoading} color="#43b581"
          onClick={(e) => handleRsvp(e, 'going')} />
        <RsvpButton icon={<HelpCircle size={11} />} label="Maybe" count={rsvpCounts.maybe}
          active={myRsvp === 'maybe'} disabled={rsvpLoading} color="#faa61a"
          onClick={(e) => handleRsvp(e, 'maybe')} />
        <RsvpButton icon={<X size={11} />} label="Can't Go" count={rsvpCounts.notGoing}
          active={myRsvp === 'not_going'} disabled={rsvpLoading} color="var(--danger, #ed4245)"
          onClick={(e) => handleRsvp(e, 'not_going')} />
      </div>
    </div>
  );
}

function RsvpButton({ icon, label, count, active, disabled, color, onClick }: {
  icon: React.ReactNode; label: string; count: number; active: boolean;
  disabled: boolean; color: string; onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px',
      borderRadius: 'var(--radius)', border: `1px solid ${active ? color : 'rgba(0,0,0,0.15)'}`,
      background: active ? `${color}22` : 'transparent',
      color: active ? color : '#5a3a3a',
      cursor: disabled ? 'default' : 'pointer', fontSize: '0.7rem', fontWeight: 600,
      opacity: disabled ? 0.6 : 1, lineHeight: 1,
    }}>
      {icon} {label}
      {count > 0 && <span style={{ marginLeft: 1 }}>({count})</span>}
    </button>
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
    background: 'rgba(0,0,0,0.08)',
    color: '#7a5a5a',
    padding: '1px 7px',
    borderRadius: 10,
  },
  empty: {
    textAlign: 'center',
    padding: '24px 1.5rem',
    color: '#7a5a5a',
    fontSize: '0.85rem',
  },
  carouselWrap: {
    position: 'relative',
    overflow: 'hidden',
  },
  carouselTrack: {
    overflow: 'hidden',
  },
  navBtn: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 2,
    width: 30,
    height: 30,
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(255,255,255,0.9)',
    color: '#3a2a2a',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 1px 6px rgba(0,0,0,0.2)',
  },
  dots: {
    display: 'flex',
    justifyContent: 'center',
    gap: 6,
    padding: '4px 1.5rem 0',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  showMore: {
    background: 'none',
    border: 'none',
    color: '#8b4513',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '4px 1.5rem',
    textAlign: 'center',
  },
  card: {
    background: 'white',
    border: '1px solid rgba(0,0,0,0.1)',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    cursor: 'pointer',
    color: '#2e1a1a',
  },
  cardImage: {
    height: 100,
    overflow: 'hidden',
  },
  cardBody: {
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
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
    fontSize: '0.92rem',
    fontWeight: 700,
    color: '#2e1a1a',
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
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
  categoryBadge: {
    display: 'inline-block',
    padding: '1px 6px',
    borderRadius: 8,
    fontSize: '0.65rem',
    color: '#fff',
    fontWeight: 600,
    alignSelf: 'flex-start',
  },
  routeSection: {
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    background: 'rgba(0,0,0,0.04)',
  },
  miniMapWrap: {
    height: 80,
    overflow: 'hidden',
  },
  routeInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px',
    fontSize: '0.72rem',
    color: '#5a3a3a',
  },
  rsvpRow: {
    display: 'flex',
    gap: 5,
    padding: '6px 12px 8px',
    borderTop: '1px solid rgba(0,0,0,0.08)',
  },
};
