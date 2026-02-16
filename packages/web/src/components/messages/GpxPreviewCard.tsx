import React, { useState, useMemo, Suspense } from 'react';
import { MapPin, MapPinned, Mountain, Clock, Download, X } from 'lucide-react';
import type { Attachment, GpxTrackMetadata, DistanceUnits, RouteItem, Channel } from '@crabac/shared';
import { api } from '../../lib/api.js';
import { usePreferencesStore } from '../../stores/preferences.js';
import { useChannelsStore } from '../../stores/channels.js';

const LazyGpxMapModal = React.lazy(() => import('./GpxMapModal.js'));

interface Props {
  attachment: Attachment;
  gpx: GpxTrackMetadata;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDistance(km: number, units: DistanceUnits): string {
  if (units === 'imperial') {
    const mi = km * 0.621371;
    if (mi < 0.1) return `${Math.round(km * 3280.84)} ft`;
    return `${mi.toFixed(1)} mi`;
  }
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function formatElevation(m: number, units: DistanceUnits): string {
  if (units === 'imperial') return `${Math.round(m * 3.28084)} ft`;
  return `${m} m`;
}

/**
 * Generate SVG polyline points from GeoJSON coordinates.
 * Samples down to ~100 points and projects to a viewBox.
 */
function generateMiniMapPoints(gpx: GpxTrackMetadata, width: number, height: number): string {
  const coords: [number, number][] = [];

  if (!gpx.geojson?.features) return '';

  for (const feature of gpx.geojson.features) {
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

  // Downsample to ~100 points
  const maxPts = 100;
  let sampled = coords;
  if (coords.length > maxPts) {
    const step = (coords.length - 1) / (maxPts - 1);
    sampled = [];
    for (let i = 0; i < maxPts - 1; i++) {
      sampled.push(coords[Math.round(i * step)]);
    }
    sampled.push(coords[coords.length - 1]);
  }

  // Compute bounds
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lng, lat] of sampled) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  const pad = 0.05;
  const lngRange = (maxLng - minLng) || 0.001;
  const latRange = (maxLat - minLat) || 0.001;

  return sampled
    .map(([lng, lat]) => {
      const x = ((lng - minLng) / lngRange) * (1 - 2 * pad) + pad;
      const y = (1 - (lat - minLat) / latRange) * (1 - 2 * pad) + pad; // flip Y
      return `${(x * width).toFixed(1)},${(y * height).toFixed(1)}`;
    })
    .join(' ');
}

export function GpxPreviewCard({ attachment, gpx }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [showAddToLibrary, setShowAddToLibrary] = useState(false);
  const polylinePoints = useMemo(() => generateMiniMapPoints(gpx, 160, 100), [gpx]);
  const units = usePreferencesStore((s) => s.preferences.distanceUnits);
  const channels = useChannelsStore((s) => s.channels);
  const routeLibraryChannels = channels.filter((c: Channel) => c.type === 'route_library');

  return (
    <>
      <div style={styles.card} onClick={() => setShowModal(true)} role="button" tabIndex={0}>
        {/* Mini SVG map */}
        <div style={styles.miniMap}>
          <svg viewBox="0 0 160 100" style={{ width: '100%', height: '100%' }}>
            <polyline
              points={polylinePoints}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Info */}
        <div style={styles.info}>
          <div style={styles.trackName}>{gpx.trackName || attachment.originalName}</div>

          <div style={styles.stats}>
            <span style={styles.stat}>
              <MapPin size={13} /> {formatDistance(gpx.distanceKm, units)}
            </span>
            {gpx.elevationGainM != null && (
              <span style={styles.stat}>
                <Mountain size={13} /> +{formatElevation(gpx.elevationGainM, units)}
                {gpx.elevationLossM != null && ` / -${formatElevation(gpx.elevationLossM, units)}`}
              </span>
            )}
            {gpx.durationSec > 0 && (
              <span style={styles.stat}>
                <Clock size={13} /> {formatDuration(gpx.durationSec)}
              </span>
            )}
          </div>

          <a
            href={attachment.url}
            download={attachment.originalName}
            onClick={(e) => e.stopPropagation()}
            style={styles.download}
          >
            <Download size={13} /> Download GPX
          </a>
          {routeLibraryChannels.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowAddToLibrary(true); }}
              style={{ ...styles.download, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <MapPinned size={13} /> Add to Library
            </button>
          )}
        </div>
      </div>

