import type { StationPin } from '../api/client';
import { expandBounds, renderLimitForZoom, type ViewBounds } from './viewportStations';

export type PinKind = 'green' | 'orange' | 'red';

/**
 * Resolve the on-map display kind for a station. Mirrors the backend pin_color
 * but collapses "gray/unknown" into orange so the map only shows three tiers.
 */
export function resolvePinKind(s: StationPin): PinKind {
  if (s.pin_color === 'red' || s.availability_label === 'Unavailable') return 'red';
  if (s.pin_color === 'green') return 'green';
  return 'orange';
}

/** Higher = drawn first / wins decluttering. Green (available) always wins. */
function pinPriority(kind: PinKind): number {
  if (kind === 'green') return 3;
  if (kind === 'red') return 2;
  return 1;
}

function availabilityCapacity(label: string | undefined): string | null {
  if (!label) return null;
  const m = label.match(/\((\d+\/\d+)\)/);
  return m ? m[1] : null;
}

function buildChip(s: StationPin): { line1: string; line2: string } {
  const price = s.energy_price != null ? `€${s.energy_price.toFixed(2)}/kWh` : 'Price unknown';
  const power = s.max_power_kw != null ? `${Math.round(s.max_power_kw)} kW` : null;
  const cap = availabilityCapacity(s.availability_label);
  const parts = [power, cap].filter(Boolean) as string[];
  const line2 = parts.join('  ·  ') || s.availability_label || 'Available';
  return { line1: price, line2 };
}

/** Station enriched with values precomputed once at grid-build time. */
export interface GridStation {
  readonly s: StationPin;
  readonly kind: PinKind;
  readonly priority: number;
  readonly power: number;
  readonly price: number;
  readonly chip: { line1: string; line2: string };
}

export interface StationGrid {
  readonly cells: Map<number, GridStation[]>;
  readonly byId: Map<string, GridStation>;
  readonly cols: number;
  readonly minCol: number;
  readonly minRow: number;
  readonly size: number;
}

/** ~0.02deg cells (~1.4km lat) keep most viewports within a handful of cells. */
const CELL = 0.02;

const colOf = (lon: number) => Math.floor(lon / CELL);
const rowOf = (lat: number) => Math.floor(lat / CELL);

/**
 * Build a uniform spatial-hash grid over the station cache. O(N), runs only
 * when the underlying data changes (not per animation frame).
 */
export function buildStationGrid(stations: StationPin[]): StationGrid {
  const cells = new Map<number, GridStation[]>();
  const byId = new Map<string, GridStation>();
  let minCol = Infinity;
  let maxCol = -Infinity;
  let minRow = Infinity;
  let maxRow = -Infinity;

  for (const s of stations) {
    const c = colOf(s.longitude);
    const r = rowOf(s.latitude);
    if (c < minCol) minCol = c;
    if (c > maxCol) maxCol = c;
    if (r < minRow) minRow = r;
    if (r > maxRow) maxRow = r;
  }

  const cols = stations.length ? maxCol - minCol + 1 : 1;
  const safeMinCol = stations.length ? minCol : 0;
  const safeMinRow = stations.length ? minRow : 0;

  for (const s of stations) {
    const kind = resolvePinKind(s);
    const gs: GridStation = {
      s,
      kind,
      priority: pinPriority(kind),
      power: s.max_power_kw ?? 0,
      price: s.energy_price ?? Number.POSITIVE_INFINITY,
      chip: buildChip(s),
    };
    const key = (rowOf(s.latitude) - safeMinRow) * cols + (colOf(s.longitude) - safeMinCol);
    const bucket = cells.get(key);
    if (bucket) bucket.push(gs);
    else cells.set(key, [gs]);
    byId.set(s.id, gs);
  }

  return { cells, byId, cols, minCol: safeMinCol, minRow: safeMinRow, size: stations.length };
}

/** Rank: available (green) first, then by power, then cheaper price. */
function compareForRender(a: GridStation, b: GridStation): number {
  if (a.priority !== b.priority) return b.priority - a.priority;
  if (a.power !== b.power) return b.power - a.power;
  return a.price - b.price;
}

/**
 * Return the stations to draw for the current viewport.
 *
 * Only touches grid cells overlapping the padded viewport (O(visible)), then
 * declutters with a priority-aware spatial spread: the viewport is divided into
 * a sub-grid and the highest-priority station claims each sub-cell, so dense
 * areas stay clean and available chargers always survive the cap.
 */
export function queryView(
  grid: StationGrid,
  bounds: ViewBounds,
  zoom: number,
  paddingRatio = 0.08,
): GridStation[] {
  const pad = expandBounds(bounds, paddingRatio);
  const cap = renderLimitForZoom(zoom);

  const c0 = colOf(pad.west);
  const c1 = colOf(pad.east);
  const r0 = rowOf(pad.south);
  const r1 = rowOf(pad.north);

  const candidates: GridStation[] = [];
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const key = (r - grid.minRow) * grid.cols + (c - grid.minCol);
      const bucket = grid.cells.get(key);
      if (!bucket) continue;
      for (const gs of bucket) {
        const { latitude: lat, longitude: lon } = gs.s;
        if (lat >= pad.south && lat <= pad.north && lon >= pad.west && lon <= pad.east) {
          candidates.push(gs);
        }
      }
    }
  }

  if (candidates.length <= cap) {
    candidates.sort(compareForRender);
    return candidates;
  }

  candidates.sort(compareForRender);

  // Spatial spread: keep one (highest-priority) pin per viewport sub-cell.
  const n = Math.max(1, Math.ceil(Math.sqrt(cap * 1.6)));
  const spanLat = pad.north - pad.south || 1e-9;
  const spanLon = pad.east - pad.west || 1e-9;
  const taken = new Set<number>();
  const result: GridStation[] = [];

  for (const gs of candidates) {
    if (result.length >= cap) break;
    const row = Math.min(n - 1, Math.floor(((gs.s.latitude - pad.south) / spanLat) * n));
    const col = Math.min(n - 1, Math.floor(((gs.s.longitude - pad.west) / spanLon) * n));
    const cell = row * n + col;
    if (taken.has(cell)) continue;
    taken.add(cell);
    result.push(gs);
  }

  return result;
}
