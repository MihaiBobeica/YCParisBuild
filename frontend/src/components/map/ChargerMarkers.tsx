import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import type { StationPin } from '../../api/client';
import { PIN_COLORS } from './mapConfig';

function makeIcon(station: StationPin, selected: boolean) {
  const color = PIN_COLORS[station.pin_color] || PIN_COLORS.gray;
  const price = station.energy_price != null ? `€${station.energy_price.toFixed(2)}` : '—';
  const power = station.max_power_kw != null ? `${Math.round(station.max_power_kw)} kW` : '? kW';
  const selectedClass = selected ? ' selected' : '';

  return L.divIcon({
    className: '',
    html: `
      <div style="text-align:center">
        <div class="charger-pin-label">${price}<br/>${power}</div>
        <div class="charger-pin-dot${selectedClass}" style="border-color:${color}">${station.availability_label?.includes('Available') ? '✓' : '·'}</div>
      </div>
    `,
    iconSize: [80, 60],
    iconAnchor: [40, 60],
  });
}

interface Props {
  stations: StationPin[];
  selectedId: string | null;
  onSelect: (station: StationPin) => void;
}

export function ChargerMarkers({ stations, selectedId, onSelect }: Props) {
  return (
    <>
      {stations.map((s) => (
        <Marker
          key={s.id}
          position={[s.latitude, s.longitude]}
          icon={makeIcon(s, s.id === selectedId)}
          eventHandlers={{ click: () => onSelect(s) }}
        >
          <Popup>
            <strong>{s.name || 'Charger'}</strong>
            <br />
            {s.availability_label}
            <br />
            {s.energy_price != null ? `€${s.energy_price.toFixed(2)}/kWh` : 'Price unknown'}
          </Popup>
        </Marker>
      ))}
    </>
  );
}
