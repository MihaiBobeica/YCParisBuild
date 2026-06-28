import { MenuSheet } from './MenuSheet';

interface SearchResult {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
}

interface Props {
  query: string;
  results: SearchResult[];
  onQueryChange: (q: string) => void;
  onPick: (r: SearchResult) => void;
  onClose: () => void;
}

export function SearchSheet({ query, results, onQueryChange, onPick, onClose }: Props) {
  return (
    <MenuSheet title="Search" onClose={onClose}>
      <div className="search-input-wrap">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3-3" />
        </svg>
        <input
          autoFocus
          placeholder="City, street, operator, destination…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
      </div>

      <div className="search-results-list">
        {results.length === 0 && query.length >= 2 && (
          <p className="search-empty">No places found — try a city or street name.</p>
        )}
        {results.map((r, i) => (
          <button key={i} type="button" className="search-result-row" onClick={() => onPick(r)}>
            <div>
              <strong>{r.label}</strong>
              <span>{r.address}</span>
            </div>
            <span className="search-result-arrow">→</span>
          </button>
        ))}
      </div>
    </MenuSheet>
  );
}
