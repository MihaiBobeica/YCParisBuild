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
    latitude: 52.081617,
    longitude: 5.1337008,
    energy_price: 0.2,
    currency: 'EUR',
    max_power_kw: 22,
    connector_types: ['IEC_62196_T2'],
    total_slots: 50,
  },
];
