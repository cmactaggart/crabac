import { useEffect, useRef, useState } from 'react';
import { X, Undo2, Redo2, Trash2, Ruler, TrendingUp, TrendingDown, MapPin, Save, Bike, Footprints, Loader2 } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useRouteBuilder, type RoutingProfile } from './use-route-builder.js';
import { generateGpxXml } from './gpx-generator.js';
import { usePreferencesStore } from '../../stores/preferences.js';
import { formatDistance, formatElevation } from '../../lib/units.js';
import type { PersonalVisibility } from '@crabac/shared';

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

interface Props {
  onClose: () => void;
  onSave: (file: File, name: string, data: { description?: string; visibility: string; activityType?: string }) => Promise<void>;
  defaultVisibility?: PersonalVisibility;
}

const PROFILE_OPTIONS: { value: RoutingProfile; icon: typeof Bike; label: string }[] = [
  { value: 'bike', icon: Bike, label: 'Bike' },
  { value: 'foot', icon: Footprints, label: 'Foot' },
];


export function RouteBuilderModal({ onClose, onSave, defaultVisibility = 'private' }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const { preferences } = usePreferencesStore();
  const units = preferences.distanceUnits;
  const isMobile = useIsMobile();

  const {
    waypoints, addWaypoint, moveWaypoint, removeWaypoint,
    undo, redo, canUndo, canRedo, clear,
    profile, setProfile,
    totalDistanceKm, elevationGainM, elevationLossM,
    elevationsLoading, routing, geojson, snappedWaypoints,
  } = useRouteBuilder();

  // Save form state
  const [showSavePanel, setShowSavePanel] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<PersonalVisibility>(defaultVisibility);
  const [activityType, setActivityType] = useState('');
  const [saving, setSaving] = useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSavePanel) setShowSavePanel(false);
        else onClose();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, undo, redo, showSavePanel]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://tiles.versatiles.org/assets/styles/colorful/style.json',
      center: [-80.0, 40.44],
      zoom: 12,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      map.addSource('route-line', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Line casing
      map.addLayer({
        id: 'route-line-casing',
        type: 'line',
        source: 'route-line',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#2d3180', 'line-width': 7, 'line-opacity': 0.45 },
      });

      // Main line
      map.addLayer({
        id: 'route-line-main',
        type: 'line',
        source: 'route-line',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#5865F2', 'line-width': 4, 'line-opacity': 0.95 },
      });

      // Direction arrows
      const sz = 24;
      const canvas = document.createElement('canvas');
      canvas.width = sz;
      canvas.height = sz;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.moveTo(sz * 0.25, sz * 0.2);
      ctx.lineTo(sz * 0.8, sz * 0.5);
      ctx.lineTo(sz * 0.25, sz * 0.8);
      ctx.lineTo(sz * 0.48, sz * 0.5);
      ctx.closePath();
      ctx.fill();
      const imgData = ctx.getImageData(0, 0, sz, sz);
      map.addImage('route-arrow', { width: sz, height: sz, data: new Uint8Array(imgData.data.buffer) });

      map.addLayer({
        id: 'route-line-arrows',
        type: 'symbol',
        source: 'route-line',
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 100,
          'icon-image': 'route-arrow',
          'icon-size': 0.7,
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });
    });

    // Click to add waypoint
    map.on('click', (e) => {
      addWaypoint([e.lngLat.lng, e.lngLat.lat]);
    });

    mapRef.current = map;
    return () => { map.remove(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync markers and line with state
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Update line source
    const source = map.getSource('route-line') as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(geojson || { type: 'FeatureCollection', features: [] });
    }

    // Sync markers
    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    waypoints.forEach((wp, i) => {
      const isFirst = i === 0;
      const isLast = i === waypoints.length - 1 && waypoints.length > 1;
      const isEndpoint = isFirst || isLast;

      const el = document.createElement('div');
      const size = isMobile ? (isEndpoint ? '28px' : '22px') : (isEndpoint ? '18px' : '14px');
      el.style.width = size;
      el.style.height = size;
      el.style.borderRadius = '50%';
      el.style.border = isMobile ? '3px solid white' : '2.5px solid white';
      el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.3)';
      el.style.cursor = 'grab';
      el.style.background = isFirst ? '#22c55e' : isLast ? '#ef4444' : '#5865F2';
      el.style.transition = 'transform 0.15s';

      // Desktop: right-click to delete
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeWaypoint(i);
      });

      // Mobile: long-press to delete
      if (isMobile) {
        let lpTimer: ReturnType<typeof setTimeout> | null = null;
        let didLongPress = false;
        el.addEventListener('touchstart', (e) => {
          didLongPress = false;
          lpTimer = setTimeout(() => {
            didLongPress = true;
            el.style.transform = 'scale(1.4)';
            navigator.vibrate?.(30);
            removeWaypoint(i);
          }, 500);
        }, { passive: true });
        el.addEventListener('touchmove', () => {
          if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
        }, { passive: true });
        el.addEventListener('touchend', () => {
          if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
          el.style.transform = '';
        });
      }

      const marker = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat(wp.lngLat)
        .addTo(map);

      marker.on('dragend', () => {
        const pos = marker.getLngLat();
        moveWaypoint(i, [pos.lng, pos.lat]);
      });

      el.addEventListener('click', (e) => e.stopPropagation());
      markersRef.current.push(marker);
    });
  }, [waypoints, geojson, isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (!routeName.trim() || snappedWaypoints.length < 2) return;
    setSaving(true);
    try {
      const gpxXml = generateGpxXml(routeName.trim(), snappedWaypoints);
      const file = new File([gpxXml], `${routeName.trim()}.gpx`, { type: 'application/gpx+xml' });
      await onSave(file, routeName.trim(), {
        description: description.trim() || undefined,
        visibility,
        activityType: activityType || undefined,
      });
      onClose();
    } catch {}
    setSaving(false);
  };

  const statsBlock = (
    <div style={isMobile ? mobileStyles.statsBar : styles.stats}>
      {routing && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
      <span style={styles.stat}>
        <Ruler size={13} />
        {formatDistance(totalDistanceKm, units)}
      </span>
      {(elevationGainM > 0 || elevationsLoading) && (
        <span style={styles.stat}>
          <TrendingUp size={13} />
          {elevationsLoading ? '...' : formatElevation(elevationGainM, units)}
        </span>
      )}
      {elevationLossM > 0 && !elevationsLoading && (
        <span style={styles.stat}>
          <TrendingDown size={13} />
          {formatElevation(elevationLossM, units)}
        </span>
      )}
      <span style={{ ...styles.stat, color: 'var(--text-muted)' }}>
        {waypoints.length} pts
      </span>
    </div>
  );

  const profileButtons = (
    <div style={isMobile ? mobileStyles.profileSelector : styles.profileSelector}>
      {PROFILE_OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = profile === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setProfile(opt.value)}
            style={{
              ...(isMobile ? mobileStyles.profileBtn : styles.profileBtn),
              background: active ? 'var(--accent)' : 'transparent',
              color: active ? 'white' : 'var(--text-muted)',
            }}
            title={opt.label}
          >
            <Icon size={isMobile ? 18 : 14} />
          </button>
        );
      })}
    </div>
  );

  const hintText = waypoints.length === 0
    ? (isMobile ? 'Tap the map to place your starting point' : 'Click on the map to place your starting point')
    : waypoints.length === 1
      ? (isMobile ? 'Tap to add your next waypoint — route snaps to roads' : 'Click to add your next waypoint — the route will snap to roads')
      : null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Header bar — compact on mobile */}
        <div style={isMobile ? mobileStyles.header : styles.header}>
          <MapPin size={18} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>Route Builder</span>
          {!isMobile && profileButtons}
          {!isMobile && statsBlock}
          {!isMobile && <div style={{ flex: 1 }} />}
          {!isMobile && (
            <>
              <button onClick={undo} disabled={!canUndo} style={styles.toolBtn} title="Undo (Ctrl+Z)">
                <Undo2 size={15} />
              </button>
              <button onClick={redo} disabled={!canRedo} style={styles.toolBtn} title="Redo (Ctrl+Shift+Z)">
                <Redo2 size={15} />
              </button>
              <button onClick={clear} disabled={waypoints.length === 0} style={styles.toolBtn} title="Clear all">
                <Trash2 size={15} />
              </button>
              <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
              <button
                onClick={() => setShowSavePanel(true)}
                disabled={waypoints.length < 2}
                style={{ ...styles.saveBtn, opacity: waypoints.length < 2 ? 0.5 : 1 }}
              >
                <Save size={14} /> Save Route
              </button>
            </>
          )}
          {isMobile && <div style={{ flex: 1 }} />}
          <button onClick={onClose} style={isMobile ? mobileStyles.toolBtn : styles.toolBtn} title="Close">
            <X size={isMobile ? 22 : 18} />
          </button>
        </div>

        {/* Map */}
        <div ref={mapContainerRef} style={styles.mapContainer} />

        {/* Mobile: floating stats pill at top of map */}
        {isMobile && waypoints.length > 0 && (
          <div style={mobileStyles.floatingStats}>
            {statsBlock}
          </div>
        )}

        {/* Hint overlay */}
        {hintText && (
          <div style={{
            ...styles.hint,
            ...(isMobile ? { bottom: 90, fontSize: '0.8rem', padding: '6px 14px' } : {}),
          }}>
            {hintText}
            {isMobile && waypoints.length > 0 && (
              <div style={{ fontSize: '0.7rem', marginTop: 2, opacity: 0.7 }}>
                Long-press a point to remove it
              </div>
            )}
          </div>
        )}

        {/* Mobile: bottom toolbar */}
        {isMobile && (
          <div style={mobileStyles.bottomBar}>
            {profileButtons}
            <div style={{ flex: 1 }} />
            <button onClick={undo} disabled={!canUndo} style={mobileStyles.toolBtn} title="Undo">
              <Undo2 size={20} />
            </button>
            <button onClick={redo} disabled={!canRedo} style={mobileStyles.toolBtn} title="Redo">
              <Redo2 size={20} />
            </button>
            <button onClick={clear} disabled={waypoints.length === 0} style={mobileStyles.toolBtn} title="Clear all">
              <Trash2 size={20} />
            </button>
            <button
              onClick={() => setShowSavePanel(true)}
              disabled={waypoints.length < 2}
              style={{ ...mobileStyles.saveBtn, opacity: waypoints.length < 2 ? 0.5 : 1 }}
            >
              <Save size={18} />
            </button>
          </div>
        )}

        {/* Spinner keyframe */}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

        {/* Save panel */}
        {showSavePanel && (
          <div style={styles.savePanelOverlay} onClick={() => setShowSavePanel(false)}>
            <div
              style={{
                ...styles.savePanel,
                ...(isMobile ? mobileStyles.savePanel : {}),
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>Save Route</h3>

              <label style={styles.label}>Name</label>
              <input
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                placeholder="Route name"
                style={{ ...styles.input, ...(isMobile ? mobileStyles.input : {}) }}
                maxLength={200}
                autoFocus
              />

              <label style={styles.label}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                style={{
                  ...styles.input,
                  ...(isMobile ? mobileStyles.input : {}),
                  minHeight: 60,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
                maxLength={5000}
              />

              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Visibility</label>
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as PersonalVisibility)}
                    style={{ ...styles.input, ...(isMobile ? mobileStyles.input : {}) }}
                  >
                    <option value="private">Private</option>
                    <option value="friends">Friends</option>
                    <option value="spaces">Shared Spaces</option>
                    <option value="public">Public</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Activity Type</label>
                  <select
                    value={activityType}
                    onChange={(e) => setActivityType(e.target.value)}
                    style={{ ...styles.input, ...(isMobile ? mobileStyles.input : {}) }}
                  >
                    <option value="">None</option>
                    <option value="ride">Ride</option>
                    <option value="run">Run</option>
                    <option value="walk">Walk</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  onClick={handleSave}
                  disabled={saving || !routeName.trim()}
                  style={{
                    ...styles.primaryBtn,
                    ...(isMobile ? { padding: '0.65rem 1rem' } : {}),
                    opacity: saving || !routeName.trim() ? 0.6 : 1,
                  }}
                >
                  {saving ? 'Saving...' : 'Save Route'}
                </button>
                <button
                  onClick={() => setShowSavePanel(false)}
                  style={{
                    ...styles.cancelBtn,
                    ...(isMobile ? { padding: '0.65rem 1rem' } : {}),
                  }}
                >
                  Cancel
                </button>
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
                {formatDistance(totalDistanceKm, units)}
                {elevationGainM > 0 && ` · ${formatElevation(elevationGainM, units)} gain`}
                {` · ${waypoints.length} waypoints`}
              </div>
            </div>
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
    zIndex: 9999,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'stretch',
  },
  modal: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-primary)',
    position: 'relative',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
    zIndex: 2,
    flexShrink: 0,
  },
  profileSelector: {
    display: 'flex',
    gap: 2,
    marginLeft: 8,
    background: 'var(--bg-tertiary)',
    borderRadius: 'var(--radius)',
    padding: 2,
  },
  profileBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 'calc(var(--radius) - 2px)',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  stats: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginLeft: 12,
    fontSize: '0.82rem',
    color: 'var(--text-secondary)',
  },
  stat: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  toolBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
  },
  saveBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 14px',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--accent)',
    color: 'white',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  hint: {
    position: 'absolute',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.7)',
    color: 'white',
    padding: '8px 16px',
    borderRadius: 20,
    fontSize: '0.85rem',
    zIndex: 3,
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
  },
  savePanelOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  savePanel: {
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    padding: '1.25rem',
    width: 380,
    maxWidth: '90vw',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  label: {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: 4,
    marginTop: 10,
  },
  input: {
    width: '100%',
    padding: '0.5rem 0.7rem',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  primaryBtn: {
    flex: 1,
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--accent)',
    color: 'white',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
};

const mobileStyles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
    zIndex: 2,
    flexShrink: 0,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 12px',
    paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
    background: 'var(--bg-secondary)',
    borderTop: '1px solid var(--border)',
    zIndex: 4,
  },
  toolBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
  },
  saveBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--accent)',
    color: 'white',
    cursor: 'pointer',
  },
  profileSelector: {
    display: 'flex',
    gap: 2,
    background: 'var(--bg-tertiary)',
    borderRadius: 'var(--radius)',
    padding: 2,
  },
  profileBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 'calc(var(--radius) - 2px)',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  statsBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: '0.78rem',
    color: 'var(--text-secondary)',
  },
  floatingStats: {
    position: 'absolute',
    top: 10,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.65)',
    backdropFilter: 'blur(8px)',
    color: 'white',
    padding: '6px 14px',
    borderRadius: 20,
    zIndex: 3,
    pointerEvents: 'none',
  },
  savePanel: {
    width: '100%',
    maxWidth: '100vw',
    borderRadius: 0,
    position: 'fixed' as const,
    bottom: 0,
    left: 0,
    right: 0,
    padding: '1.25rem 1rem',
    paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))',
    boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
  },
  input: {
    fontSize: '16px', // Prevents iOS auto-zoom
  },
};

export default RouteBuilderModal;
