import type { ReactNode } from 'react';
import type { Filters } from '../../api/client';
import { DockHeader } from './DockHeader';

interface Props {
  searchLabel: string;
  recMode: 'fastest' | 'cheapest' | null;
  activeFilterCount: number;
  onSearchOpen: () => void;
  onAccountOpen: () => void;
  onFilterOpen: () => void;
  onRecChange: (mode: 'fastest' | 'cheapest' | null) => void;
  children?: ReactNode;
}

export function BottomDock({
  searchLabel,
  recMode,
  activeFilterCount,
  onSearchOpen,
  onAccountOpen,
  onFilterOpen,
  onRecChange,
  children,
}: Props) {
  return (
    <div className="bottom-dock">
      <DockHeader
        activeFilterCount={activeFilterCount}
        onAccountOpen={onAccountOpen}
        onFilterOpen={onFilterOpen}
      />

      <button type="button" className="dock-search" onClick={onSearchOpen}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3-3" />
        </svg>
        <span className="dock-search-text">{searchLabel || 'Where do you want to charge?'}</span>
      </button>

      <div className="dock-rec-row">
        <button
          type="button"
          className={`dock-pill${recMode === 'fastest' ? ' active' : ''}`}
          onClick={() => onRecChange(recMode === 'fastest' ? null : 'fastest')}
        >
          Fastest
        </button>
        <button
          type="button"
          className={`dock-pill${recMode === 'cheapest' ? ' active' : ''}`}
          onClick={() => onRecChange(recMode === 'cheapest' ? null : 'cheapest')}
        >
          Cheapest
        </button>
      </div>

      {children}
    </div>
  );
}

export function countActiveFilters(filters: Filters): number {
  let n = 0;
  if (filters.availability) n++;
  if (filters.max_price != null) n++;
  if (filters.connector_type) n++;
  if (filters.min_kw) n++;
  if (filters.operator) n++;
  if (filters.parking_type) n++;
  if (filters.access_class) n++;
  if (filters.known_price_only) n++;
  return n;
}
