import { useEffect, useState } from 'react';

interface Position {
  lat: number;
  lon: number;
}

export function useGeolocation() {
  const [position, setPosition] = useState<Position | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const requestLocation = () => {
    setLoading(true);
    setError(null);
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return { position, error, loading, requestLocation };
}

export function useAvailabilityMonitor(
  selectedId: string | null,
  backupIds: string[],
  onDegraded: (alternative: unknown) => void,
  intervalMs = 45000,
) {
  useEffect(() => {
    if (!selectedId) return;

    const degraded = new Set(['CHARGING', 'RESERVED', 'OUTOFORDER', 'INOPERATIVE', 'UNKNOWN']);

    const poll = async () => {
      try {
        const ids = [selectedId, ...backupIds].filter(Boolean);
        const res = await fetch(`/api/monitor?ids=${ids.join(',')}`);
        if (!res.ok) return;
        const data = await res.json();
        const primary = data.stations?.[0];
        if (!primary) return;
        const statuses: string[] = primary.statuses || [];
        const isDegraded = statuses.some((s: string) => degraded.has(s)) || primary.pin_color !== 'green';
        if (isDegraded && data.best_alternative) {
          onDegraded(data.best_alternative);
        }
      } catch {
        /* ignore poll errors */
      }
    };

    poll();
    const timer = setInterval(poll, intervalMs);
    return () => clearInterval(timer);
  }, [selectedId, backupIds.join(','), intervalMs, onDegraded]);
}
