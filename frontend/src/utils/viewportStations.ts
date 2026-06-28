import type { StationPin } from '../api/client';

export interface ViewBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export function expandBounds(bounds: ViewBounds, paddingRatio = 0.05): ViewBounds {
  const latPad = (bounds.north - bounds.south) * paddingRatio;
  const lonPad = (bounds.east - bounds.west) * paddingRatio;
  return {
    south: bounds.south - latPad,
    west: bounds.west - lonPad,
    north: bounds.north + latPad,
    east: bounds.east + lonPad,
  };
}

export function filterStationsInView(
  stations: StationPin[],
  bounds: ViewBounds,
  paddingRatio = 0.05,
): StationPin[] {
  const b = expandBounds(bounds, paddingRatio);
  return stations.filter(
    (s) =>
      s.latitude >= b.south &&
      s.latitude <= b.north &&
      s.longitude >= b.west &&
      s.longitude <= b.east,
  );
}

export function stationPriority(s: StationPin): number {
  if (s.pin_color === 'green') return 3;
  if (s.pin_color === 'red') return 2;
  return 1;
}

export function sortStationsForRender(stations: StationPin[]): StationPin[] {
  return [...stations].sort((a, b) => stationPriority(b) - stationPriority(a));
}

export function renderLimitForZoom(zoom: number): number {
  if (zoom >= 16) return 320;
  if (zoom >= 15) return 240;
  if (zoom >= 13) return 150;
  if (zoom >= 11) return 85;
  if (zoom >= 9) return 60;
  return 40;
}
