import L from 'leaflet';

export const NL_BOUNDS: L.LatLngBoundsExpression = [
  [50.75, 3.2],
  [53.7, 7.3],
];

export const NL_CENTER: L.LatLngExpression = [52.1326, 5.2913];

export const TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';

export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

export const MIN_ZOOM = 7;
export const MAX_ZOOM = 18;

export const PIN_COLORS: Record<string, string> = {
  green: '#22C55E',
  orange: '#F97316',
  red: '#EF4444',
  gray: '#9CA3AF',
};
