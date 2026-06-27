import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchAlternatives,
  fetchRecommendations,
  fetchStationDetail,
  searchQuery,
  type Filters,
  type RecommendationCard,
  type StationDetail,
  type StationPin,
} from '../api/client';
import { AccountSheet } from '../components/account/AccountSheet';
import { ChargerDetailSheet } from '../components/charger/ChargerDetailSheet';
import { NavigationPicker } from '../components/charger/NavigationPicker';
import { ReroutePrompt } from '../components/charger/ReroutePrompt';
import { FilterSheet } from '../components/filters/FilterSheet';
import { BottomDock, countActiveFilters } from '../components/layout/BottomDock';
import { DesktopSidebar } from '../components/layout/DesktopSidebar';
import { SearchSheet } from '../components/layout/SearchSheet';
import { ChargerMap } from '../components/map/ChargerMap';
import type { MapNavTarget } from '../components/map/MapController';
import type { SearchDestination } from '../components/map/SearchDestinationPin';
import { RecommendationCards } from '../components/recommendations/RecommendationCards';
import { useAvailabilityMonitor, useGeolocation } from '../hooks/useGeolocation';
import { useMapStations } from '../hooks/useMapStations';
import { useUserProfile, CONNECTOR_OPTIONS } from '../hooks/useUserProfile';
import { isInNL } from '../utils/nlBounds';

