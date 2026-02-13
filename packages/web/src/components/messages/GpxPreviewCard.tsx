import React, { useState, useMemo, Suspense } from 'react';
import { MapPin, Mountain, Clock, Download } from 'lucide-react';
import type { Attachment, GpxTrackMetadata, DistanceUnits } from '@crabac/shared';
import { usePreferencesStore } from '../../stores/preferences.js';

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
  const polylinePoints = useMemo(() => generateMiniMapPoints(gpx, 160, 100), [gpx]);
  const units = usePreferencesStore((s) => s.preferences.distanceUnits);

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
    </>
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
    maxWidth: 420,
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
