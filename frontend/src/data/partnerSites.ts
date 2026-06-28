import type { StationDetail } from '../api/client';

export interface PartnerSite {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  energy_price: number;
  currency: string;
  max_power_kw: number;
  connector_types: string[];
  total_slots: number;
}

/**
 * Manually onboarded partner sites with discounted energy prices. Kept in sync
 * with the backend mirror at `backend/app/data/partner_sites.py` (same ids and
 * coordinates). Rendered directly on the map for instant paint; availability and
 * bookings are served by the API.
 */
export const PARTNER_SITES: PartnerSite[] = [
  {
    id: 'partner-asr-utrecht',
    name: 'a.s.r. headquarters',
    address: 'Archimedeslaan 10, 3584 BA Utrecht',
    latitude: 52.0931078,
    longitude: 5.1545064,
    energy_price: 0.2,
    currency: 'EUR',
    max_power_kw: 41,
    connector_types: ['IEC_62196_T2'],
    total_slots: 50,
  },
];

/**
 * Adapt a static partner site to the `StationDetail` shape so it can render in
 * the shared `ChargerDetailSheet`. Uses a neutral "Reservable" badge instead of
 * partner branding.
 */
export function partnerToStationDetail(site: PartnerSite): StationDetail {
  return {
    id: site.id,
    name: site.name,
    latitude: site.latitude,
    longitude: site.longitude,
    operator: null,
    energy_price: site.energy_price,
    currency: site.currency,
    max_power_kw: site.max_power_kw,
    connector_types: site.connector_types,
    availability_label: 'Reservable',
    pin_color: 'green',
    address: site.address,
    city: null,
  };
}
