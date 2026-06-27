import { CircleMarker, Marker } from 'react-leaflet';
import L from 'leaflet';

export interface SearchDestination {
  lat: number;
  lon: number;
  label: string;
}

function destinationIcon(label: string) {
  const short = label.length > 22 ? `${label.slice(0, 20)}…` : label;
  return L.divIcon({
    className: 'search-pin-wrap',
    html: `
      <div class="search-pin">
        <div class="search-pin-dot"></div>
        <div class="search-pin-label">${short}</div>
      </div>
    `,
    iconSize: [120, 56],
    iconAnchor: [14, 14],
  });
}

export function SearchDestinationPin({ destination }: { destination: SearchDestination | null }) {
  if (!destination) return null;

  return (
    <>
      <CircleMarker
        center={[destination.lat, destination.lon]}
        radius={18}
        pathOptions={{
          color: '#007AFF',
          weight: 2,
          fillColor: '#007AFF',
          fillOpacity: 0.15,
        }}
      />
      <Marker
        position={[destination.lat, destination.lon]}
        icon={destinationIcon(destination.label)}
        zIndexOffset={1000}
      />
    </>
  );
}
