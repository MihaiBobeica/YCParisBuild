import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import type { StationPin } from '../../api/client';
import { StationCanvasLayer } from './StationCanvasLayer';

interface Props {
  stations: StationPin[];
  selectedId: string | null;
  onSelect: (station: StationPin) => void;
}

export function StationCanvasLayerComponent({ stations, selectedId, onSelect }: Props) {
  const map = useMap();
  const layerRef = useRef<StationCanvasLayer | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const layer = new StationCanvasLayer();
    layer.addTo(map);
    layerRef.current = layer;
    return () => {
      layer.remove();
      layerRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    layerRef.current?.setData(stations, selectedId, (s) => onSelectRef.current(s));
  }, [stations, selectedId]);

  return null;
}
