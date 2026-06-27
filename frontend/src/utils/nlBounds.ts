/** Netherlands bounding box — keep in sync with mapConfig / backend settings */
export const NL_MIN_LAT = 50.75;
export const NL_MAX_LAT = 53.7;
export const NL_MIN_LON = 3.2;
export const NL_MAX_LON = 7.3;

export interface Bbox {
  min_lat: number;
  min_lon: number;
  max_lat: number;
  max_lon: number;
  zoom: number;
}

/** Leaflet zoom can be fractional (7.5) — API expects integer. */
export function normalizeZoom(zoom: number): number {
  return Math.max(1, Math.min(20, Math.round(zoom)));
}

/** Clip bbox to NL; return null if no overlap (skip fetch). */
export function clampBboxToNL(bbox: Bbox): Bbox | null {
  const min_lat = Math.max(bbox.min_lat, NL_MIN_LAT);
  const max_lat = Math.min(bbox.max_lat, NL_MAX_LAT);
  const min_lon = Math.max(bbox.min_lon, NL_MIN_LON);
  const max_lon = Math.min(bbox.max_lon, NL_MAX_LON);

  if (min_lat >= max_lat || min_lon >= max_lon) return null;

  return { min_lat, min_lon, max_lat, max_lon, zoom: normalizeZoom(bbox.zoom) };
}

export function isInNL(lat: number, lon: number): boolean {
  return lat >= NL_MIN_LAT && lat <= NL_MAX_LAT && lon >= NL_MIN_LON && lon <= NL_MAX_LON;
}
