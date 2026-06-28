import { MapContainer, TileLayer } from 'react-leaflet';
import {
  BboxWatcher,
  MapInteractionSetup,
  MapNavigator,
  MapZoomControls,
  type MapNavTarget,
} from './MapController';
import { ChargerMarkers } from './ChargerMarkers';
import { PartnerMarkers } from './PartnerMarkers';
import { SearchDestinationPin, type SearchDestination } from './SearchDestinationPin';
import type { PartnerSite } from '../../data/partnerSites';
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
  onSelectPartner: (site: PartnerSite) => void;
  onBboxChange: (bbox: BboxPayload) => void;
  navTarget?: MapNavTarget | null;
  searchDestination?: SearchDestination | null;
}

export function ChargerMap({
  stations,
  selectedId,
  onSelect,
  onSelectPartner,
  onBboxChange,
  navTarget = null,
  searchDestination = null,
}: Props) {
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
      <BboxWatcher onChange={onBboxChange} />
      <MapZoomControls />
      <ChargerMarkers stations={stations} selectedId={selectedId} onSelect={onSelect} />
      <PartnerMarkers onSelect={onSelectPartner} />
      <SearchDestinationPin destination={searchDestination} />
    </MapContainer>
  );
}
