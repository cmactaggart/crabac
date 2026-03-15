import React, { useState, useEffect, Suspense } from 'react';
import { Calendar, Clock, Tag, MapPin, Check, HelpCircle, X } from 'lucide-react';
import { api } from '../../lib/api.js';
import { EventDetailModal } from './EventDetailModal.js';
import { CreateEventModal } from './CreateEventModal.js';
import { useHasSpacePermission } from '../settings/SpaceSettingsModal.js';
import { Permissions } from '@crabac/shared';
import type { CalendarEvent } from '@crabac/shared';
import { MiniMap } from '../common/MiniMap.js';

const LazyGpxMapModal = React.lazy(() => import('../messages/GpxMapModal.js'));

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
  imageUrl?: string | null;
}

function computeBoundsFromGeojson(geojson: any): { minLat: number; maxLat: number; minLng: number; maxLng: number } | null {
  if (!geojson?.features) return null;
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const feature of geojson.features) {
    const geom = feature.geometry;
    const lines = geom.type === 'LineString' ? [geom.coordinates] : geom.type === 'MultiLineString' ? geom.coordinates : [];
    for (const line of lines) {
      for (const c of line) {
        if (c[0] < minLng) minLng = c[0];
        if (c[0] > maxLng) maxLng = c[0];
        if (c[1] < minLat) minLat = c[1];
        if (c[1] > maxLat) maxLat = c[1];
      }
    }
  }
  if (!isFinite(minLng)) return null;
  return { minLat, maxLat, minLng, maxLng };
}

const CALENDAR_EVENT_PREFIX = '[calendar-event:';

