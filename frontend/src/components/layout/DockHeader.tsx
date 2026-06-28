interface Props {
  activeFilterCount: number;
  onAccountOpen: () => void;
  onFilterOpen: () => void;
}

export function DockHeader({ activeFilterCount, onAccountOpen, onFilterOpen }: Props) {
  return (
    <div className="dock-header">
      <button type="button" className="dock-icon-btn" onClick={onAccountOpen} aria-label="Account">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
        </svg>
      </button>
      <span className="dock-wordmark">paxor</span>
      <button type="button" className="dock-icon-btn" onClick={onFilterOpen} aria-label="Filters">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        {activeFilterCount > 0 && <span className="dock-badge">{activeFilterCount}</span>}
      </button>
    </div>
  );
}
