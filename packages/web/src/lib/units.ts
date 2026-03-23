import type { DistanceUnits } from '@crabac/shared';

export function formatDistance(km: number, units: DistanceUnits): string {
  km = Number(km) || 0;
  if (units === 'us_customary') {
    const mi = km * 0.621371;
    if (mi < 0.1) return `${Math.round(km * 3280.84)} ft`;
    return `${mi.toFixed(1)} mi`;
  }
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function formatElevation(m: number, units: DistanceUnits): string {
  m = Number(m) || 0;
  if (units === 'us_customary') return `${Math.round(m * 3.28084)} ft`;
  return `${Math.round(m)} m`;
}

export function formatFlatness(f: number, units: DistanceUnits): string {
  f = Number(f) || 0;
  if (units === 'us_customary') return `${f.toFixed(0)} ft/mi`;
  // Flatness is stored as ft/mi — convert to m/km
  const mPerKm = f / 3.28084 * 0.621371;
  return `${mPerKm.toFixed(0)} m/km`;
}
