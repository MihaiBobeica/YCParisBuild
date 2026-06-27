import { useEffect, useState } from 'react';

/** Reveal list items in batches for smoother map paint (Booking.com-style). */
export function useProgressiveReveal<T>(items: T[], batchSize = 35, intervalMs = 20): T[] {
  const [visible, setVisible] = useState<T[]>([]);

  useEffect(() => {
    if (!items.length) {
      setVisible([]);
      return;
    }

    setVisible(items.slice(0, Math.min(batchSize, items.length)));
    if (items.length <= batchSize) return;

    let count = batchSize;
    const id = window.setInterval(() => {
      count += batchSize;
      setVisible(items.slice(0, Math.min(count, items.length)));
      if (count >= items.length) window.clearInterval(id);
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [items, batchSize, intervalMs]);

  return visible;
}
