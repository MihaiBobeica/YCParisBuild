import { createPortal } from 'react-dom';
import { useMap } from 'react-leaflet';
import { useEffect, useRef } from 'react';
import type { BboxPayload } from '../../hooks/useMapStations';

export interface MapNavTarget {
  lat: number;
  lon: number;
  zoom: number;
  key: string;
}

/** Apply smooth, natural map interaction defaults once on mount. */
export function MapInteractionSetup() {
  const map = useMap();

  useEffect(() => {
    map.scrollWheelZoom.enable();
    map.doubleClickZoom.enable();
    map.boxZoom.enable();
    map.keyboard.enable();

    // Gentler wheel zoom — less jumpy than Leaflet defaults.
    map.options.wheelPxPerZoomLevel = 80;
    map.options.wheelDebounceTime = 20;
    map.options.zoomSnap = 0.5;
    map.options.zoomDelta = 0.5;
    map.options.inertia = true;
    map.options.inertiaDeceleration = 2800;
    map.options.inertiaMaxSpeed = 1400;
    map.options.easeLinearity = 0.22;
    map.options.maxBoundsViscosity = 0.6;
  }, [map]);

  return null;
}

/**
 * Fly to a location only when the app explicitly requests navigation
 * (search, station select, near-me). Never fights the user's drag/zoom.
 */
export function MapNavigator({ target }: { target: MapNavTarget | null }) {
  const map = useMap();
  const lastKey = useRef('');

  useEffect(() => {
    if (!target || target.key === lastKey.current) return;
    lastKey.current = target.key;

    const current = map.getCenter();
    const dist =
      Math.abs(current.lat - target.lat) + Math.abs(current.lng - target.lon);
    const samePlace = dist < 0.002 && Math.abs(map.getZoom() - target.zoom) < 0.5;

    if (samePlace) return;

    if (dist > 0.5) {
      map.flyTo([target.lat, target.lon], target.zoom, {
        duration: 1.1,
        easeLinearity: 0.22,
      });
    } else {
      map.setView([target.lat, target.lon], target.zoom, { animate: true, duration: 0.45 });
    }
  }, [target, map]);

  return null;
}

export function BboxWatcher({
  onChange,
  onZoomChange,
}: {
  onChange: (bbox: BboxPayload) => void;
  onZoomChange: (zoom: number) => void;
}) {
  const map = useMap();
  const onChangeRef = useRef(onChange);
  const onZoomRef = useRef(onZoomChange);
  onChangeRef.current = onChange;
  onZoomRef.current = onZoomChange;

  useEffect(() => {
    const emit = () => {
      const b = map.getBounds();
      const zoom = map.getZoom();
      onZoomRef.current(zoom);
      onChangeRef.current({
        min_lat: b.getSouth(),
        min_lon: b.getWest(),
        max_lat: b.getNorth(),
        max_lon: b.getEast(),
        zoom,
      });
    };

    // Only fetch once the view has settled. Emitting mid-motion would fire a
    // request for the zoomed-out midpoint of a flyTo (an all-NL bbox), which is
    // wasteful and stalls the real destination query. The canvas keeps showing
    // current pins during the animation and refreshes on arrival.
    emit();
    map.on('moveend zoomend', emit);
    return () => {
      map.off('moveend zoomend', emit);
    };
  }, [map]);

  return null;
}

export function MapZoomControls() {
  const map = useMap();

  return createPortal(
    <div className="map-zoom-controls" aria-label="Zoom controls">
      <button type="button" aria-label="Zoom in" onClick={() => map.zoomIn(0.5)}>
        +
      </button>
      <button type="button" aria-label="Zoom out" onClick={() => map.zoomOut(0.5)}>
        −
      </button>
    </div>,
    map.getContainer(),
  );
}
