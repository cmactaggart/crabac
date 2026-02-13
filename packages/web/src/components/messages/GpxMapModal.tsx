import { useEffect, useRef, useCallback } from 'react';
import { X, Download, MapPin, Mountain, Clock } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Attachment, GpxTrackMetadata, DistanceUnits } from '@crabac/shared';
import { usePreferencesStore } from '../../stores/preferences.js';

interface Props {
  attachment: Attachment;
  gpx: GpxTrackMetadata;
  onClose: () => void;
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

/** Extract [lng, lat] coords from all line features in the geojson */
function extractLineCoords(geojson: any): { features: any[]; allCoords: [number, number][] } {
  const features: any[] = [];
  const allCoords: [number, number][] = [];

  for (const f of geojson?.features ?? []) {
    const t = f?.geometry?.type;
    if (t === 'LineString' || t === 'MultiLineString') {
      features.push(f);
      if (t === 'LineString') {
        for (const c of f.geometry.coordinates) allCoords.push([c[0], c[1]]);
      } else {
        for (const line of f.geometry.coordinates) {
          for (const c of line) allCoords.push([c[0], c[1]]);
        }
      }
    }
  }
  return { features, allCoords };
}

function addGpxLayers(map: maplibregl.Map, geojson: any) {
  const { features, allCoords } = extractLineCoords(geojson);
  if (features.length === 0) return;

  const trackData: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };

  map.addSource('gpx-track', { type: 'geojson', data: trackData });

  // Outline / casing (wider, darker, behind main line)
  map.addLayer({
    id: 'gpx-track-casing',
    type: 'line',
    source: 'gpx-track',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#2d3180', 'line-width': 7, 'line-opacity': 0.45 },
  });

  // Main track line
  map.addLayer({
    id: 'gpx-track-line',
    type: 'line',
    source: 'gpx-track',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#5865F2', 'line-width': 4, 'line-opacity': 0.95 },
  });

  // Direction arrows — draw onto a canvas and register as image
  const sz = 24;
  const canvas = document.createElement('canvas');
  canvas.width = sz;
  canvas.height = sz;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, sz, sz);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  // Draw chevron pointing RIGHT — MapLibre 'line' placement treats right as forward
  ctx.beginPath();
  ctx.moveTo(sz * 0.25, sz * 0.2);
  ctx.lineTo(sz * 0.8, sz * 0.5);
  ctx.lineTo(sz * 0.25, sz * 0.8);
  ctx.lineTo(sz * 0.48, sz * 0.5);
  ctx.closePath();
  ctx.fill();

  const imgData = ctx.getImageData(0, 0, sz, sz);
  map.addImage('gpx-arrow', { width: sz, height: sz, data: new Uint8Array(imgData.data.buffer) });

  map.addLayer({
    id: 'gpx-track-arrows',
    type: 'symbol',
    source: 'gpx-track',
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 100,
      'icon-image': 'gpx-arrow',
      'icon-size': 0.7,
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });

  // Start (green) / End (red) circle markers
  if (allCoords.length >= 2) {
    map.addSource('gpx-endpoints', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', properties: { kind: 'start' }, geometry: { type: 'Point', coordinates: allCoords[0] } },
          { type: 'Feature', properties: { kind: 'end' }, geometry: { type: 'Point', coordinates: allCoords[allCoords.length - 1] } },
        ],
      },
    });

    map.addLayer({
      id: 'gpx-endpoints-border',
      type: 'circle',
      source: 'gpx-endpoints',
      paint: { 'circle-radius': 8, 'circle-color': '#ffffff' },
    });

    map.addLayer({
      id: 'gpx-endpoints-fill',
      type: 'circle',
      source: 'gpx-endpoints',
      paint: {
        'circle-radius': 6,
        'circle-color': ['match', ['get', 'kind'], 'start', '#22c55e', 'end', '#ef4444', '#888888'],
      },
    });
  }
}

function GpxMapModal({ attachment, gpx, onClose }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const { preferences, updatePreferences } = usePreferencesStore();
  const units = preferences.distanceUnits;

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Initialize MapLibre GL
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const b = gpx.bounds;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://tiles.versatiles.org/assets/styles/colorful/style.json',
      ...(b ? {
        bounds: [b.minLng, b.minLat, b.maxLng, b.maxLat] as [number, number, number, number],
        fitBoundsOptions: { padding: 40 },
      } : {
        center: [0, 0],
        zoom: 2,
      }),
      attributionControl: {},
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    // Try adding layers once style is ready. Use both 'load' and 'style.load'
    // as a belt-and-suspenders approach.
    let layersAdded = false;
    const tryAddLayers = () => {
      if (layersAdded) return;
      if (!gpx.geojson) return;
      if (!map.isStyleLoaded()) return;
      layersAdded = true;
      try {
        addGpxLayers(map, gpx.geojson);
      } catch (err) {
        console.error('[GPX Map] Failed to add layers:', err);
      }
    };

    map.on('load', tryAddLayers);
    map.on('style.load', tryAddLayers);
    // Also try on idle in case both events already fired
    map.on('idle', tryAddLayers);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [gpx]);

  const toggleUnits = useCallback(() => {
    updatePreferences({ distanceUnits: units === 'imperial' ? 'metric' : 'imperial' });
  }, [units, updatePreferences]);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <span style={styles.title}>{gpx.trackName || attachment.originalName}</span>
          </div>
          <div style={styles.headerRight}>
            <button onClick={toggleUnits} style={styles.unitsBtn}>
              {units === 'imperial' ? 'mi' : 'km'}
            </button>
            <a
              href={attachment.url}
              download={attachment.originalName}
              style={styles.downloadBtn}
            >
              <Download size={15} /> Download
            </a>
            <button onClick={onClose} style={styles.closeBtn}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div style={styles.statsBar}>
          <span style={styles.stat}>
            <MapPin size={14} /> {formatDistance(gpx.distanceKm, units)}
          </span>
          {gpx.elevationGainM != null && (
            <span style={styles.stat}>
              <Mountain size={14} /> +{formatElevation(gpx.elevationGainM, units)}
              {gpx.elevationLossM != null && ` / -${formatElevation(gpx.elevationLossM, units)}`}
            </span>
          )}
          {gpx.durationSec > 0 && (
            <span style={styles.stat}>
              <Clock size={14} /> {formatDuration(gpx.durationSec)}
            </span>
          )}
        </div>

        {/* Map */}
        <div style={styles.mapWrapper} ref={mapContainerRef} />
      </div>
    </div>
  );
}

export default GpxMapModal;

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: 'var(--bg-primary)',
    borderRadius: 'var(--radius)',
    width: '90vw',
    maxWidth: 900,
    height: '80vh',
    maxHeight: 700,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  title: {
    fontWeight: 700,
    fontSize: '1rem',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  unitsBtn: {
    padding: '4px 10px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
    lineHeight: 1.4,
  },
  downloadBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '5px 12px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--accent)',
    fontSize: '0.8rem',
    textDecoration: 'none',
    fontWeight: 600,
    cursor: 'pointer',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: 4,
    lineHeight: 1,
  },
  statsBar: {
    display: 'flex',
    gap: 16,
    padding: '8px 16px',
    fontSize: '0.82rem',
    color: 'var(--text-secondary)',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  stat: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  },
  mapWrapper: {
    flex: 1,
    minHeight: 0,
  },
};