/** Extract a calendar event embed from message content, if present. */
export function extractCalendarEvent(content: string): { embed: CalendarEventEmbed; remainingContent: string } | null {
  const start = content.indexOf(CALENDAR_EVENT_PREFIX);
  if (start === -1) return null;

  // Find the matching closing bracket by counting brace depth
  const jsonStart = start + CALENDAR_EVENT_PREFIX.length;
  let depth = 0;
  let end = -1;
  for (let i = jsonStart; i < content.length; i++) {
    const ch = content[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        // Expect a closing ] after the JSON object
        if (content[i + 1] === ']') {
          end = i + 2; // past the ]
        }
        break;
      }
    }
  }
  if (end === -1) return null;

  try {
    const jsonStr = content.slice(jsonStart, end - 1); // exclude the trailing ]
    const embed = JSON.parse(jsonStr) as CalendarEventEmbed;
    if (!embed.id || !embed.name || !embed.eventDate) return null;
    const remainingContent = (content.slice(0, start) + content.slice(end)).trim();
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
  const [showRouteDetail, setShowRouteDetail] = useState(false);
  const [rsvpCounts, setRsvpCounts] = useState<{ going: number; maybe: number; notGoing: number } | null>(null);
  const [myRsvp, setMyRsvp] = useState<string | null>(null);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const canManage = useHasSpacePermission(spaceId, Permissions.MANAGE_CALENDAR);

  // Fetch live RSVP data on mount
  useEffect(() => {
    api<any>(`/spaces/${spaceId}/calendar/events/${embed.id}`)
      .then((event) => {
        if (event.rsvpCounts) setRsvpCounts(event.rsvpCounts);
        if (event.myRsvp !== undefined) setMyRsvp(event.myRsvp);
        if (event.imageUrl && !embed.imageUrl) {
          (embed as any).imageUrl = event.imageUrl;
        }
      })
      .catch(() => {});
  }, [embed.id, spaceId]);

  const d = new Date(embed.eventDate + 'T00:00:00');
  const dateLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
  const accentColor = embed.categoryColor || 'var(--accent)';

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

  const handleRsvp = async (status: string) => {
    setRsvpLoading(true);
    try {
      if (status === 'none') {
        const result = await api<any>(`/spaces/${spaceId}/calendar/events/${embed.id}/rsvp`, {
          method: 'DELETE',
        });
        setRsvpCounts(result.rsvpCounts);
        setMyRsvp(null);
      } else {
        const result = await api<any>(`/spaces/${spaceId}/calendar/events/${embed.id}/rsvp`, {
          method: 'POST',
          body: JSON.stringify({ status }),
        });
        setRsvpCounts(result.rsvpCounts);
        setMyRsvp(status);
      }
    } catch {}
    setRsvpLoading(false);
  };

  return (
    <>
      <div style={{ ...styles.card, borderLeftColor: accentColor }}>
        {/* Header image */}
        {embed.imageUrl && (
          <div style={styles.headerImage} onClick={handleClick}>
            <img
              src={embed.imageUrl}
              alt={embed.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        )}

        <div style={{ cursor: 'pointer' }} onClick={handleClick}>
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
          {embed.routeGeojson && embed.routeName && (
            <div
              style={{ margin: '4px 0', padding: 8, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)', cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); setShowRouteDetail(true); }}
            >
              <div style={{ height: 160, overflow: 'hidden', marginBottom: 4, borderRadius: 'var(--radius)' }}>
                <MiniMap geojson={embed.routeGeojson} bounds={computeBoundsFromGeojson(embed.routeGeojson)} width="100%" height={160} />
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
        </div>

        {/* Inline RSVP buttons */}
        <div style={styles.rsvpRow}>
          <RsvpButton
            icon={<Check size={13} />}
            label="Going"
            count={rsvpCounts?.going || 0}
            active={myRsvp === 'going'}
            disabled={rsvpLoading}
            onClick={() => handleRsvp(myRsvp === 'going' ? 'none' : 'going')}
            color="var(--success, #43b581)"
          />
          <RsvpButton
            icon={<HelpCircle size={13} />}
            label="Maybe"
            count={rsvpCounts?.maybe || 0}
            active={myRsvp === 'maybe'}
            disabled={rsvpLoading}
            onClick={() => handleRsvp(myRsvp === 'maybe' ? 'none' : 'maybe')}
            color="#faa61a"
          />
          <RsvpButton
            icon={<X size={13} />}
            label="Can't Go"
            count={rsvpCounts?.notGoing || 0}
            active={myRsvp === 'not_going'}
            disabled={rsvpLoading}
            onClick={() => handleRsvp(myRsvp === 'not_going' ? 'none' : 'not_going')}
            color="var(--danger, #ed4245)"
          />
        </div>

        {loadError && (
          <div style={{ padding: '4px 0', color: 'var(--danger)', fontSize: '0.75rem' }}>
            Event may have been deleted
          </div>
        )}
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

      {showRouteDetail && embed.routeGeojson && (
        <Suspense fallback={null}>
          <LazyGpxMapModal
            attachment={{ id: '', url: '', filename: '', originalName: embed.routeName || 'route.gpx', mimeType: 'application/gpx+xml', size: 0 }}
            gpx={{
              geojson: embed.routeGeojson,
              distanceKm: embed.routeDistanceKm || 0,
              elevationGainM: embed.routeElevationGainM || 0,
              elevationLossM: 0,
              durationSec: 0,
              trackName: embed.routeName || 'Route',
              bounds: computeBoundsFromGeojson(embed.routeGeojson),
            }}
            onClose={() => setShowRouteDetail(false)}
          />
        </Suspense>
      )}
    </>
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

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderLeft: '4px solid var(--accent)',
    borderRadius: 'var(--radius)',
    padding: '0 14px 12px',
    maxWidth: 'min(420px, 100%)',
    overflow: 'hidden',
  },
  headerImage: {
    margin: '0 -14px',
    marginBottom: 8,
    height: 140,
    overflow: 'hidden',
    cursor: 'pointer',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
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
  rsvpRow: {
    display: 'flex',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTop: '1px solid var(--border)',
  },
};