export function MapPage() {
  const { profile, setProfile } = useUserProfile();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<StationDetail | null>(null);
  const [alternatives, setAlternatives] = useState<StationPin[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationCard[]>([]);
  const [extraFilters, setExtraFilters] = useState<Filters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchLabel, setSearchLabel] = useState('');
  const [searchDestination, setSearchDestination] = useState<SearchDestination | null>(null);
  const [searchResults, setSearchResults] = useState<
    Array<{ label: string; address: string; latitude: number; longitude: number }>
  >([]);
  const [showNav, setShowNav] = useState(false);
  const [rerouteAlt, setRerouteAlt] = useState<StationPin | null>(null);
  const [recMode, setRecMode] = useState<'fastest' | 'cheapest' | null>(null);
  const [navTarget, setNavTarget] = useState<MapNavTarget | null>(null);
  const [origin, setOrigin] = useState({ lat: 52.1326, lon: 5.2913 });
  const backupIdsRef = useRef<string[]>([]);
  const searchDebounceRef = useRef<number | null>(null);

  const filters = useMemo<Filters>(() => {
    const f: Filters = { ...extraFilters };
    if (profile.connectorType) f.connector_type = profile.connectorType;
    return f;
  }, [extraFilters, profile.connectorType]);

  const { stations, loading, loadStations } = useMapStations(filters, origin);
  const { requestLocation, position } = useGeolocation();

  const flyTo = useCallback((lat: number, lon: number, zoom: number, key: string) => {
    setNavTarget({ lat, lon, zoom, key });
  }, []);

  const loadRecommendations = useCallback(
    async (lat: number, lon: number) => {
      setOrigin({ lat, lon });
      try {
        let cards = await fetchRecommendations(lat, lon, 15, filters.connector_type, filters);
        if (recMode === 'fastest') cards = cards.filter((c) => c.type === 'fastest');
        else if (recMode === 'cheapest') cards = cards.filter((c) => c.type === 'cheapest');
        setRecommendations(cards);
      } catch {
        setRecommendations([]);
      }
    },
    [filters, recMode],
  );

  const selectStation = useCallback(
    async (station: StationPin | RecommendationCard) => {
      const id = 'station_id' in station ? station.station_id : station.id;
      setSelectedId(id);
      try {
        const [d, alts] = await Promise.all([fetchStationDetail(id), fetchAlternatives(id)]);
        setDetail(d);
        setAlternatives(alts);
        backupIdsRef.current = alts.slice(0, 3).map((a) => a.id);
        flyTo(d.latitude, d.longitude, 14, `station-${id}`);
        await loadRecommendations(d.latitude, d.longitude);
      } catch {
        setDetail(null);
      }
    },
    [loadRecommendations, flyTo],
  );

  const handleDegraded = useCallback((alt: unknown) => {
    setRerouteAlt(alt as StationPin);
  }, []);

  useAvailabilityMonitor(selectedId, backupIdsRef.current, handleDegraded);

  useEffect(() => {
    if (position) {
      flyTo(position.lat, position.lon, 13, `geo-${Date.now()}`);
      setSearchLabel('Near me');
      setSearchDestination({ lat: position.lat, lon: position.lon, label: 'Near me' });
      loadRecommendations(position.lat, position.lon);
    }
  }, [position, loadRecommendations, flyTo]);

  useEffect(() => {
    loadRecommendations(origin.lat, origin.lon);
  }, [filters, recMode, loadRecommendations]);

  const handleSearch = useCallback((q: string) => {
    setSearchText(q);
    if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    searchDebounceRef.current = window.setTimeout(async () => {
      try {
        const res = await searchQuery(q);
        setSearchResults(res.geocode);
      } catch {
        setSearchResults([]);
      }
    }, 300);
  }, []);

  const pickSearchResult = useCallback(
    (r: { label: string; address: string; latitude: number; longitude: number }) => {
      if (!isInNL(r.latitude, r.longitude)) {
        alert('Please pick a location within the Netherlands.');
        return;
      }
      setSearchDestination({ lat: r.latitude, lon: r.longitude, label: r.label });
      setSearchLabel(r.label);
      setSearchResults([]);
      setSearchText(r.label);
      flyTo(r.latitude, r.longitude, 14, `search-${r.latitude}-${r.longitude}`);
      loadRecommendations(r.latitude, r.longitude);
      setShowSearch(false);
    },
    [flyTo, loadRecommendations],
  );

  const handleNearMe = () => {
    requestLocation();
    setShowSearch(false);
  };

  const detailOpen = !!detail && !showNav;
  const filterCount = countActiveFilters(extraFilters);
  const connectorLabel =
    CONNECTOR_OPTIONS.find((o) => o.id === profile.connectorType)?.label ?? 'CCS';
  const chromeHidden = detailOpen || showSearch || showAccount || showFilters;

  return (
    <div className="app-shell">
      <div className="map-pane">
        <ChargerMap
          stations={stations}
          selectedId={selectedId}
          onSelect={selectStation}
          onBboxChange={loadStations}
          navTarget={navTarget}
          searchDestination={searchDestination}
        />

        {loading && <div className="map-loading-bar" aria-hidden />}

        {!chromeHidden && (
          <div className="map-chrome map-chrome--mobile">
            <div className="map-chrome-top">
              <div className="map-legend">
                <span><i className="legend-dot green" /> Available</span>
                <span><i className="legend-dot red" /> Unavailable</span>
                <span><i className="legend-dot orange" /> Unknown</span>
              </div>
            </div>

            {recommendations.length > 0 && (
              <div className="map-chrome-rec">
                <p className="mobile-rec-title">
                  {searchDestination ? `Near ${searchLabel}` : 'Suggestions'}
                </p>
                <RecommendationCards cards={recommendations} onSelect={(c) => selectStation(c)} />
              </div>
            )}

            <div className="map-chrome-fab">
              <button type="button" className="icon-btn" onClick={requestLocation} title="Locate me">
                ◎
              </button>
            </div>

            <div className="map-chrome-dock">
              <BottomDock
                searchLabel={searchLabel}
                connectorLabel={connectorLabel}
                recMode={recMode}
                activeFilterCount={filterCount + (profile.connectorType ? 1 : 0)}
                onSearchOpen={() => setShowSearch(true)}
                onAccountOpen={() => setShowAccount(true)}
                onFilterOpen={() => setShowFilters(true)}
                onRecChange={setRecMode}
              />
            </div>
          </div>
        )}
      </div>

      {!detailOpen && (
        <DesktopSidebar
          searchLabel={searchLabel}
          searchText={searchText}
          searchResults={searchResults}
          searchDestination={searchDestination}
          connectorLabel={connectorLabel}
          recMode={recMode}
          activeFilterCount={filterCount + (profile.connectorType ? 1 : 0)}
          recommendations={recommendations}
          onSearchChange={handleSearch}
          onSearchPick={pickSearchResult}
          onNearMe={handleNearMe}
          onAccountOpen={() => setShowAccount(true)}
          onFilterOpen={() => setShowFilters(true)}
          onRecChange={setRecMode}
          onSelectRecommendation={selectStation}
          connectorType={profile.connectorType}
        />
      )}

      {showSearch && (
        <SearchSheet
          query={searchText}
          results={searchResults}
          onQueryChange={handleSearch}
          onPick={pickSearchResult}
          onNearMe={handleNearMe}
          onClose={() => setShowSearch(false)}
        />
      )}

      {showAccount && (
        <AccountSheet profile={profile} onChange={setProfile} onClose={() => setShowAccount(false)} />
      )}

      {showFilters && (
        <FilterSheet filters={extraFilters} onChange={setExtraFilters} onClose={() => setShowFilters(false)} />
      )}

      {detailOpen && (
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
        <NavigationPicker lat={detail.latitude} lon={detail.longitude} onClose={() => setShowNav(false)} />
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
