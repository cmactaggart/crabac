import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';

interface Props {
  geojson: any;
  bounds?: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null;
  width?: number | string;
  height?: number | string;
  lineColor?: string;
  style?: React.CSSProperties;
}

/**
 * Small non-interactive MapLibre map with a route line overlaid on the base layer.
 * Used for route/GPX preview thumbnails.
 */
export function MiniMap({ geojson, bounds, width = '100%', height = 120, lineColor = '#5865F2', style: containerStyle }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || !geojson?.features) return;

    // Compute bounds from geojson if not provided
    let fitBounds = bounds;
    if (!fitBounds) {
      let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
      for (const feature of geojson.features) {
        const geom = feature.geometry;
        const coordArrays = geom.type === 'LineString' ? [geom.coordinates]
          : geom.type === 'MultiLineString' ? geom.coordinates : [];
        for (const coords of coordArrays) {
          for (const c of coords) {
            if (c[0] < minLng) minLng = c[0];
            if (c[0] > maxLng) maxLng = c[0];
            if (c[1] < minLat) minLat = c[1];
            if (c[1] > maxLat) maxLat = c[1];
          }
        }
      }
      if (minLng !== Infinity) {
        fitBounds = { minLng, minLat, maxLng, maxLat };
      }
    }

    const map = new maplibregl.Map({
      container: mapRef.current,
      style: 'https://tiles.versatiles.org/assets/styles/colorful/style.json',
      interactive: false,
      attributionControl: false,
      ...(fitBounds ? {
        bounds: [fitBounds.minLng, fitBounds.minLat, fitBounds.maxLng, fitBounds.maxLat] as [number, number, number, number],
        fitBoundsOptions: { padding: 20 },
      } : {
        center: [0, 0] as [number, number],
        zoom: 2,
      }),
    });

    mapInstance.current = map;

    map.on('load', () => {
      map.addSource('route', {
        type: 'geojson',
        data: geojson,
      });

      map.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#2d3180',
          'line-width': 5,
          'line-opacity': 0.4,
        },
      });

      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': lineColor,
          'line-width': 3,
          'line-opacity': 0.9,
        },
      });
    });

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, [geojson, bounds, lineColor]);

  return (
    <div
      ref={mapRef}
      style={{
        width,
        height,
        overflow: 'hidden',
        ...containerStyle,
      }}
    />
  );
}