      {/* Map modal (lazy-loaded) */}
      {showModal && (
        <Suspense fallback={null}>
          <LazyGpxMapModal
            attachment={attachment}
            gpx={gpx}
            onClose={() => setShowModal(false)}
          />
        </Suspense>
      )}

      {showAddToLibrary && (
        <AddToLibraryModal
          attachment={attachment}
          gpx={gpx}
          channels={routeLibraryChannels}
          onClose={() => setShowAddToLibrary(false)}
        />
      )}
    </>
  );
}

function AddToLibraryModal({ attachment, gpx, channels, onClose }: {
  attachment: Attachment;
  gpx: GpxTrackMetadata;
  channels: Channel[];
  onClose: () => void;
}) {
  const [channelId, setChannelId] = useState(channels.length === 1 ? channels[0].id : '');
  const [name, setName] = useState(gpx.trackName || attachment.originalName.replace(/\.gpx$/i, ''));
  const [description, setDescription] = useState('');
  const [activityType, setActivityType] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!channelId || !name.trim()) return;
    setSaving(true);
    setError('');
    try {
      await api<RouteItem>(`/channels/${channelId}/routes/from-attachment`, {
        method: 'POST',
        body: JSON.stringify({
          attachmentUrl: attachment.url,
          name: name.trim(),
          description: description.trim() || undefined,
          activityType: activityType || undefined,
          isPublic,
        }),
      });
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to add route');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={onClose}>
      <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius)', width: 420, maxWidth: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Add to Route Library</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {error && <div style={{ background: 'rgba(237,66,69,0.15)', color: 'var(--danger)', padding: '8px 12px', borderRadius: 'var(--radius)', fontSize: '0.85rem' }}>{error}</div>}
          {success && <div style={{ background: 'rgba(67,181,129,0.15)', color: '#43b581', padding: '8px 12px', borderRadius: 'var(--radius)', fontSize: '0.85rem' }}>Route added successfully!</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Route Library Channel</label>
            <select value={channelId} onChange={(e) => setChannelId(e.target.value)} style={{ padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none' }}>
              {channels.length > 1 && <option value="">Select a channel...</option>}
              {channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none' }} maxLength={200} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Description (optional)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none', minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }} maxLength={4000} placeholder="Route description..." />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Activity Type</label>
            <select value={activityType} onChange={(e) => setActivityType(e.target.value)} style={{ padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none' }}>
              <option value="">None</option>
              <option value="ride">Ride</option>
              <option value="run">Run</option>
              <option value="walk">Walk</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" id="atl-public" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            <label htmlFor="atl-public" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Make public</label>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving || !channelId || !name.trim() || success} style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, opacity: (saving || !channelId || !name.trim() || success) ? 0.5 : 1 }}>
            {saving ? 'Adding...' : 'Add to Library'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    display: 'flex',
    gap: 12,
    padding: 12,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    maxWidth: 'min(420px, 100%)',
    transition: 'border-color 0.15s',
  },
  miniMap: {
    width: 160,
    height: 100,
    background: 'var(--bg-tertiary, var(--bg-primary))',
    borderRadius: 'var(--radius)',
    flexShrink: 0,
    overflow: 'hidden',
  },
  info: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 4,
    minWidth: 0,
  },
  trackName: {
    fontWeight: 600,
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  stats: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px 10px',
    fontSize: '0.78rem',
    color: 'var(--text-secondary)',
  },
  stat: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
  },
  download: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: '0.78rem',
    color: 'var(--accent)',
    textDecoration: 'none',
    marginTop: 2,
  },
};
