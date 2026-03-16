/**
 * Elevation lookup via Open-Meteo (free, no API key required).
 * Accepts batches of up to 100 coordinate pairs.
 */
export async function fetchElevations(coords: [number, number][]): Promise<number[]> {
  if (coords.length === 0) return [];

  const latitudes = coords.map((c) => c[0]).join(',');
  const longitudes = coords.map((c) => c[1]).join(',');
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${latitudes}&longitude=${longitudes}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return coords.map(() => 0);
    const data = await res.json();
    return (data.elevation as number[]) || coords.map(() => 0);
  } catch {
    return coords.map(() => 0);
  }
}
