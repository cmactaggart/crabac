/**
 * Road-snapping routing via local Valhalla instance.
 * Supports bicycle and pedestrian profiles.
 */

export type RoutingProfile = 'bike' | 'foot';

const VALHALLA_URL = process.env.VALHALLA_URL || 'http://localhost:8002';

const VALHALLA_COSTINGS: Record<RoutingProfile, string> = {
  bike: 'bicycle',
  foot: 'pedestrian',
};

export interface RoutingResult {
  coordinates: [number, number][];
  distanceKm: number;
}

/**
 * Route through multiple waypoints via Valhalla, returning the snapped geometry.
 * Falls back to straight lines if Valhalla is unavailable.
 */
export async function routeThrough(
  waypoints: [number, number][],
  profile: RoutingProfile = 'bike',
): Promise<RoutingResult> {
  if (waypoints.length < 2) {
    return { coordinates: waypoints.length === 1 ? [waypoints[0]] : [], distanceKm: 0 };
  }

  const costing = VALHALLA_COSTINGS[profile] || 'bicycle';
  const locations = waypoints.map((wp) => ({ lon: wp[0], lat: wp[1] }));

  const body = JSON.stringify({
    locations,
    costing,
    directions_options: { units: 'kilometers' },
  });

  try {
    const res = await fetch(`${VALHALLA_URL}/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (!res.ok) return fallback(waypoints);
    const data = await res.json();

    if (!data.trip?.legs) return fallback(waypoints);

    // Decode the shape from all legs and merge
    const allCoords: [number, number][] = [];
    let totalDistanceKm = 0;

    for (const leg of data.trip.legs) {
      totalDistanceKm += leg.summary?.length || 0;
      const decoded = decodePolyline6(leg.shape);
      // Skip the first point of subsequent legs (duplicate of previous leg's end)
      const startIdx = allCoords.length > 0 ? 1 : 0;
      for (let i = startIdx; i < decoded.length; i++) {
        allCoords.push(decoded[i]);
      }
    }

    if (allCoords.length < 2) return fallback(waypoints);

    return { coordinates: allCoords, distanceKm: totalDistanceKm };
  } catch {
    return fallback(waypoints);
  }
}

/**
 * Decode Valhalla's encoded polyline (precision 6).
 */
function decodePolyline6(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push([lng / 1e6, lat / 1e6]); // [lng, lat]
  }

  return coords;
}

function fallback(waypoints: [number, number][]): RoutingResult {
  let dist = 0;
  for (let i = 1; i < waypoints.length; i++) {
    dist += haversineKm(waypoints[i - 1][1], waypoints[i - 1][0], waypoints[i][1], waypoints[i][0]);
  }
  return { coordinates: waypoints, distanceKm: dist };
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
