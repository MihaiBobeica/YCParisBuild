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
import { FilterSheet } from '../components/filters/FilterSheet';
import { partnerToStationDetail, type PartnerSite } from '../data/partnerSites';
import { BottomDock, countActiveFilters } from '../components/layout/BottomDock';
import { DesktopSidebar } from '../components/layout/DesktopSidebar';
import { SearchSheet } from '../components/layout/SearchSheet';
import { ChargerMap } from '../components/map/ChargerMap';
import type { MapNavTarget } from '../components/map/MapController';
import type { SearchDestination } from '../components/map/SearchDestinationPin';
import { RecommendationCards } from '../components/recommendations/RecommendationCards';
import { useMapStations } from '../hooks/useMapStations';
import type { UserProfile } from '../hooks/useUserProfile';
import { isInNL } from '../utils/nlBounds';

interface MapPageProps {
  profile: UserProfile;
  setProfile: (patch: Partial<UserProfile>) => void;
  signOut: () => void;
}

export function MapPage({ profile, setProfile, signOut }: MapPageProps) {
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
  const [recMode, setRecMode] = useState<'fastest' | 'cheapest' | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<PartnerSite | null>(null);
  const [savingsRefresh, setSavingsRefresh] = useState(0);
  const [navTarget, setNavTarget] = useState<MapNavTarget | null>(null);
  const [origin, setOrigin] = useState({ lat: 52.1326, lon: 5.2913 });
  const [toast, setToast] = useState<string | null>(null);
  const searchDebounceRef = useRef<number | null>(null);

  const filters = useMemo<Filters>(() => {
    const f: Filters = { ...extraFilters };
    if (profile.connectorType) f.connector_type = profile.connectorType;
    return f;
  }, [extraFilters, profile.connectorType]);

  const { stations, loading, loadStations } = useMapStations(filters, origin);

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
      setSearchDestination(null);
      try {
        const [d, alts] = await Promise.all([fetchStationDetail(id), fetchAlternatives(id)]);
        setDetail(d);
        setAlternatives(alts);
        flyTo(d.latitude, d.longitude, 14, `station-${id}`);
        await loadRecommendations(d.latitude, d.longitude);
      } catch {
        setDetail(null);
      }
    },
    [loadRecommendations, flyTo],
  );

  const selectPartner = useCallback(
    (site: PartnerSite) => {
      setSelectedPartner(site);
      setSearchDestination(null);
      flyTo(site.latitude, site.longitude, 15, `partner-${site.id}`);
    },
    [flyTo],
  );

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
        setToast('Please pick a location within the Netherlands.');
        window.setTimeout(() => setToast(null), 3000);
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

  const detailOpen = !!detail && !showNav;
  const partnerOpen = !!selectedPartner && !showNav;
  const filterCount = countActiveFilters(extraFilters);
  const menuOpen = showSearch || showAccount || showFilters;
  const chromeBottomHidden = menuOpen || detailOpen || partnerOpen;

  return (
    <div className="app-shell">
      <div className="map-pane">
        <ChargerMap
          stations={stations}
          selectedId={selectedId}
          onSelect={selectStation}
          onSelectPartner={selectPartner}
          onBboxChange={loadStations}
          navTarget={navTarget}
          searchDestination={searchDestination}
        />

        {loading && <div className="map-loading-bar" aria-hidden />}

        <div className="map-legend map-legend--desktop">
          <span><i className="legend-dot green" /> Available</span>
          <span><i className="legend-dot red" /> Unavailable</span>
        </div>

        <div className="map-chrome map-chrome--mobile">
          <div className="map-chrome-top">
            <div className="map-legend">
              <span><i className="legend-dot green" /> Available</span>
              <span><i className="legend-dot red" /> Unavailable</span>
            </div>
          </div>

          <div className={`map-chrome-bottom${chromeBottomHidden ? ' map-chrome-bottom--hidden' : ''}`}>
            <div className="map-chrome-dock-wrap">
              <BottomDock
                searchLabel={searchLabel}
                recMode={recMode}
                activeFilterCount={filterCount + (profile.connectorType ? 1 : 0)}
                onSearchOpen={() => setShowSearch(true)}
                onAccountOpen={() => setShowAccount(true)}
                onFilterOpen={() => setShowFilters(true)}
                onRecChange={setRecMode}
              >
                {recommendations.length > 0 && (
                  <div className="rec-panel">
                    <div className="rec-panel-divider" />
                    <p className="rec-panel-title">
                      {searchDestination ? `Near ${searchLabel}` : 'Suggestions nearby'}
                    </p>
                    <RecommendationCards cards={recommendations} onSelect={(c) => selectStation(c)} />
                  </div>
                )}
              </BottomDock>
            </div>
          </div>
        </div>
      </div>

      <DesktopSidebar
          searchLabel={searchLabel}
          searchText={searchText}
          searchResults={searchResults}
          searchDestination={searchDestination}
          recMode={recMode}
          activeFilterCount={filterCount + (profile.connectorType ? 1 : 0)}
          recommendations={recommendations}
          onSearchChange={handleSearch}
          onSearchPick={pickSearchResult}
          onAccountOpen={() => setShowAccount(true)}
          onFilterOpen={() => setShowFilters(true)}
          onRecChange={setRecMode}
          onSelectRecommendation={selectStation}
        />

      {showSearch && (
        <SearchSheet
          query={searchText}
          results={searchResults}
          onQueryChange={handleSearch}
          onPick={pickSearchResult}
          onClose={() => setShowSearch(false)}
        />
      )}

      {showAccount && (
        <AccountSheet
          profile={profile}
          onChange={setProfile}
          onClose={() => setShowAccount(false)}
          onSignOut={signOut}
          savingsRefresh={savingsRefresh}
        />
      )}

      {showFilters && (
        <FilterSheet
          filters={extraFilters}
          connectorType={profile.connectorType}
          onChange={setExtraFilters}
          onClose={() => setShowFilters(false)}
        />
      )}

      {partnerOpen && selectedPartner && (
        <ChargerDetailSheet
          station={partnerToStationDetail(selectedPartner)}
          alternatives={[]}
          partnerSite={selectedPartner}
          email={profile.email}
          onBooked={() => setSavingsRefresh((n) => n + 1)}
          onNavigate={() => setShowNav(true)}
          onClose={() => setSelectedPartner(null)}
          onSelectAlternative={() => {}}
        />
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

      {showNav && (detail || selectedPartner) && (
        <NavigationPicker
          lat={selectedPartner ? selectedPartner.latitude : detail!.latitude}
          lon={selectedPartner ? selectedPartner.longitude : detail!.longitude}
          onClose={() => setShowNav(false)}
        />
      )}

      {toast && <div className="app-toast" role="status">{toast}</div>}
    </div>
  );
}
