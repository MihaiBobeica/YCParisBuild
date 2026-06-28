/** Mirror of backend spatial.map_limit_for_zoom */
export function mapLimitForZoom(zoom: number): number {
  if (zoom >= 16) return 320;
  if (zoom >= 15) return 240;
  if (zoom >= 13) return 170;
  if (zoom >= 11) return 100;
  if (zoom >= 9) return 70;
  return 45;
}
