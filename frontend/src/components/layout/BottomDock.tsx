import type { Filters } from '../../api/client';

interface Props {
  searchLabel: string;
  connectorLabel?: string;
  recMode: 'fastest' | 'cheapest' | null;
  activeFilterCount: number;
  onSearchOpen: () => void;
  onAccountOpen: () => void;
  onFilterOpen: () => void;
  onRecChange: (mode: 'fastest' | 'cheapest' | null) => void;
}

export function BottomDock({
  searchLabel,
  connectorLabel,
  recMode,
  activeFilterCount,
  onSearchOpen,
  onAccountOpen,
  onFilterOpen,
  onRecChange,
}: Props) {
  return (
    <div className="bottom-dock">
      <div className="dock-header">
        <button type="button" className="dock-icon-btn" onClick={onAccountOpen} aria-label="Account">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
          </svg>
        </button>
        <span className="dock-logo">pangea</span>
        <button type="button" className="dock-icon-btn" onClick={onFilterOpen} aria-label="Filters">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          {activeFilterCount > 0 && <span className="dock-badge">{activeFilterCount}</span>}
        </button>
      </div>

      <button type="button" className="dock-search" onClick={onSearchOpen}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3-3" />
        </svg>
        <span className="dock-search-text">{searchLabel || 'Where do you want to charge?'}</span>
      </button>

      <div className="dock-rec-row">
        {connectorLabel && <span className="dock-connector-tag">{connectorLabel}</span>}
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
  if (filters.known_price_only) n++;
  if (filters.speed) n++;
  return n;
}
