import React, { useState, useEffect, Suspense } from 'react';
import { X, Pencil, Trash2, MapPin, Check, HelpCircle, XCircle, Repeat, Share2 } from 'lucide-react';
import type { CalendarEvent, EventRsvp } from '@crabac/shared';
import { useCalendarStore } from '../../stores/calendar.js';
import { useAuthStore } from '../../stores/auth.js';
import { ShareToSpacePicker } from '../common/ShareToSpacePicker.js';
import { api } from '../../lib/api.js';
import { MiniMap } from '../common/MiniMap.js';

const LazyGpxMapModal = React.lazy(() => import('../messages/GpxMapModal.js'));

interface Props {
  event: CalendarEvent;
  spaceId: string;
  canManage: boolean;
  onClose: () => void;
  onEdit: () => void;
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

function activityLabel(type: string | null): string {
  if (type === 'ride') return 'Ride';
  if (type === 'run') return 'Run';
  if (type === 'walk') return 'Walk';
  return '';
}

export function EventDetailModal({ event, spaceId, canManage, onClose, onEdit }: Props) {
  const deleteEvent = useCalendarStore((s) => s.deleteEvent);
  const rsvp = useCalendarStore((s) => s.rsvp);
  const removeRsvp = useCalendarStore((s) => s.removeRsvp);
  const fetchRsvps = useCalendarStore((s) => s.fetchRsvps);
  const user = useAuthStore((s) => s.user);

  const cancelOccurrence = useCalendarStore((s) => s.cancelOccurrence);
  const deleteSeries = useCalendarStore((s) => s.deleteSeries);

  const [showSharePicker, setShowSharePicker] = useState(false);
  const [showRouteDetail, setShowRouteDetail] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'single' | 'series' | null>(null);
  const [rsvps, setRsvps] = useState<EventRsvp[]>([]);
  const [showRsvpList, setShowRsvpList] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState(false);

  const d = new Date(event.eventDate + 'T00:00:00');
  const dateLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const handleDelete = async () => {
    try {
      await deleteEvent(spaceId, event.id);
      onClose();
    } catch { /* ignore */ }
  };

  const handleCancelOccurrence = async () => {
    try {
      await cancelOccurrence(spaceId, event.id);
      onClose();
    } catch { /* ignore */ }
  };

  const handleDeleteSeries = async () => {
    if (!event.seriesId) return;
    try {
      await deleteSeries(spaceId, event.seriesId);
      onClose();
    } catch { /* ignore */ }
  };

  const buildEmbedContent = () => {
    const embedData: any = {
      id: event.id,
      spaceId,
      name: event.name,
      eventDate: event.eventDate,
      eventTime: event.eventTime,
      description: event.description,
      categoryName: event.category?.name || null,
      categoryColor: event.category?.color || null,
      location: event.location || null,
      activityType: event.activityType || null,
      imageUrl: event.imageUrl || null,
    };
    if (event.route) {
      embedData.routeName = event.route.name;
      embedData.routeDistanceKm = event.route.distanceKm;
      embedData.routeElevationGainM = event.route.elevationGainM;
      embedData.routeGeojson = event.route.geojson;
    }
    return `[calendar-event:${JSON.stringify(embedData)}]`;
  };

  const handleShareToChannel = async (channelId: string, _spaceId: string) => {
    await api(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content: buildEmbedContent() }),
    });
  };

  const handleShareToDM = async (conversationId: string) => {
    await api(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content: buildEmbedContent() }),
    });
  };

  const handleRsvp = async (status: 'going' | 'maybe' | 'not_going') => {
    try {
      if (event.myRsvp === status) {
        await removeRsvp(spaceId, event.id);
      } else {
        await rsvp(spaceId, event.id, status);
      }
    } catch { /* ignore */ }
  };

  const handleShowRsvps = async () => {
    if (showRsvpList) { setShowRsvpList(false); return; }
    setRsvpLoading(true);
    try {
      const data = await fetchRsvps(spaceId, event.id);
      setRsvps(data);
      setShowRsvpList(true);
    } catch { /* ignore */ }
    setRsvpLoading(false);
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {event.imageUrl && (
          <div style={{ width: '100%', aspectRatio: '16/9', overflow: 'hidden', borderRadius: 'var(--radius) var(--radius) 0 0', flexShrink: 0 }}>
            <img src={event.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}
        <div style={styles.header}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{event.name}</h3>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {event.category && (
                <span style={{ ...styles.categoryBadge, background: event.category.color }}>
                  {event.category.name}
                </span>
              )}
              {event.seriesId && (
                <span style={{ ...styles.categoryBadge, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                  <Repeat size={10} style={{ marginRight: 3 }} /> Series
                </span>
              )}
              {event.activityType && (
                <span style={{ ...styles.categoryBadge, background: 'var(--accent)' }}>
                  {activityLabel(event.activityType)}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}><X size={18} /></button>
        </div>

        <div style={styles.body}>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Date</span>
            <span>{dateLabel}</span>
          </div>
          {event.eventTime && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Time</span>
              <span>{event.eventTime}</span>
            </div>
          )}
          {event.location && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Location</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={13} /> {event.location}
              </span>
            </div>
          )}
          {event.creator && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Created by</span>
              <span>{event.creator.displayName}</span>
            </div>
          )}
          {event.description && (
            <div style={{ marginTop: 8 }}>
              <span style={styles.detailLabel}>Description</span>
              <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                {event.description}
              </p>
            </div>
          )}

          {/* Route preview */}
          {event.route && (
            <div style={{ marginTop: 8, padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--radius)' }}>
              <div
                style={{ cursor: 'pointer' }}
                onClick={() => setShowRouteDetail(true)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <MapPin size={14} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{event.route.name}</span>
                </div>
                {event.route.geojson && (
                  <div style={{ height: 120, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 6 }}>
                    <MiniMap geojson={event.route.geojson} bounds={computeBoundsFromGeojson(event.route.geojson)} width="100%" height={120} />
                  </div>
                )}
                <div style={{ display: 'flex', gap: 12, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <span>{event.route.distanceKm.toFixed(1)} km</span>
                  {event.route.elevationGainM != null && <span>+{event.route.elevationGainM} m</span>}
                </div>
              </div>
              {event.route.url && (
                <a href={event.route.url} download style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: '0.78rem', color: 'var(--accent)', textDecoration: 'none' }}>
                  Download GPX
                </a>
              )}
            </div>
          )}

          {/* RSVP */}
          <div style={{ marginTop: 12 }}>
            <span style={styles.detailLabel}>RSVP</span>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button
                onClick={() => handleRsvp('going')}
                style={{ ...styles.rsvpBtn, background: event.myRsvp === 'going' ? 'rgba(67,181,129,0.2)' : 'var(--bg-tertiary)', borderColor: event.myRsvp === 'going' ? '#43b581' : 'var(--border)', color: event.myRsvp === 'going' ? '#43b581' : 'var(--text-secondary)' }}
              >
                <Check size={14} /> Going{event.rsvpCounts?.going ? ` (${event.rsvpCounts.going})` : ''}
              </button>
              <button
                onClick={() => handleRsvp('maybe')}
                style={{ ...styles.rsvpBtn, background: event.myRsvp === 'maybe' ? 'rgba(250,176,5,0.2)' : 'var(--bg-tertiary)', borderColor: event.myRsvp === 'maybe' ? '#fab005' : 'var(--border)', color: event.myRsvp === 'maybe' ? '#fab005' : 'var(--text-secondary)' }}
              >
                <HelpCircle size={14} /> Maybe{event.rsvpCounts?.maybe ? ` (${event.rsvpCounts.maybe})` : ''}
              </button>
              <button
                onClick={() => handleRsvp('not_going')}
                style={{ ...styles.rsvpBtn, background: event.myRsvp === 'not_going' ? 'rgba(237,66,69,0.2)' : 'var(--bg-tertiary)', borderColor: event.myRsvp === 'not_going' ? 'var(--danger)' : 'var(--border)', color: event.myRsvp === 'not_going' ? 'var(--danger)' : 'var(--text-secondary)' }}
              >
                <XCircle size={14} /> No{event.rsvpCounts?.notGoing ? ` (${event.rsvpCounts.notGoing})` : ''}
              </button>
            </div>
            {(event.rsvpCounts && (event.rsvpCounts.going + event.rsvpCounts.maybe + event.rsvpCounts.notGoing > 0)) && (
              <button onClick={handleShowRsvps} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.78rem', marginTop: 4, padding: 0 }}>
                {rsvpLoading ? 'Loading...' : showRsvpList ? 'Hide responses' : 'Show responses'}
              </button>
            )}
            {showRsvpList && rsvps.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {rsvps.map((r) => (
                  <div key={r.userId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem' }}>
                    <span style={{ color: r.status === 'going' ? '#43b581' : r.status === 'maybe' ? '#fab005' : 'var(--danger)', fontWeight: 600, minWidth: 60 }}>
                      {r.status === 'going' ? 'Going' : r.status === 'maybe' ? 'Maybe' : 'No'}
                    </span>
                    <span style={{ color: 'var(--text-primary)' }}>{r.user?.displayName}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Share */}
          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => setShowSharePicker(true)}
              style={styles.postBtn}
            >
              <Share2 size={14} /> Share
            </button>
          </div>
        </div>

        {showSharePicker && (
          <ShareToSpacePicker
            contentType="event"
            itemId={event.id}
            onClose={() => setShowSharePicker(false)}
            onShared={() => setShowSharePicker(false)}
            onShareToChannel={handleShareToChannel}
            onShareToDM={handleShareToDM}
          />
        )}

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
                bounds: computeBoundsFromGeojson(event.route.geojson),
              }}
              onClose={() => setShowRouteDetail(false)}
            />
          </Suspense>
        )}

        {canManage && (
          <div style={styles.footer}>
            {deleteMode === 'single' ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={event.seriesId ? handleCancelOccurrence : handleDelete} style={styles.dangerBtn}>
                  {event.seriesId ? 'Cancel This Event' : 'Confirm Delete'}
                </button>
                <button onClick={() => setDeleteMode(null)} style={styles.cancelBtn}>Back</button>
              </div>
            ) : deleteMode === 'series' ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleDeleteSeries} style={styles.dangerBtn}>Delete Entire Series</button>
                <button onClick={() => setDeleteMode(null)} style={styles.cancelBtn}>Back</button>
              </div>
            ) : event.seriesId ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setDeleteMode('single')} style={styles.trashBtn}>
                  <Trash2 size={14} /> Cancel This
                </button>
                <button onClick={() => setDeleteMode('series')} style={styles.trashBtn}>
                  <Trash2 size={14} /> Delete Series
                </button>
              </div>
            ) : confirmDelete ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleDelete} style={styles.dangerBtn}>Confirm Delete</button>
                <button onClick={() => setConfirmDelete(false)} style={styles.cancelBtn}>Cancel</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} style={styles.trashBtn}>
                <Trash2 size={14} /> Delete
              </button>
            )}
            <button onClick={onEdit} style={styles.editBtn}>
              <Pencil size={14} /> Edit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  modal: {
    background: 'var(--bg-primary)',
    borderRadius: 'var(--radius)',
    width: 520,
    maxWidth: '90vw',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '14px 16px',
    borderBottom: '1px solid var(--border)',
    gap: 12,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 4,
    borderRadius: 'var(--radius)',
    flexShrink: 0,
  },
  categoryBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 10,
    fontSize: '0.7rem',
    color: '#fff',
    fontWeight: 600,
  },
  body: {
    padding: '16px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  detailRow: {
    display: 'flex',
    gap: 12,
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
  },
  detailLabel: {
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
    minWidth: 80,
  },
  rsvpBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
    transition: 'all 0.15s',
  },
  postBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    padding: '8px 12px',
    background: 'var(--bg-tertiary)',
    border: 'none',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderTop: '1px solid var(--border)',
  },
  editBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 12px',
    background: 'var(--bg-tertiary)',
    border: 'none',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  trashBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: 'none',
    border: 'none',
    color: 'var(--danger)',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
  },
  dangerBtn: {
    padding: '6px 12px',
    background: 'var(--danger)',
    border: 'none',
    color: '#fff',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
  cancelBtn: {
    padding: '6px 12px',
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  saveBtn: {
    padding: '6px 12px',
    background: 'var(--accent)',
    border: 'none',
    borderRadius: 'var(--radius)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
};
