import { useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import {
  BboxWatcher,
  MapInteractionSetup,
  MapNavigator,
  MapZoomControls,
  type MapNavTarget,
} from './MapController';
import { ChargerMarkers } from './ChargerMarkers';
import { SearchDestinationPin, type SearchDestination } from './SearchDestinationPin';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  NL_BOUNDS,
  NL_CENTER,
  TILE_ATTRIBUTION,
  TILE_URL,
} from './mapConfig';
import type { StationPin } from '../../api/client';
import type { BboxPayload } from '../../hooks/useMapStations';

interface Props {
  stations: StationPin[];
  selectedId: string | null;
  onSelect: (station: StationPin) => void;
  onBboxChange: (bbox: BboxPayload) => void;
  navTarget?: MapNavTarget | null;
  searchDestination?: SearchDestination | null;
}

export function ChargerMap({
  stations,
  selectedId,
  onSelect,
  onBboxChange,
  navTarget = null,
  searchDestination = null,
}: Props) {
  const [liveZoom, setLiveZoom] = useState(8);

  return (
    <MapContainer
      center={NL_CENTER as [number, number]}
      zoom={8}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      maxBounds={NL_BOUNDS}
      maxBoundsViscosity={0.6}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
      scrollWheelZoom
      preferCanvas
      zoomSnap={0.5}
      zoomDelta={0.5}
    >
      <TileLayer
        url={TILE_URL}
        attribution={TILE_ATTRIBUTION}
        keepBuffer={4}
        updateWhenZooming
        className="map-tiles"
      />
      <MapInteractionSetup />
      <MapNavigator target={navTarget} />
      <BboxWatcher
        onChange={onBboxChange}
        onZoomChange={setLiveZoom}
      />
      <MapZoomControls />
      <ChargerMarkers
        stations={stations}
        selectedId={selectedId}
        zoom={liveZoom}
        onSelect={onSelect}
      />
      <SearchDestinationPin destination={searchDestination} />
    </MapContainer>
  );
}
