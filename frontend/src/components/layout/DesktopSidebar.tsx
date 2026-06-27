import type { RecommendationCard } from '../../api/client';
import type { ConnectorPreference } from '../../hooks/useUserProfile';

interface SearchResult {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
}

interface Props {
  searchLabel: string;
  searchText: string;
  searchResults: SearchResult[];
  searchDestination: { label: string } | null;
  connectorLabel: string;
  recMode: 'fastest' | 'cheapest' | null;
  activeFilterCount: number;
  recommendations: RecommendationCard[];
  onSearchChange: (q: string) => void;
  onSearchPick: (r: SearchResult) => void;
  onNearMe: () => void;
  onAccountOpen: () => void;
  onFilterOpen: () => void;
  onRecChange: (mode: 'fastest' | 'cheapest' | null) => void;
  onSelectRecommendation: (c: RecommendationCard) => void;
  connectorType: ConnectorPreference;
}

export function DesktopSidebar({
  searchLabel,
  searchText,
  searchResults,
  searchDestination,
  connectorLabel,
  recMode,
  activeFilterCount,
  recommendations,
  onSearchChange,
  onSearchPick,
  onNearMe,
  onAccountOpen,
  onFilterOpen,
  onRecChange,
  onSelectRecommendation,
}: Props) {
  return (
    <aside className="desktop-sidebar">
      <div className="sidebar-header">
        <span className="dock-logo">pangea</span>
        <div className="sidebar-header-actions">
          <button type="button" className="dock-icon-btn" onClick={onAccountOpen} aria-label="Account">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
            </svg>
          </button>
          <button type="button" className="dock-icon-btn" onClick={onFilterOpen} aria-label="Filters">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
            {activeFilterCount > 0 && <span className="dock-badge">{activeFilterCount}</span>}
          </button>
        </div>
      </div>

      <div className="sidebar-search">
        <div className="search-input-wrap">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3-3" />
          </svg>
          <input
            placeholder="City, street, address…"
            value={searchText}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <button type="button" className="near-me-btn near-me-btn--compact" onClick={onNearMe}>
          ◎ Near me
        </button>
        {searchResults.length > 0 && (
          <div className="sidebar-search-results">
            {searchResults.map((r, i) => (
              <button key={i} type="button" className="search-result-row" onClick={() => onSearchPick(r)}>
                <div>
                  <strong>{r.label}</strong>
                  <span>{r.address}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {searchDestination && (
        <div className="sidebar-destination">
          <span className="sidebar-destination-label">Destination</span>
          <strong>{searchDestination.label}</strong>
        </div>
      )}

      <div className="sidebar-rec-controls">
        <span className="dock-connector-tag">{connectorLabel}</span>
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
      </div>

      <div className="sidebar-recommendations">
        <h3 className="sidebar-section-title">
          {searchDestination ? `Chargers near ${searchLabel || 'destination'}` : 'Suggestions nearby'}
        </h3>
        {recommendations.length === 0 ? (
          <p className="sidebar-empty">Search an address or zoom in to see charger suggestions.</p>
        ) : (
          <div className="sidebar-rec-list">
            {recommendations.map((card) => (
              <button
                key={`${card.type}-${card.station_id}`}
                type="button"
                className="rec-card rec-card--vertical"
                onClick={() => onSelectRecommendation(card)}
              >
                <div className="rec-card-type">{card.type.replace('_', ' ')}</div>
                <div className="rec-card-name">{card.name || 'Charger'}</div>
                <div className="rec-card-meta">
                  {card.travel_minutes} min · {card.distance_km} km · {card.availability}
                </div>
                <div className="rec-card-meta">
                  {card.energy_price != null ? `€${card.energy_price.toFixed(2)}/kWh` : 'Price unknown'} ·{' '}
                  {card.max_power_kw ?? '?'} kW
                </div>
                <div className="rec-card-reason">{card.reason}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
