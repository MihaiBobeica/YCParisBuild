import type { RecommendationCard } from '../../api/client';
import { RecCard } from '../recommendations/RecCard';
import { DockHeader } from './DockHeader';

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
        <DockHeader
          activeFilterCount={activeFilterCount}
          onAccountOpen={onAccountOpen}
          onFilterOpen={onFilterOpen}
        />
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
              <RecCard
                key={`${card.type}-${card.station_id}`}
                card={card}
                variant="vertical"
                onSelect={onSelectRecommendation}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
