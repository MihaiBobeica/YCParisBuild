import { Marker } from 'react-leaflet';
import L from 'leaflet';

export interface SearchDestination {
  lat: number;
  lon: number;
  label: string;
}

function destinationIcon(label: string) {
  const short = label.length > 24 ? `${label.slice(0, 22)}…` : label;
  return L.divIcon({
    className: 'dest-pin-wrap',
    html: `
      <div class="dest-pin">
        <span class="dest-pin-ring"></span>
        <span class="dest-pin-dot"></span>
        <div class="dest-pin-label">${short}</div>
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

export function SearchDestinationPin({ destination }: { destination: SearchDestination | null }) {
  if (!destination) return null;

  return (
    <Marker
      position={[destination.lat, destination.lon]}
      icon={destinationIcon(destination.label)}
      zIndexOffset={1000}
    />
  );
}
