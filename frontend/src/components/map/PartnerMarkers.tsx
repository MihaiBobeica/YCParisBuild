import { Marker } from 'react-leaflet';
import L from 'leaflet';
import { PARTNER_SITES, type PartnerSite } from '../../data/partnerSites';

function partnerIcon(site: PartnerSite) {
  const price = `€${site.energy_price.toFixed(2)}/kWh`;
  return L.divIcon({
    className: 'partner-pin-wrap',
    html: `
      <div class="partner-pin">
        <span class="partner-pin-pulse"></span>
        <span class="partner-pin-core"></span>
        <span class="partner-pin-bubble">${price}</span>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

interface Props {
  onSelect: (site: PartnerSite) => void;
}

export function PartnerMarkers({ onSelect }: Props) {
  return (
    <>
      {PARTNER_SITES.map((site) => (
        <Marker
          key={site.id}
          position={[site.latitude, site.longitude]}
          icon={partnerIcon(site)}
          zIndexOffset={2000}
          eventHandlers={{ click: () => onSelect(site) }}
        />
      ))}
    </>
  );
}
