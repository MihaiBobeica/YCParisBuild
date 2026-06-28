import type { StationDetail, StationPin } from '../../api/client';
import { MenuSheet } from '../layout/MenuSheet';

interface Props {
  station: StationDetail;
  alternatives: StationPin[];
  onNavigate: () => void;
  onClose: () => void;
  onSelectAlternative: (s: StationPin) => void;
}

function badgeClass(color: string) {
  if (color === 'green') return 'badge badge-green';
  if (color === 'orange') return 'badge badge-orange';
  if (color === 'red') return 'badge badge-red';
  return 'badge badge-gray';
}

export function ChargerDetailSheet({
  station,
  alternatives,
  onNavigate,
  onClose,
  onSelectAlternative,
}: Props) {
  const address = [station.address, station.city].filter(Boolean).join(', ');

  return (
    <MenuSheet title={station.name || 'Charging station'} onClose={onClose}>
      <div className="detail-head">
        <span className={badgeClass(station.pin_color)}>{station.availability_label}</span>
        {address && <p className="detail-address">{address}</p>}
      </div>

      <div className="detail-grid">
        <div className="detail-cell">
          <span className="detail-k">Price / kWh</span>
          <span className="detail-v">
            {station.energy_price != null ? `€${station.energy_price.toFixed(2)}` : 'Unknown'}
          </span>
        </div>
        <div className="detail-cell">
          <span className="detail-k">Max power</span>
          <span className="detail-v">{station.max_power_kw != null ? `${station.max_power_kw} kW` : 'Unknown'}</span>
        </div>
        <div className="detail-cell">
          <span className="detail-k">Session fee</span>
          <span className="detail-v">
            {station.session_fee != null ? `€${station.session_fee.toFixed(2)}` : '—'}
          </span>
        </div>
        <div className="detail-cell">
          <span className="detail-k">Operator</span>
          <span className="detail-v">{station.operator || '—'}</span>
        </div>
        <div className="detail-cell detail-cell--wide">
          <span className="detail-k">Connectors</span>
          <span className="detail-v">{(station.connector_types || []).join(', ') || '—'}</span>
        </div>
      </div>

      {station.price_disclaimer && (
        <p className="detail-disclaimer">{station.price_disclaimer}</p>
      )}

      <button type="button" className="primary-pill detail-navigate" onClick={onNavigate}>
        Navigate
      </button>

      {alternatives.length > 0 && (
        <>
          <h3 className="detail-alt-title">Nearby alternatives</h3>
          <div className="detail-alt-list">
            {alternatives.map((alt) => (
              <button
                key={alt.id}
                type="button"
                className="search-result-item"
                onClick={() => onSelectAlternative(alt)}
              >
                <strong>{alt.name}</strong>
                <div className="detail-alt-meta">
                  {alt.distance_km != null ? `${alt.distance_km} km · ` : ''}
                  {alt.availability_label}
                  {alt.energy_price != null ? ` · €${alt.energy_price.toFixed(2)}/kWh` : ''}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </MenuSheet>
  );
}
