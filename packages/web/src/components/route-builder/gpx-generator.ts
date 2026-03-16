/**
 * Generate a GPX 1.1 XML string from waypoints.
 */
export function generateGpxXml(
  name: string,
  waypoints: Array<{ lngLat: [number, number]; elevation: number | null }>,
): string {
  const now = new Date().toISOString();
  const trkpts = waypoints
    .map((wp) => {
      const ele = wp.elevation != null ? `<ele>${wp.elevation}</ele>` : '';
      return `      <trkpt lat="${wp.lngLat[1]}" lon="${wp.lngLat[0]}">${ele}</trkpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="crab.ac Route Builder"
  xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(name)}</name>
    <time>${now}</time>
  </metadata>
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
