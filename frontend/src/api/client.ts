const API_URL = import.meta.env.VITE_API_URL || '';

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
  confidence: number;
  confidence_label: string;
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
  confidence: number | null;
  confidence_label: string | null;
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
  min_confidence?: number;
  speed?: 'slow' | 'fast';
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

export function fetchMonitor(ids: string[]) {
  return request<{ stations: StationPin[]; best_alternative: StationPin | null }>(
    `/api/monitor?ids=${ids.join(',')}`,
  );
}

export function fetchOperators() {
  return request<string[]>('/api/filters/operators');
}

export function createCheckout(plan: 'monthly' | 'yearly', email?: string) {
  return request<{ url: string }>('/api/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan, email }),
  });
}

export function createPortal(email: string) {
  return request<{ url: string }>('/api/billing/portal', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function fetchBillingStatus(email: string) {
  return request<{ status: string; plan: string; current_period_end?: string }>(
    `/api/billing/status?email=${encodeURIComponent(email)}`,
  );
}
