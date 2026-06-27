import { MapContainer, TileLayer } from 'react-leaflet';
import { BboxWatcher, MapController } from './MapController';
import { ChargerMarkers } from './ChargerMarkers';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  NL_BOUNDS,
  NL_CENTER,
  TILE_ATTRIBUTION,
  TILE_URL,
} from './mapConfig';
import type { StationPin } from '../../api/client';

interface Props {
  stations: StationPin[];
  selectedId: string | null;
  onSelect: (station: StationPin) => void;
  onBboxChange: (bbox: { min_lat: number; min_lon: number; max_lat: number; max_lon: number }) => void;
  center?: [number, number];
  zoom?: number;
}

export function ChargerMap({
  stations,
  selectedId,
  onSelect,
  onBboxChange,
  center = NL_CENTER as [number, number],
  zoom = 8,
}: Props) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      maxBounds={NL_BOUNDS}
      maxBoundsViscosity={1.0}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
      <MapController center={center} zoom={zoom} />
      <BboxWatcher onChange={onBboxChange} />
      <ChargerMarkers stations={stations} selectedId={selectedId} onSelect={onSelect} />
    </MapContainer>
  );
}
