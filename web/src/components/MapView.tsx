/**
 * Map surface — react-map-gl v8 over mapbox-gl, light-v11, Prague default.
 * Ported from the legacy Svelte Map component (src/lib/components/Map.svelte):
 * same style, same route-ink color, same Prague center.
 */
import { useEffect, type ReactNode } from 'react';
import Map, {
  Layer,
  NavigationControl,
  ScaleControl,
  Source,
  useMap
} from 'react-map-gl/mapbox';
import { segmentsToFeatureCollection } from '../geo/segments';
import { theme } from '../theme';
import type { BBox, LngLat, SegmentMeta } from '../types';

export const PRAGUE_CENTER: LngLat = [14.4378, 50.0755];

export function MapView({
  children,
  interactive = true
}: {
  children?: ReactNode;
  interactive?: boolean;
}) {
  return (
    <Map
      mapboxAccessToken={import.meta.env.VITE_MAPBOX_ACCESS_TOKEN}
      initialViewState={{ longitude: PRAGUE_CENTER[0], latitude: PRAGUE_CENTER[1], zoom: 13 }}
      mapStyle="mapbox://styles/mapbox/light-v11"
      minZoom={10}
      maxZoom={18}
      dragRotate={false}
      touchPitch={false}
      interactive={interactive}
      reuseMaps
      style={{ position: 'absolute', inset: 0 }}
    >
      {interactive && <NavigationControl position="top-right" showCompass={false} />}
      <ScaleControl position="bottom-left" maxWidth={100} />
      {children}
    </Map>
  );
}

/**
 * Route rendering with per-segment provenance colors:
 * ink (solid blue) · connector (gray, dashed feel) · retrace (lighter blue).
 * `dim` renders the layer subdued (used for the unit-preview under a solve).
 */
export function RouteLayers({
  id,
  coords,
  segments,
  dim = false
}: {
  id: string;
  coords: LngLat[];
  segments: SegmentMeta[];
  dim?: boolean;
}) {
  const data = segmentsToFeatureCollection(coords, segments);
  const opacity = dim ? 0.35 : 0.92;

  return (
    <Source id={id} type="geojson" data={data}>
      <Layer
        id={`${id}-retrace`}
        type="line"
        filter={['==', ['get', 'class'], 'retrace']}
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{
          'line-color': theme.color.segmentRetrace,
          'line-width': dim ? 2.5 : 3.5,
          'line-opacity': opacity,
          'line-dasharray': [0.1, 1.6]
        }}
      />
      <Layer
        id={`${id}-connector`}
        type="line"
        filter={['==', ['get', 'class'], 'connector']}
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{
          'line-color': theme.color.segmentConnector,
          'line-width': dim ? 2 : 3,
          'line-opacity': opacity * 0.85,
          'line-dasharray': [1.6, 1.4]
        }}
      />
      <Layer
        id={`${id}-ink`}
        type="line"
        filter={['==', ['get', 'class'], 'ink']}
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{
          'line-color': dim ? theme.color.inkSoft : theme.color.segmentInk,
          'line-width': dim ? 3 : 4.5,
          'line-opacity': opacity
        }}
      />
    </Source>
  );
}

/** Fly the camera to a placement bbox whenever its identity changes. */
export function FitBounds({ bbox, padding = 90 }: { bbox: BBox | null; padding?: number }) {
  const { current: map } = useMap();
  const key = bbox
    ? `${bbox.min_lng.toFixed(4)},${bbox.min_lat.toFixed(4)},${bbox.max_lng.toFixed(4)},${bbox.max_lat.toFixed(4)}`
    : '';

  useEffect(() => {
    if (!map || !bbox) return;
    map.fitBounds(
      [
        [bbox.min_lng, bbox.min_lat],
        [bbox.max_lng, bbox.max_lat]
      ],
      { padding, duration: 900, essential: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);

  return null;
}
