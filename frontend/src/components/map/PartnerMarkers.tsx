import { memo } from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';
import { PARTNER_SITES, type PartnerSite } from '../../data/partnerSites';

function partnerIcon(site: PartnerSite) {
  const price = `€${site.energy_price.toFixed(2)}/kWh`;
  const capacity = `${Math.round(site.max_power_kw)} kW`;
  return L.divIcon({
    className: 'partner-pin-wrap',
    html: `
      <div class="partner-pin">
        <span class="partner-pin-pulse"></span>
        <span class="partner-pin-core"></span>
        <span class="partner-pin-bubble">
          <span class="partner-pin-bubble-price">${price}</span>
          <span class="partner-pin-bubble-cap">${capacity}</span>
        </span>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

// PARTNER_SITES is static, so build the divIcons once instead of on every render.
const PARTNER_ICONS = new Map(PARTNER_SITES.map((site) => [site.id, partnerIcon(site)]));

interface Props {
  onSelect: (site: PartnerSite) => void;
}

export const PartnerMarkers = memo(function PartnerMarkers({ onSelect }: Props) {
  return (
    <>
      {PARTNER_SITES.map((site) => (
        <Marker
          key={site.id}
          position={[site.latitude, site.longitude]}
          icon={PARTNER_ICONS.get(site.id)}
          zIndexOffset={2000}
          eventHandlers={{ click: () => onSelect(site) }}
        />
      ))}
    </>
  );
});
