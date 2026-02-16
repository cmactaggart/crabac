import { useState, useMemo } from 'react';
import { Calendar, Clock, Tag, MapPin, Users } from 'lucide-react';
import { api } from '../../lib/api.js';
import { EventDetailModal } from './EventDetailModal.js';
import { CreateEventModal } from './CreateEventModal.js';
import { useHasSpacePermission } from '../settings/SpaceSettingsModal.js';
import { Permissions } from '@crabac/shared';
import type { CalendarEvent } from '@crabac/shared';

export interface CalendarEventEmbed {
  id: string;
  spaceId: string;
  name: string;
  eventDate: string;
  eventTime: string | null;
  description: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  location?: string | null;
  activityType?: string | null;
  routeName?: string | null;
  routeDistanceKm?: number | null;
  routeElevationGainM?: number | null;
  routeGeojson?: any;
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
  const maxPts = 60;
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

const CALENDAR_EVENT_REGEX = /\[calendar-event:([\s\S]*?)\]/;

/** Extract a calendar event embed from message content, if present. */
export function extractCalendarEvent(content: string): { embed: CalendarEventEmbed; remainingContent: string } | null {
  const match = content.match(CALENDAR_EVENT_REGEX);
  if (!match) return null;
  try {
    const embed = JSON.parse(match[1]) as CalendarEventEmbed;
    if (!embed.id || !embed.name || !embed.eventDate) return null;
    const remainingContent = content.replace(CALENDAR_EVENT_REGEX, '').trim();
    return { embed, remainingContent };
  } catch {
    return null;
  }
}

interface Props {
  embed: CalendarEventEmbed;
  spaceId: string;
}

export function CalendarEventCard({ embed, spaceId }: Props) {
  const [showDetail, setShowDetail] = useState(false);
  const [fullEvent, setFullEvent] = useState<CalendarEvent | null>(null);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [loadError, setLoadError] = useState(false);
  const canManage = useHasSpacePermission(spaceId, Permissions.MANAGE_CALENDAR);

  const d = new Date(embed.eventDate + 'T00:00:00');
  const dateLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
  const accentColor = embed.categoryColor || 'var(--accent)';
  const routePolyline = useMemo(() => {
    if (!embed.routeGeojson) return '';
    return generateMiniMapPoints(embed.routeGeojson, 380, 80);
  }, [embed.routeGeojson]);

  const handleClick = async () => {
    setLoadError(false);
    try {
      const event = await api<CalendarEvent>(`/spaces/${spaceId}/calendar/events/${embed.id}`);
      setFullEvent(event);
      setShowDetail(true);
    } catch {
      setLoadError(true);
    }
  };

  return (
    <>
      <div style={{ ...styles.card, borderLeftColor: accentColor }} onClick={handleClick}>
        <div style={styles.cardHeader}>
          <Calendar size={16} style={{ color: accentColor, flexShrink: 0 }} />
          <span style={styles.cardTitle}>{embed.name}</span>
        </div>

        <div style={styles.cardDetails}>
          <div style={styles.detailItem}>
            <Clock size={13} style={{ color: 'var(--text-muted)' }} />
            <span>{dateLabel}{embed.eventTime ? ` at ${embed.eventTime}` : ''}</span>
          </div>
          {embed.categoryName && (
            <div style={styles.detailItem}>
              <Tag size={13} style={{ color: 'var(--text-muted)' }} />
              <span style={{ ...styles.categoryBadge, background: accentColor }}>
                {embed.categoryName}
              </span>
            </div>
          )}
          {embed.location && (
            <div style={styles.detailItem}>
              <MapPin size={13} style={{ color: 'var(--text-muted)' }} />
              <span>{embed.location}</span>
            </div>
          )}
          {embed.activityType && (
            <div style={styles.detailItem}>
              <span style={{ ...styles.categoryBadge, background: 'var(--accent)' }}>
                {embed.activityType === 'ride' ? 'Ride' : embed.activityType === 'run' ? 'Run' : 'Walk'}
              </span>
            </div>
          )}
        </div>

        {/* Route mini map */}
        {routePolyline && embed.routeName && (
          <div style={{ margin: '4px 0', padding: 8, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)' }}>
            <div style={{ height: 80, overflow: 'hidden', marginBottom: 4 }}>
              <svg viewBox="0 0 380 80" style={{ width: '100%', height: '100%' }}>
                <polyline
                  points={routePolyline}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', gap: 8 }}>
              <span style={{ fontWeight: 600 }}>{embed.routeName}</span>
              {embed.routeDistanceKm != null && <span>{embed.routeDistanceKm.toFixed(1)} km</span>}
              {embed.routeElevationGainM != null && <span>+{embed.routeElevationGainM} m</span>}
            </div>
          </div>
        )}

        {embed.description && (
          <p style={styles.description}>
            {embed.description.length > 200
              ? embed.description.slice(0, 200) + '...'
              : embed.description}
          </p>
        )}

        <div style={styles.cardFooter}>
          {loadError
            ? <span style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>Event may have been deleted</span>
            : <span style={{ color: 'var(--accent)', fontSize: '0.75rem', fontWeight: 600 }}>View Event &amp; RSVP</span>
          }
        </div>
      </div>

      {showDetail && fullEvent && (
        <EventDetailModal
          event={fullEvent}
          spaceId={spaceId}
          canManage={canManage}
          onClose={() => { setShowDetail(false); setFullEvent(null); }}
          onEdit={() => {
            setEditEvent(fullEvent);
            setShowDetail(false);
          }}
        />
      )}

      {editEvent && (
        <CreateEventModal
          spaceId={spaceId}
          editEvent={editEvent}
          onClose={() => setEditEvent(null)}
        />
      )}
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderLeft: '4px solid var(--accent)',
    borderRadius: 'var(--radius)',
    padding: '12px 14px',
    maxWidth: 'min(420px, 100%)',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  cardTitle: {
    fontWeight: 700,
    fontSize: '0.95rem',
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cardDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginBottom: 4,
  },
  detailItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
  },
  categoryBadge: {
    display: 'inline-block',
    padding: '1px 8px',
    borderRadius: 10,
    fontSize: '0.7rem',
    color: '#fff',
    fontWeight: 600,
  },
  description: {
    margin: '6px 0 4px',
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    lineHeight: 1.4,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  cardFooter: {
    marginTop: 6,
    paddingTop: 6,
    borderTop: '1px solid var(--border)',
  },
};
