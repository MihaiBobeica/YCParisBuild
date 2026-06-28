const RAW_API_URL = import.meta.env.VITE_API_URL || '';
// Allow VITE_API_URL to be a bare host (e.g. Render's service host) by adding
// the scheme so fetch treats it as absolute rather than a relative path.
const API_URL =
  RAW_API_URL && !/^https?:\/\//.test(RAW_API_URL) ? `https://${RAW_API_URL}` : RAW_API_URL;

/** Normalized API base (with scheme). Empty string means same-origin. */
export const apiBaseUrl = API_URL;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

export interface StationPin {
  id: string;
  name: string | null;
  latitude: number;
  longitude: number;
  operator?: string | null;
  energy_price?: number | null;
  currency?: string | null;
  max_power_kw?: number | null;
  connector_types?: string[];
  availability_label: string;
  pin_color: string;
  distance_km?: number;
}

export interface RecommendationCard {
  station_id: string;
  type: string;
  name: string | null;
  distance_km: number;
  travel_minutes: number;
  availability: string | null;
  energy_price: number | null;
  currency: string | null;
  max_power_kw: number | null;
  connector_types: string[];
  pin_color: string | null;
  reason: string;
  latitude: number;
  longitude: number;
}

export interface StationDetail extends StationPin {
  address?: string | null;
  city?: string | null;
  owner?: string | null;
  parking_type?: string | null;
  facilities?: string[];
  access_class?: string;
  evses?: Array<{
    evse_uid: string;
    status: string;
    last_updated: string | null;
    connectors: Array<{
      connector_id: string;
      standard: string | null;
      max_power_kw: number | null;
      energy_price: number | null;
      currency: string | null;
    }>;
  }>;
  time_fee?: number | null;
  parking_fee?: number | null;
  session_fee?: number | null;
  fee_currency?: string | null;
  price_disclaimer?: string;
  last_updated?: string | null;
}

export interface Filters {
  availability?: string;
  max_price?: number;
  connector_type?: string;
  min_kw?: number;
  operator?: string;
  parking_type?: string;
  access_class?: string;
  known_price_only?: boolean;
}

export function fetchStations(
  bbox: { min_lat: number; min_lon: number; max_lat: number; max_lon: number },
  filters: Filters = {},
  origin?: { lat: number; lon: number },
) {
  const params = new URLSearchParams({
    min_lat: String(bbox.min_lat),
    min_lon: String(bbox.min_lon),
    max_lat: String(bbox.max_lat),
    max_lon: String(bbox.max_lon),
    map_limit: '250',
  });
  if (origin) {
    params.set('origin_lat', String(origin.lat));
    params.set('origin_lon', String(origin.lon));
  }
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== false) params.set(k, String(v));
  });
  return request<StationPin[]>(`/api/stations?${params}`);
}

export function fetchStationDetail(id: string) {
  return request<StationDetail>(`/api/stations/${id}`);
}

export function fetchAlternatives(id: string) {
  return request<StationPin[]>(`/api/stations/${id}/alternatives`);
}

export function searchQuery(q: string) {
  return request<{ geocode: Array<{ label: string; address: string; latitude: number; longitude: number }>; stations: StationPin[] }>(
    `/api/search?q=${encodeURIComponent(q)}`,
  );
}

export function searchNear(lat: number, lon: number, radius_km = 10) {
  return request<StationPin[]>(`/api/search/near?lat=${lat}&lon=${lon}&radius_km=${radius_km}`);
}

export function fetchRecommendations(
  origin_lat: number,
  origin_lon: number,
  radius_km = 15,
  connector_type?: string,
  filters: Filters = {},
) {
  return request<RecommendationCard[]>('/api/recommendations', {
    method: 'POST',
    body: JSON.stringify({ origin_lat, origin_lon, radius_km, connector_type, filters }),
  });
}

export function fetchOperators() {
  return request<string[]>('/api/filters/operators');
}

export interface PartnerSiteApi {
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

export interface SlotAvailability {
  slot_start: string;
  slot_end: string;
  total_slots: number;
  booked: number;
  remaining: number;
}

export interface PartnerBooking {
  id: string;
  partner_site_id: string;
  partner_site_name?: string | null;
  slot_start: string;
  slot_end: string;
  partner_price?: number | null;
  nearby_avg_price?: number | null;
  session_kwh: number;
  session_savings?: number | null;
  currency: string;
  created_at: string;
}

export interface SavingsSummary {
  ytd_savings: number;
  currency: string;
  bookings_count: number;
  year: number;
}

export function fetchPartnerSites() {
  return request<PartnerSiteApi[]>('/api/partner-sites');
}

export function fetchPartnerAvailability(siteId: string) {
  return request<SlotAvailability[]>(`/api/partner-sites/${siteId}/availability`);
}

export function createPartnerBooking(body: {
  email: string;
  partner_site_id: string;
  slots: Array<{ start: string; end: string }>;
}) {
  return request<PartnerBooking[]>('/api/partner-bookings', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function fetchPartnerBookings(email: string) {
  return request<PartnerBooking[]>(`/api/partner-bookings?email=${encodeURIComponent(email)}`);
}

export function deletePartnerBooking(id: string, email: string) {
  return request<{ ok: boolean }>(
    `/api/partner-bookings/${id}?email=${encodeURIComponent(email)}`,
    { method: 'DELETE' },
  );
}

export function fetchPartnerSavings(email: string) {
  return request<SavingsSummary>(
    `/api/partner-bookings/savings?email=${encodeURIComponent(email)}`,
  );
}
