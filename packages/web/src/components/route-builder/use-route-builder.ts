import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '../../lib/api.js';

export interface Waypoint {
  lngLat: [number, number]; // [lng, lat]
  snapped: boolean; // whether the segment TO this point uses road snapping
}

export type RoutingProfile = 'bike' | 'foot';

interface SnappedPath {
  coordinates: [number, number][]; // [lng, lat] full road-snapped path
  distanceKm: number;
  elevations: number[] | null; // elevation per coordinate
}

interface State {
  waypoints: Waypoint[];
  undoStack: Waypoint[][];
  redoStack: Waypoint[][];
}

export function useRouteBuilder() {
  const [state, setState] = useState<State>({
    waypoints: [],
    undoStack: [],
    redoStack: [],
  });
  const [profile, setProfile] = useState<RoutingProfile>('bike');
  const [snappedPath, setSnappedPath] = useState<SnappedPath | null>(null);
  const [routing, setRouting] = useState(false);
  const [elevationsLoading, setElevationsLoading] = useState(false);
  const routeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { waypoints, undoStack, redoStack } = state;

  const addWaypoint = useCallback((lngLat: [number, number], snapped: boolean = true) => {
    setState((s) => ({
      waypoints: [...s.waypoints, { lngLat, snapped }],
      undoStack: [...s.undoStack.slice(-49), s.waypoints],
      redoStack: [],
    }));
  }, []);

  const moveWaypoint = useCallback((index: number, lngLat: [number, number]) => {
    setState((s) => ({
      waypoints: s.waypoints.map((wp, i) => (i === index ? { ...wp, lngLat } : wp)),
      undoStack: [...s.undoStack.slice(-49), s.waypoints],
      redoStack: [],
    }));
  }, []);

  const removeWaypoint = useCallback((index: number) => {
    setState((s) => ({
      waypoints: s.waypoints.filter((_, i) => i !== index),
      undoStack: [...s.undoStack.slice(-49), s.waypoints],
      redoStack: [],
    }));
  }, []);

  const unsnapWaypoint = useCallback((index: number) => {
    setState((s) => ({
      waypoints: s.waypoints.map((wp, i) => (i === index ? { ...wp, snapped: false } : wp)),
      undoStack: [...s.undoStack.slice(-49), s.waypoints],
      redoStack: [],
    }));
  }, []);

  const insertWaypoint = useCallback((index: number, lngLat: [number, number], snapped: boolean = true) => {
    setState((s) => ({
      waypoints: [...s.waypoints.slice(0, index), { lngLat, snapped }, ...s.waypoints.slice(index)],
      undoStack: [...s.undoStack.slice(-49), s.waypoints],
      redoStack: [],
    }));
  }, []);

  // Drag preview: update waypoint position without pushing to undo stack
  const dragOriginRef = useRef<Waypoint[] | null>(null);

  const startDragWaypoint = useCallback(() => {
    setState((s) => {
      dragOriginRef.current = s.waypoints;
      return s;
    });
  }, []);

  const previewMoveWaypoint = useCallback((index: number, lngLat: [number, number]) => {
    setState((s) => ({
      ...s,
      waypoints: s.waypoints.map((wp, i) => (i === index ? { ...wp, lngLat } : wp)),
    }));
  }, []);

  const commitDragWaypoint = useCallback((index: number, lngLat: [number, number]) => {
    const origin = dragOriginRef.current;
    dragOriginRef.current = null;
    setState((s) => ({
      waypoints: s.waypoints.map((wp, i) => (i === index ? { ...wp, lngLat } : wp)),
      undoStack: [...s.undoStack.slice(-49), origin || s.waypoints],
      redoStack: [],
    }));
  }, []);

  const undo = useCallback(() => {
    setState((s) => {
      if (s.undoStack.length === 0) return s;
      const prev = s.undoStack[s.undoStack.length - 1];
      return {
        waypoints: prev,
        undoStack: s.undoStack.slice(0, -1),
        redoStack: [...s.redoStack, s.waypoints],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((s) => {
      if (s.redoStack.length === 0) return s;
      const next = s.redoStack[s.redoStack.length - 1];
      return {
        waypoints: next,
        undoStack: [...s.undoStack, s.waypoints],
        redoStack: s.redoStack.slice(0, -1),
      };
    });
  }, []);

  const clear = useCallback(() => {
    setState((s) => ({
      waypoints: [],
      undoStack: [...s.undoStack.slice(-49), s.waypoints],
      redoStack: [],
    }));
    setSnappedPath(null);
  }, []);

  // Waypoint fingerprint for effect dependencies
  const waypointKey = waypoints.map((w) => `${w.lngLat[0]},${w.lngLat[1]},${w.snapped}`).join('|');

  // Fetch road-snapped route when waypoints or profile change
  useEffect(() => {
    if (routeTimer.current) clearTimeout(routeTimer.current);

    if (waypoints.length < 2) {
      setSnappedPath(null);
      return;
    }

    routeTimer.current = setTimeout(async () => {
      setRouting(true);
      try {
        const result = await routeSegmented(waypoints, profile);
        setSnappedPath({ coordinates: result.coordinates, distanceKm: result.distanceKm, elevations: null });
        fetchPathElevations(result.coordinates);
      } catch {
        const coords = waypoints.map((wp) => wp.lngLat as [number, number]);
        setSnappedPath({ coordinates: coords, distanceKm: 0, elevations: null });
      }
      setRouting(false);
    }, 150);

    return () => { if (routeTimer.current) clearTimeout(routeTimer.current); };
  }, [waypointKey, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch elevations for the snapped path
  const fetchPathElevations = async (coords: [number, number][]) => {
    if (coords.length === 0) return;
    setElevationsLoading(true);
    try {
      // Open-Meteo accepts max 100 coords — sample evenly if needed
      let sampleCoords = coords;
      let sampleIndices: number[] | null = null;
      if (coords.length > 100) {
        sampleIndices = [];
        const step = (coords.length - 1) / 99;
        for (let i = 0; i < 99; i++) sampleIndices.push(Math.round(i * step));
        sampleIndices.push(coords.length - 1);
        sampleCoords = sampleIndices.map((idx) => coords[idx]);
      }

      const latLngs = sampleCoords.map((c) => [c[1], c[0]] as [number, number]);
      const result = await api<{ elevations: number[] }>('/users/me/collections/routes/elevation', {
        method: 'POST',
        body: JSON.stringify({ coordinates: latLngs }),
      });

      // Interpolate elevations back to full path if we sampled
      let fullElevations: number[];
      if (sampleIndices && sampleIndices.length === result.elevations.length) {
        fullElevations = new Array(coords.length);
        // Fill sampled points
        for (let i = 0; i < sampleIndices.length; i++) {
          fullElevations[sampleIndices[i]] = result.elevations[i];
        }
        // Linear interpolation between sampled points
        for (let s = 0; s < sampleIndices.length - 1; s++) {
          const startIdx = sampleIndices[s];
          const endIdx = sampleIndices[s + 1];
          const startEle = result.elevations[s];
          const endEle = result.elevations[s + 1];
          for (let j = startIdx + 1; j < endIdx; j++) {
            const t = (j - startIdx) / (endIdx - startIdx);
            fullElevations[j] = startEle + t * (endEle - startEle);
          }
        }
      } else {
        fullElevations = result.elevations;
      }

      setSnappedPath((prev) =>
        prev ? { ...prev, elevations: fullElevations } : prev,
      );
    } catch {
      // Graceful degradation
    }
    setElevationsLoading(false);
  };

  // Compute elevation gain/loss from snapped path elevations
  let elevationGainM = 0;
  let elevationLossM = 0;
  if (snappedPath?.elevations) {
    for (let i = 1; i < snappedPath.elevations.length; i++) {
      const diff = snappedPath.elevations[i] - snappedPath.elevations[i - 1];
      if (diff > 0) elevationGainM += diff;
      else elevationLossM += Math.abs(diff);
    }
  }

  // GeoJSON for the snapped route line
  const geojson: any =
    snappedPath && snappedPath.coordinates.length >= 2
      ? {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: snappedPath.coordinates.map((c, i) => [
                  c[0],
                  c[1],
                  snappedPath.elevations?.[i] ?? 0,
                ]),
              },
            },
          ],
        }
      : null;

  // For GPX generation: full snapped path with elevations
  const snappedWaypoints: Array<{ lngLat: [number, number]; elevation: number | null }> =
    snappedPath
      ? snappedPath.coordinates.map((c, i) => ({
          lngLat: c,
          elevation: snappedPath.elevations?.[i] ?? null,
        }))
      : [];

  return {
    waypoints,
    addWaypoint,
    moveWaypoint,
    removeWaypoint,
    unsnapWaypoint,
    insertWaypoint,
    startDragWaypoint,
    previewMoveWaypoint,
    commitDragWaypoint,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    clear,
    profile,
    setProfile,
    totalDistanceKm: snappedPath?.distanceKm ?? 0,
    elevationGainM: Math.round(elevationGainM),
    elevationLossM: Math.round(elevationLossM),
    elevationsLoading,
    routing,
    geojson,
    snappedWaypoints,
  };
}

/**
 * Routes through waypoints segment-by-segment.
 * Snapped segments go through Valhalla; unsnapped segments are straight lines.
 */
async function routeSegmented(
  waypoints: Waypoint[],
  profile: RoutingProfile,
): Promise<{ coordinates: [number, number][]; distanceKm: number }> {
  const allCoords: [number, number][] = [];
  let totalDistance = 0;

  // Group consecutive snapped waypoints for batch routing
  let i = 0;
  while (i < waypoints.length - 1) {
    const segStart = i;

    if (waypoints[i + 1].snapped) {
      // Find the run of consecutive snapped segments
      let segEnd = i + 1;
      while (segEnd < waypoints.length - 1 && waypoints[segEnd + 1].snapped) {
        segEnd++;
      }

      // Route this group through Valhalla
      const groupWps = waypoints.slice(segStart, segEnd + 1).map((wp) => wp.lngLat as [number, number]);
      try {
        const result = await api<{ coordinates: [number, number][]; distanceKm: number }>(
          '/users/me/collections/routes/route',
          { method: 'POST', body: JSON.stringify({ waypoints: groupWps, profile }) },
        );
        // Append, skipping first point if we already have coords (avoid duplicate)
        const startIdx = allCoords.length > 0 ? 1 : 0;
        for (let j = startIdx; j < result.coordinates.length; j++) {
          allCoords.push(result.coordinates[j]);
        }
        totalDistance += result.distanceKm;
      } catch {
        // Fallback to straight lines for this group
        const startIdx = allCoords.length > 0 ? 1 : 0;
        for (let j = startIdx; j < groupWps.length; j++) {
          allCoords.push(groupWps[j]);
        }
        totalDistance += straightLineDistance(groupWps);
      }

      i = segEnd;
    } else {
      // Unsnapped segment: straight line
      if (allCoords.length === 0) {
        allCoords.push(waypoints[i].lngLat);
      }
      allCoords.push(waypoints[i + 1].lngLat);
      totalDistance += haversineKm(
        waypoints[i].lngLat[1], waypoints[i].lngLat[0],
        waypoints[i + 1].lngLat[1], waypoints[i + 1].lngLat[0],
      );
      i++;
    }
  }

  return { coordinates: allCoords, distanceKm: totalDistance };
}

function straightLineDistance(points: [number, number][]): number {
  let dist = 0;
  for (let i = 1; i < points.length; i++) {
    dist += haversineKm(points[i - 1][1], points[i - 1][0], points[i][1], points[i][0]);
  }
  return dist;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
