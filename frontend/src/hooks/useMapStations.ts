import { useCallback, useEffect, useRef, useState } from 'react';
import type { Filters, StationPin } from '../api/client';
import { mapLimitForZoom } from '../utils/mapLimits';
import { clampBboxToNL, type Bbox } from '../utils/nlBounds';
import { filterByConnectorType } from '../utils/viewportStations';

export type BboxPayload = Bbox;

interface KeepBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/** How far beyond the current viewport (per side) to retain cached pins. */
const KEEP_PADDING = 1.5;
/** Hard ceiling so the spatial grid build stays cheap even after lots of panning. */
const MAX_CACHED = 4000;

/**
 * Merge incoming pins, but drop previously cached pins that are far outside the
 * current viewport. This bounds the working set so grid builds stay O(viewport)
 * instead of growing unbounded as the user explores the country.
 */
function mergeStations(
  prev: StationPin[],
  incoming: StationPin[],
  keep: KeepBounds,
): StationPin[] {
  const map = new Map<string, StationPin>();
  for (const s of prev) {
    if (
      s.latitude >= keep.minLat &&
      s.latitude <= keep.maxLat &&
      s.longitude >= keep.minLon &&
      s.longitude <= keep.maxLon
    ) {
      map.set(s.id, s);
    }
  }
  for (const s of incoming) map.set(s.id, s);

  if (map.size <= MAX_CACHED) return [...map.values()];
  // Safety fallback: keep the freshest entries (incoming + most recent prev).
  const values = [...map.values()];
  return values.slice(values.length - MAX_CACHED);
}

export function useMapStations(
  filters: Filters,
  origin: { lat: number; lon: number },
) {
  const [stations, setStations] = useState<StationPin[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);
  const lastBboxRef = useRef<string>('');
  const originRef = useRef(origin);
  originRef.current = origin;

  const load = useCallback(
    (bbox: BboxPayload) => {
      const clamped = clampBboxToNL(bbox);
      if (!clamped) return;

      const key = `${clamped.min_lat.toFixed(4)}:${clamped.min_lon.toFixed(4)}:${clamped.max_lat.toFixed(4)}:${clamped.max_lon.toFixed(4)}:${clamped.zoom}:${filters.connector_type || ''}`;
      if (key === lastBboxRef.current) return;
      lastBboxRef.current = key;

      if (debounceRef.current) window.clearTimeout(debounceRef.current);

      const debounceMs = clamped.zoom >= 13 ? 80 : 150;
      debounceRef.current = window.setTimeout(async () => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setLoading(true);

        try {
          const limit = mapLimitForZoom(clamped.zoom);
          const params = new URLSearchParams({
            min_lat: String(clamped.min_lat),
            min_lon: String(clamped.min_lon),
            max_lat: String(clamped.max_lat),
            max_lon: String(clamped.max_lon),
            map_limit: String(limit),
            zoom: String(clamped.zoom),
            origin_lat: String(originRef.current.lat),
            origin_lon: String(originRef.current.lon),
          });
          Object.entries(filters).forEach(([k, v]) => {
            if (v !== undefined && v !== '' && v !== false) params.set(k, String(v));
          });

          const API_URL = import.meta.env.VITE_API_URL || '';
          const res = await fetch(`${API_URL}/api/stations?${params}`, {
            signal: controller.signal,
          });
          if (!res.ok) throw new Error(await res.text());
          let data: StationPin[] = await res.json();
          data = filterByConnectorType(data, filters.connector_type);
          if (!controller.signal.aborted) {
            const latPad = (clamped.max_lat - clamped.min_lat) * KEEP_PADDING;
            const lonPad = (clamped.max_lon - clamped.min_lon) * KEEP_PADDING;
            const keep: KeepBounds = {
              minLat: clamped.min_lat - latPad,
              maxLat: clamped.max_lat + latPad,
              minLon: clamped.min_lon - lonPad,
              maxLon: clamped.max_lon + lonPad,
            };
            setStations((prev) => mergeStations(prev, data, keep));
          }
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') return;
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      }, debounceMs);
    },
    [filters],
  );

  useEffect(() => {
    lastBboxRef.current = '';
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, [filters]);

  return { stations, loading, loadStations: load };
}
