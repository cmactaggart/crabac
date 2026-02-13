import fs from 'fs/promises';
import { parseGPXWithCustomParser } from '@we-gold/gpxjs';
import { DOMParser } from 'xmldom-qsa';

export interface GpxMetadata {
  trackName: string | null;
  distanceKm: number;
  elevationGainM: number | null;
  elevationLossM: number | null;
  durationSec: number;
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number } | null;
  geojson: any;
}

const MAX_POINTS = 2000;

function customParse(txt: string): Document | null {
  return new DOMParser().parseFromString(txt, 'text/xml');
}

/**
 * Downsample an array of coordinates to at most maxPoints using
 * uniform index stepping (keeps first and last).
 */
function downsampleCoords(coords: number[][], maxPoints: number): number[][] {
  if (coords.length <= maxPoints) return coords;
  const step = (coords.length - 1) / (maxPoints - 1);
  const result: number[][] = [];
  for (let i = 0; i < maxPoints - 1; i++) {
    result.push(coords[Math.round(i * step)]);
  }
  result.push(coords[coords.length - 1]);
  return result;
}

/**
 * Parse a GPX file from disk and return pre-computed metadata + GeoJSON.
 * Returns null on any parse failure (non-fatal).
 */
export async function parseGpxFile(filePath: string): Promise<GpxMetadata | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const [parsed, error] = parseGPXWithCustomParser(raw, customParse);

    if (error || !parsed) return null;

    // Aggregate stats across all tracks
    let totalDistanceM = 0;
    let totalElevGain: number | null = null;
    let totalElevLoss: number | null = null;
    let totalDurationSec = 0;
    let trackName: string | null = null;
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    let hasPoints = false;

    for (const track of parsed.tracks) {
      if (!trackName && track.name) trackName = track.name;
      totalDistanceM += track.distance.total;
      totalDurationSec += track.duration.totalDuration;

      if (track.elevation.positive != null) {
        totalElevGain = (totalElevGain ?? 0) + track.elevation.positive;
      }
      if (track.elevation.negative != null) {
        totalElevLoss = (totalElevLoss ?? 0) + Math.abs(track.elevation.negative);
      }

      for (const pt of track.points) {
        hasPoints = true;
        if (pt.latitude < minLat) minLat = pt.latitude;
        if (pt.latitude > maxLat) maxLat = pt.latitude;
        if (pt.longitude < minLng) minLng = pt.longitude;
        if (pt.longitude > maxLng) maxLng = pt.longitude;
      }
    }

    // Also consider routes
    for (const route of parsed.routes) {
      if (!trackName && route.name) trackName = route.name;
      totalDistanceM += route.distance.total;
      totalDurationSec += route.duration.totalDuration;

      if (route.elevation.positive != null) {
        totalElevGain = (totalElevGain ?? 0) + route.elevation.positive;
      }
      if (route.elevation.negative != null) {
        totalElevLoss = (totalElevLoss ?? 0) + Math.abs(route.elevation.negative);
      }

      for (const pt of route.points) {
        hasPoints = true;
        if (pt.latitude < minLat) minLat = pt.latitude;
        if (pt.latitude > maxLat) maxLat = pt.latitude;
        if (pt.longitude < minLng) minLng = pt.longitude;
        if (pt.longitude > maxLng) maxLng = pt.longitude;
      }
    }

    if (!hasPoints) return null;

    // Use metadata name as fallback
    if (!trackName && parsed.metadata?.name) {
      trackName = parsed.metadata.name;
    }

    // Build GeoJSON and downsample coordinates
    const geojson = parsed.toGeoJSON() as any;
    for (const feature of geojson.features) {
      const geom = feature.geometry;
      if (geom.type === 'LineString' && geom.coordinates) {
        geom.coordinates = downsampleCoords(geom.coordinates, MAX_POINTS);
      } else if (geom.type === 'MultiLineString' && geom.coordinates) {
        geom.coordinates = geom.coordinates.map((line: number[][]) =>
          downsampleCoords(line, MAX_POINTS),
        );
      }
    }

    return {
      trackName,
      distanceKm: Math.round((totalDistanceM / 1000) * 100) / 100,
      elevationGainM: totalElevGain != null ? Math.round(totalElevGain) : null,
      elevationLossM: totalElevLoss != null ? Math.round(totalElevLoss) : null,
      durationSec: Math.round(totalDurationSec),
      bounds: hasPoints
        ? { minLat, maxLat, minLng, maxLng }
        : null,
      geojson,
    };
  } catch (err) {
    console.error('GPX parse error (non-fatal):', err);
    return null;
  }
}
