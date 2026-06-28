export interface NavTarget {
  lat: number;
  lon: number;
  name?: string | null;
  address?: string | null;
}

/**
 * Build a human-readable destination string ("Name, Address") from a target.
 * Recent iOS Apple Maps snaps raw `lat,lon` to the nearest known entity and
 * shows a nameless "Dropped Pin", so a real place string yields a far more
 * specific, correctly named destination. Returns null when nothing usable.
 */
function destinationQuery(t: NavTarget): string | null {
  const parts = [t.name, t.address]
    .map((p) => (p ?? '').trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) return null;
  // Avoid duplicating the address when the name already contains it.
  if (parts.length === 2 && parts[1].includes(parts[0])) return parts[1];
  return parts.join(', ');
}

export function googleMapsUrl(t: NavTarget): string {
  const params = new URLSearchParams({ api: '1' });
  params.set('destination', destinationQuery(t) ?? `${t.lat},${t.lon}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function appleMapsUrl(t: NavTarget): string {
  const params = new URLSearchParams();
  params.set('daddr', destinationQuery(t) ?? `${t.lat},${t.lon}`);
  params.set('dirflg', 'd');
  return `https://maps.apple.com/?${params.toString()}`;
}

export function wazeUrl(t: NavTarget): string {
  // Waze routes accurately to raw coordinates, so keep them for precision.
  return `https://waze.com/ul?ll=${t.lat},${t.lon}&navigate=yes`;
}
