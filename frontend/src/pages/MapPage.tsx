import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchAlternatives,
  fetchRecommendations,
  fetchStationDetail,
  fetchStations,
  searchQuery,
  type Filters,
  type RecommendationCard,
  type StationDetail,
  type StationPin,
} from '../api/client';
import { ChargerDetailSheet } from '../components/charger/ChargerDetailSheet';
import { NavigationPicker } from '../components/charger/NavigationPicker';
import { ReroutePrompt } from '../components/charger/ReroutePrompt';
import { FilterSheet } from '../components/filters/FilterSheet';
import { ChargerMap } from '../components/map/ChargerMap';
import { NL_CENTER } from '../components/map/mapConfig';
import { RecommendationCards } from '../components/recommendations/RecommendationCards';
import { RecTogglePills } from '../components/search/RecTogglePills';
import { useAvailabilityMonitor, useGeolocation } from '../hooks/useGeolocation';

export function MapPage() {
  const [stations, setStations] = useState<StationPin[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<StationDetail | null>(null);
  const [alternatives, setAlternatives] = useState<StationPin[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationCard[]>([]);
  const [filters, setFilters] = useState<Filters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ label: string; address: string; latitude: number; longitude: number }>>([]);
  const [showNav, setShowNav] = useState(false);
  const [rerouteAlt, setRerouteAlt] = useState<StationPin | null>(null);
  const [recMode, setRecMode] = useState<'fastest' | 'cheapest' | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>(NL_CENTER as [number, number]);
  const [mapZoom, setMapZoom] = useState(8);
  const originRef = useRef({ lat: 52.1326, lon: 5.2913 });
  const backupIdsRef = useRef<string[]>([]);

  const { requestLocation, position } = useGeolocation();

  const loadStations = useCallback(
    async (bbox: { min_lat: number; min_lon: number; max_lat: number; max_lon: number }) => {
      try {
        const data = await fetchStations(bbox, filters, originRef.current);
        setStations(data);
      } catch {
        /* ignore fetch errors on map pan */
      }
    },
    [filters],
  );

  const loadRecommendations = useCallback(async (lat: number, lon: number) => {
    originRef.current = { lat, lon };
    try {
      let cards = await fetchRecommendations(lat, lon, 15, filters.connector_type, filters);
      if (recMode === 'fastest') {
        cards = cards.filter((c) => c.type === 'fastest');
      } else if (recMode === 'cheapest') {
        cards = cards.filter((c) => c.type === 'cheapest');
      }
      setRecommendations(cards);
    } catch {
      setRecommendations([]);
    }
  }, [filters, recMode]);

  const selectStation = useCallback(async (station: StationPin | RecommendationCard) => {
    const id = 'station_id' in station ? station.station_id : station.id;
    setSelectedId(id);
    try {
      const [d, alts] = await Promise.all([fetchStationDetail(id), fetchAlternatives(id)]);
      setDetail(d);
      setAlternatives(alts);
      backupIdsRef.current = alts.slice(0, 3).map((a) => a.id);
      setMapCenter([d.latitude, d.longitude]);
      setMapZoom(14);
      await loadRecommendations(d.latitude, d.longitude);
    } catch {
      setDetail(null);
    }
  }, [loadRecommendations]);

  const handleDegraded = useCallback((alt: unknown) => {
    setRerouteAlt(alt as StationPin);
  }, []);

  useAvailabilityMonitor(selectedId, backupIdsRef.current, handleDegraded);

  useEffect(() => {
    if (position) {
      setMapCenter([position.lat, position.lon]);
      setMapZoom(13);
      loadRecommendations(position.lat, position.lon);
    }
  }, [position, loadRecommendations]);

  useEffect(() => {
    loadRecommendations(originRef.current.lat, originRef.current.lon);
  }, [filters, recMode, loadRecommendations]);

  const handleSearch = async (q: string) => {
    setSearchText(q);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const res = await searchQuery(q);
    setSearchResults(res.geocode);
    if (res.geocode.length) {
      await loadRecommendations(res.geocode[0].latitude, res.geocode[0].longitude);
    }
  };

  const pickSearchResult = (r: { latitude: number; longitude: number }) => {
    setMapCenter([r.latitude, r.longitude]);
    setMapZoom(13);
    loadRecommendations(r.latitude, r.longitude);
    setShowSearch(false);
  };

  return (
    <div className="app-shell">
      <ChargerMap
        stations={stations}
        selectedId={selectedId}
        onSelect={selectStation}
        onBboxChange={loadStations}
        center={mapCenter}
        zoom={mapZoom}
      />

      <Link to="/support" className="menu-link pill-btn" style={{ textDecoration: 'none', color: 'inherit', fontSize: 13 }}>
        Support
      </Link>

      <div className="overlay-top">
        <div className="top-bar">
          <button className="icon-btn" onClick={() => setShowSearch(!showSearch)}>
            🔍
          </button>
          <RecTogglePills active={recMode} onChange={setRecMode} />
          <button className="icon-btn" onClick={() => setShowFilters(true)}>
            ☰
          </button>
        </div>

        {showSearch && (
          <div className="search-panel">
            <input
              placeholder="City, street, operator, destination…"
              value={searchText}
              onChange={(e) => handleSearch(e.target.value)}
              autoFocus
            />
            <button
              className="pill-btn"
              style={{ marginTop: 8, width: '100%' }}
              onClick={requestLocation}
            >
              Near me
            </button>
            <div className="search-results">
              {searchResults.map((r, i) => (
                <button key={i} className="search-result-item" onClick={() => pickSearchResult(r)}>
                  <strong>{r.label}</strong>
                  <div style={{ color: '#8E8E93', fontSize: 13 }}>{r.address}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {recommendations.length > 0 && (
          <RecommendationCards
            cards={recommendations}
            onSelect={(c) => selectStation(c)}
          />
        )}
      </div>

      <button className="icon-btn locate-fab" onClick={requestLocation} title="Locate me">
        ◎
      </button>

      {showFilters && (
        <FilterSheet
          filters={filters}
          onChange={setFilters}
          onClose={() => setShowFilters(false)}
        />
      )}

      {detail && !showNav && (
        <ChargerDetailSheet
          station={detail}
          alternatives={alternatives}
          onNavigate={() => setShowNav(true)}
          onClose={() => {
            setDetail(null);
            setSelectedId(null);
          }}
          onSelectAlternative={(alt) => selectStation(alt)}
        />
      )}

      {showNav && detail && (
        <NavigationPicker
          lat={detail.latitude}
          lon={detail.longitude}
          onClose={() => setShowNav(false)}
        />
      )}

      {rerouteAlt && (
        <ReroutePrompt
          alternative={rerouteAlt}
          onSwitch={() => {
            selectStation(rerouteAlt);
            setRerouteAlt(null);
          }}
          onDismiss={() => setRerouteAlt(null)}
        />
      )}
    </div>
  );
}
