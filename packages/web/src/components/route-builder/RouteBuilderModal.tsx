import { useEffect, useRef, useState } from 'react';
import { X, Undo2, Redo2, Trash2, Ruler, TrendingUp, TrendingDown, MapPin, Save, Bike, Footprints, Loader2 } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useRouteBuilder, type RoutingProfile, type Waypoint } from './use-route-builder.js';
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
    waypoints, addWaypoint, moveWaypoint, removeWaypoint, unsnapWaypoint,
    insertWaypoint, startDragWaypoint, previewMoveWaypoint, commitDragWaypoint,
    undo, redo, canUndo, canRedo, clear,
    profile, setProfile,
    totalDistanceKm, elevationGainM, elevationLossM,
    elevationsLoading, routing, geojson, snappedWaypoints,
  } = useRouteBuilder();

  // Context menu state for waypoint right-click
  const [wpContextMenu, setWpContextMenu] = useState<{ x: number; y: number; index: number } | null>(null);

  // Context menu state for clicking on an existing path segment
  const [pathContextMenu, setPathContextMenu] = useState<{ x: number; y: number; lngLat: [number, number]; insertIndex: number } | null>(null);

  // Track dragging state to prevent marker rebuilds mid-drag
  const draggingRef = useRef<number | null>(null);

  // Ref for waypoints so map event handlers can access current value
  const waypointsRef = useRef(waypoints);
  waypointsRef.current = waypoints;

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

    // Click on existing route line to show path context menu
    let routeLineClicked = false;
    map.on('click', 'route-line-casing', (e) => {
      routeLineClicked = true;
      const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      const insertIndex = findClosestSegmentIndex(lngLat, waypointsRef.current);
      setPathContextMenu({
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
        lngLat,
        insertIndex,
      });
    });

    // Right-click on route line also shows path context menu
    map.on('contextmenu', 'route-line-casing', (e) => {
      e.preventDefault();
      routeLineClicked = true;
      const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      const insertIndex = findClosestSegmentIndex(lngLat, waypointsRef.current);
      setPathContextMenu({
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
        lngLat,
        insertIndex,
      });
    });

    // Cursor change on route line hover
    map.on('mouseenter', 'route-line-casing', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'route-line-casing', () => {
      map.getCanvas().style.cursor = '';
    });

    // Left-click / tap to add snapped waypoint
    map.on('click', (e) => {
      if (routeLineClicked) { routeLineClicked = false; return; }
      addWaypoint([e.lngLat.lng, e.lngLat.lat], true);
    });

    // Right-click on map to add unsnapped waypoint (straight line)
    map.on('contextmenu', (e) => {
      if (routeLineClicked) { routeLineClicked = false; return; }
      addWaypoint([e.lngLat.lng, e.lngLat.lat], false);
    });

    // Mobile: long-press on map to add unsnapped waypoint
    let mapLpTimer: ReturnType<typeof setTimeout> | null = null;
    let mapLpCoord: [number, number] | null = null;
    const canvas = map.getCanvas();
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const lngLat = map.unproject([touch.clientX - canvas.getBoundingClientRect().left, touch.clientY - canvas.getBoundingClientRect().top]);
      mapLpCoord = [lngLat.lng, lngLat.lat];
      mapLpTimer = setTimeout(() => {
        if (mapLpCoord) {
          navigator.vibrate?.(30);
          addWaypoint(mapLpCoord, false);
          mapLpCoord = null;
        }
      }, 500);
    }, { passive: true });
    canvas.addEventListener('touchmove', () => {
      if (mapLpTimer) { clearTimeout(mapLpTimer); mapLpTimer = null; mapLpCoord = null; }
    }, { passive: true });
    canvas.addEventListener('touchend', () => {
      if (mapLpTimer) { clearTimeout(mapLpTimer); mapLpTimer = null; mapLpCoord = null; }
    });

    mapRef.current = map;
    return () => { map.remove(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync route line GeoJSON (always runs, even during drag)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource('route-line') as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(geojson || { type: 'FeatureCollection', features: [] });
    }
  }, [geojson]);

  // Sync markers with state (skipped during drag to avoid disrupting active drag)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || draggingRef.current !== null) return;

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

      // Dashed border for unsnapped waypoints (not first — first has no incoming segment)
      if (!wp.snapped && i > 0) {
        el.style.border = isMobile ? '3px dashed white' : '2.5px dashed white';
      }

      // Desktop: right-click to show context menu
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setWpContextMenu({ x: e.clientX, y: e.clientY, index: i });
      });

      // Mobile: long-press to show context menu
      if (isMobile) {
        let lpTimer: ReturnType<typeof setTimeout> | null = null;
        el.addEventListener('touchstart', (e) => {
          const touch = e.touches[0];
          lpTimer = setTimeout(() => {
            el.style.transform = 'scale(1.4)';
            navigator.vibrate?.(30);
            setWpContextMenu({ x: touch.clientX, y: touch.clientY, index: i });
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

      // Live route preview during drag
      marker.on('dragstart', () => {
        draggingRef.current = i;
        startDragWaypoint();
      });
      marker.on('drag', () => {
        const pos = marker.getLngLat();
        previewMoveWaypoint(i, [pos.lng, pos.lat]);
      });
      marker.on('dragend', () => {
        const pos = marker.getLngLat();
        draggingRef.current = null;
        commitDragWaypoint(i, [pos.lng, pos.lat]);
      });

      el.addEventListener('click', (e) => e.stopPropagation());
      markersRef.current.push(marker);
    });
  }, [waypoints, isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

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
      ? (isMobile ? 'Tap to add waypoints — long press to add without road snapping' : 'Left-click to snap to roads — right-click for straight lines')
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

        {/* Waypoint context menu */}
        {wpContextMenu && (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 200 }}
            onClick={() => setWpContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setWpContextMenu(null); }}
          >
            <div style={{
              position: 'absolute',
              top: wpContextMenu.y,
              left: wpContextMenu.x,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius, 6px)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              padding: '4px 0',
              minWidth: 160,
              zIndex: 201,
            }}>
              {wpContextMenu.index > 0 && waypoints[wpContextMenu.index]?.snapped && (
                <button
                  onClick={() => { unsnapWaypoint(wpContextMenu.index); setWpContextMenu(null); }}
                  style={ctxMenuBtnStyle}
                >
                  Unsnap segment
                </button>
              )}
              <button
                onClick={() => { removeWaypoint(wpContextMenu.index); setWpContextMenu(null); }}
                style={{ ...ctxMenuBtnStyle, color: 'var(--danger, #ed4245)' }}
              >
                Delete waypoint
              </button>
            </div>
          </div>
        )}

        {/* Path context menu (click on existing route line) */}
        {pathContextMenu && (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 200 }}
            onClick={() => setPathContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setPathContextMenu(null); }}
          >
            <div style={{
              position: 'absolute',
              top: pathContextMenu.y,
              left: pathContextMenu.x,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius, 6px)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              padding: '4px 0',
              minWidth: 160,
              zIndex: 201,
            }}>
              <button
                onClick={() => {
                  insertWaypoint(pathContextMenu.insertIndex, pathContextMenu.lngLat, true);
                  setPathContextMenu(null);
                }}
                style={ctxMenuBtnStyle}
              >
                Insert waypoint
              </button>
              <button
                onClick={() => {
                  addWaypoint(pathContextMenu.lngLat, true);
                  setPathContextMenu(null);
                }}
                style={ctxMenuBtnStyle}
              >
                Route to here
              </button>
            </div>
          </div>
        )}

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
                    <option value="followers">Followers</option>
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

const ctxMenuBtnStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '6px 12px',
  background: 'none',
  border: 'none',
  color: 'var(--text-primary)',
  fontSize: '0.82rem',
  textAlign: 'left',
  cursor: 'pointer',
};

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

/** Find which segment (between consecutive waypoints) a point is closest to. Returns the insert index. */
function findClosestSegmentIndex(point: [number, number], waypoints: { lngLat: [number, number] }[]): number {
  if (waypoints.length < 2) return waypoints.length;
  let minDist = Infinity;
  let bestIndex = 1;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const dist = pointToSegmentDistance(point, waypoints[i].lngLat, waypoints[i + 1].lngLat);
    if (dist < minDist) {
      minDist = dist;
      bestIndex = i + 1;
    }
  }
  return bestIndex;
}

function pointToSegmentDistance(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.sqrt((p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  const px = a[0] + t * dx;
  const py = a[1] + t * dy;
  return Math.sqrt((p[0] - px) ** 2 + (p[1] - py) ** 2);
}

export default RouteBuilderModal;
