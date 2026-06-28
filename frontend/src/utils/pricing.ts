import type { StationPin } from '../api/client';

/** Priced stations only — excludes null, zero, and sub-cent values that display as €0.00. */
export function hasValidEnergyPrice(price: number | null | undefined): boolean {
  if (price == null || price <= 0) return false;
  return Math.round(price * 100) / 100 > 0;
}

export function hasValidStationPrice(s: StationPin): boolean {
  return hasValidEnergyPrice(s.energy_price);
}
