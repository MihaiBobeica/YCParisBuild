import { useMap } from 'react-leaflet';
import { useEffect } from 'react';
import type { LatLngExpression } from 'leaflet';

export function MapController({ center, zoom }: { center: LatLngExpression; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

export function BboxWatcher({ onChange }: { onChange: (bbox: { min_lat: number; min_lon: number; max_lat: number; max_lon: number }) => void }) {
  const map = useMap();
  useEffect(() => {
    const handler = () => {
      const b = map.getBounds();
      onChange({
        min_lat: b.getSouth(),
        min_lon: b.getWest(),
        max_lat: b.getNorth(),
        max_lon: b.getEast(),
      });
    };
    handler();
    map.on('moveend', handler);
    return () => {
      map.off('moveend', handler);
    };
  }, [map, onChange]);
  return null;
}
