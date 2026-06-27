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

export function filterByConnectorType(
  stations: StationPin[],
  connectorType: string | undefined,
): StationPin[] {
  if (!connectorType) return stations;
  return stations.filter((s) => (s.connector_types || []).includes(connectorType));
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
  if (zoom >= 15) return 120;
  if (zoom >= 13) return 90;
  if (zoom >= 11) return 65;
  if (zoom >= 9) return 45;
  return 30;
}
