import React, { useEffect, useState, Suspense } from 'react';
import { CalendarDays, MapPin, Clock, Check, HelpCircle, X } from 'lucide-react';
import { api } from '../../lib/api.js';
import { MiniMap } from '../common/MiniMap.js';
import { usePreferencesStore } from '../../stores/preferences.js';
import { formatDistance, formatElevation } from '../../lib/units.js';

const LazyGpxMapModal = React.lazy(() => import('../messages/GpxMapModal.js'));

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

function computeBoundsFromGeojson(geojson: any): { minLat: number; maxLat: number; minLng: number; maxLng: number } | null {
  if (!geojson?.features) return null;
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const feature of geojson.features) {
    const geom = feature.geometry;
    const lines = geom.type === 'LineString' ? [geom.coordinates] : geom.type === 'MultiLineString' ? geom.coordinates : [];
    for (const line of lines) {
      for (const c of line) {
        if (c[0] < minLng) minLng = c[0]; if (c[0] > maxLng) maxLng = c[0];
        if (c[1] < minLat) minLat = c[1]; if (c[1] > maxLat) maxLat = c[1];
      }
    }
  }
  if (!isFinite(minLng)) return null;
  return { minLat, maxLat, minLng, maxLng };
}

export function EventPostCard({ eventId, spaceId }: { eventId: string; spaceId: string }) {
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [showRouteDetail, setShowRouteDetail] = useState(false);
  const units = usePreferencesStore((s) => s.preferences.distanceUnits);

  useEffect(() => {
    api<CalendarEvent>(`/spaces/${spaceId}/calendar/events/${eventId}`)
      .then(setEvent)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [eventId, spaceId]);

  if (loading) {
    return (
      <div style={{ padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
        Loading event...
      </div>
    );
  }

  if (!event) return (
    <div style={{ padding: '0.75rem', background: 'rgba(237,66,69,0.15)', borderRadius: 'var(--radius)', fontSize: '0.8rem', color: 'var(--danger, #ed4245)', marginTop: 8 }}>
      Failed to load event card
    </div>
  );

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
          <div
            style={{ marginTop: 8, padding: '6px 8px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', cursor: 'pointer' }}
            onClick={() => setShowRouteDetail(true)}
          >
            {event.route.geojson && (
              <MiniMap geojson={event.route.geojson} bounds={computeBoundsFromGeojson(event.route.geojson)} width="100%" height={160} style={{ marginBottom: 4, borderRadius: 'var(--radius)' }} />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <span style={{ fontWeight: 600 }}>{event.route.name}</span>
              {event.route.distanceKm != null && <span>{formatDistance(event.route.distanceKm, units)}</span>}
              {event.route.elevationGainM != null && <span>+{formatElevation(event.route.elevationGainM, units)}</span>}
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

      {showRouteDetail && event.route?.geojson && (
        <Suspense fallback={null}>
          <LazyGpxMapModal
            attachment={{ id: '', url: event.route.url || '', filename: '', originalName: event.route.name || 'route.gpx', mimeType: 'application/gpx+xml', size: 0 }}
            gpx={{
              geojson: event.route.geojson,
              distanceKm: event.route.distanceKm || 0,
              elevationGainM: event.route.elevationGainM || 0,
              elevationLossM: 0,
              durationSec: 0,
              trackName: event.route.name || 'Route',
              bounds: computeBoundsFromGeojson(event.route?.geojson),
            }}
            onClose={() => setShowRouteDetail(false)}
          />
        </Suspense>
      )}
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
