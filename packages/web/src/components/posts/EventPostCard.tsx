import { useEffect, useState, useMemo } from 'react';
import { CalendarDays, MapPin, Clock, Check, HelpCircle, X } from 'lucide-react';
import { api } from '../../lib/api.js';

interface RouteData {
  id: string;
  name: string;
  distanceKm: number;
  elevationGainM?: number | null;
  geojson?: any;
  url?: string | null;
}

interface CalendarEvent {
  id: string;
  name: string;
  eventDate: string;
  eventTime?: string | null;
  location?: string | null;
  description?: string | null;
  activityType?: string | null;
  imageUrl?: string | null;
  rsvpCounts?: { going: number; maybe: number; notGoing: number };
  myRsvp?: string | null;
  route?: RouteData | null;
}

function generateMiniMapPoints(geojson: any, width: number, height: number): string {
  const coords: [number, number][] = [];
  if (!geojson?.features) return '';
  for (const feature of geojson.features) {
    const geom = feature.geometry;
    if (geom.type === 'LineString') {
      for (const c of geom.coordinates) coords.push([c[0], c[1]]);
    } else if (geom.type === 'MultiLineString') {
      for (const line of geom.coordinates) {
        for (const c of line) coords.push([c[0], c[1]]);
      }
    }
  }
  if (coords.length < 2) return '';
  const maxPts = 80;
  let sampled = coords;
  if (coords.length > maxPts) {
    const step = (coords.length - 1) / (maxPts - 1);
    sampled = [];
    for (let i = 0; i < maxPts - 1; i++) sampled.push(coords[Math.round(i * step)]);
    sampled.push(coords[coords.length - 1]);
  }
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lng, lat] of sampled) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  const pad = 0.08, lngRange = (maxLng - minLng) || 0.001, latRange = (maxLat - minLat) || 0.001;
  return sampled
    .map(([lng, lat]) => {
      const x = ((lng - minLng) / lngRange) * (1 - 2 * pad) + pad;
      const y = (1 - (lat - minLat) / latRange) * (1 - 2 * pad) + pad;
      return `${(x * width).toFixed(1)},${(y * height).toFixed(1)}`;
    })
    .join(' ');
}

export function EventPostCard({ eventId, spaceId }: { eventId: string; spaceId: string }) {
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [rsvpLoading, setRsvpLoading] = useState(false);

  useEffect(() => {
    api<CalendarEvent>(`/spaces/${spaceId}/calendar/events/${eventId}`)
      .then(setEvent)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [eventId, spaceId]);

  const routePolyline = useMemo(() => {
    if (!event?.route?.geojson) return '';
    return generateMiniMapPoints(event.route.geojson, 380, 80);
  }, [event?.route?.geojson]);

  if (loading) {
    return (
      <div style={{ padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
        Loading event...
      </div>
    );
  }

  if (!event) return null;

  const dateStr = new Date(event.eventDate + 'T00:00:00').toLocaleDateString([], {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });

  const handleRsvp = async (status: string) => {
    setRsvpLoading(true);
    try {
      if (status === 'none') {
        const result = await api<CalendarEvent>(`/spaces/${spaceId}/calendar/events/${eventId}/rsvp`, {
          method: 'DELETE',
        });
        setEvent((prev) => prev ? { ...prev, rsvpCounts: result.rsvpCounts, myRsvp: null } : prev);
      } else {
        const result = await api<CalendarEvent>(`/spaces/${spaceId}/calendar/events/${eventId}/rsvp`, {
          method: 'POST',
          body: JSON.stringify({ status }),
        });
        setEvent((prev) => prev ? { ...prev, rsvpCounts: result.rsvpCounts, myRsvp: status } : prev);
      }
    } catch {}
    setRsvpLoading(false);
  };

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      marginTop: 8,
      background: 'var(--bg-tertiary)',
    }}>
      {/* Header image */}
      {event.imageUrl && (
        <img src={event.imageUrl} alt={event.name} style={{ width: '100%', maxHeight: 200, objectFit: 'cover' }} />
      )}

      <div style={{ padding: '0.75rem' }}>
        {/* Event name + activity badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <CalendarDays size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{event.name}</span>
          {event.activityType && (
            <span style={{
              fontSize: '0.65rem',
              padding: '2px 6px',
              borderRadius: 8,
              background: 'var(--accent)',
              color: 'white',
              fontWeight: 600,
              textTransform: 'capitalize',
            }}>
              {event.activityType}
            </span>
          )}
        </div>

        {/* Date/time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
          <Clock size={13} />
          <span>{dateStr}{event.eventTime ? ` at ${event.eventTime}` : ''}</span>
        </div>

        {/* Location */}
        {event.location && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
            <MapPin size={13} />
            <span>{event.location}</span>
          </div>
        )}

        {/* Description */}
        {event.description && (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.4 }}>
            {event.description.length > 200 ? event.description.slice(0, 200) + '...' : event.description}
          </div>
        )}

        {/* Route preview */}
        {event.route && (
          <div style={{ marginTop: 8, padding: '6px 8px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            {routePolyline && (
              <svg viewBox="0 0 380 80" style={{ width: '100%', height: 60, display: 'block', marginBottom: 4 }}>
                <polyline
                  points={routePolyline}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <span style={{ fontWeight: 600 }}>{event.route.name}</span>
              {event.route.distanceKm != null && <span>{event.route.distanceKm.toFixed(1)} km</span>}
              {event.route.elevationGainM != null && <span>+{event.route.elevationGainM} m</span>}
            </div>
          </div>
        )}

        {/* RSVP buttons */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <RsvpButton
            icon={<Check size={13} />}
            label="Going"
            count={event.rsvpCounts?.going || 0}
            active={event.myRsvp === 'going'}
            disabled={rsvpLoading}
            onClick={() => handleRsvp(event.myRsvp === 'going' ? 'none' : 'going')}
            color="var(--success, #43b581)"
          />
          <RsvpButton
            icon={<HelpCircle size={13} />}
            label="Maybe"
            count={event.rsvpCounts?.maybe || 0}
            active={event.myRsvp === 'maybe'}
            disabled={rsvpLoading}
            onClick={() => handleRsvp(event.myRsvp === 'maybe' ? 'none' : 'maybe')}
            color="#faa61a"
          />
          <RsvpButton
            icon={<X size={13} />}
            label="Can't Go"
            count={event.rsvpCounts?.notGoing || 0}
            active={event.myRsvp === 'not_going'}
            disabled={rsvpLoading}
            onClick={() => handleRsvp(event.myRsvp === 'not_going' ? 'none' : 'not_going')}
            color="var(--danger, #ed4245)"
          />
        </div>
      </div>
    </div>
  );
}

function RsvpButton({ icon, label, count, active, disabled, onClick, color }: {
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
        gap: 4,
        padding: '4px 10px',
        borderRadius: 'var(--radius)',
        border: `1px solid ${active ? color : 'var(--border)'}`,
        background: active ? `${color}22` : 'transparent',
        color: active ? color : 'var(--text-secondary)',
        cursor: disabled ? 'default' : 'pointer',
        fontSize: '0.75rem',
        fontWeight: 600,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {icon}
      {label}
      {count > 0 && <span style={{ marginLeft: 2 }}>({count})</span>}
    </button>
  );
}
