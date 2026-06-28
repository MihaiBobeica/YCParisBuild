import type { StationDetail, StationPin } from '../../api/client';

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
  return (
    <div className="sheet">
      <div className="sheet-handle" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <span className={badgeClass(station.pin_color)}>{station.availability_label}</span>
          <h2 style={{ margin: '8px 0 4px' }}>{station.name || 'Charging station'}</h2>
          <p style={{ margin: 0, color: '#8E8E93' }}>
            {[station.address, station.city].filter(Boolean).join(', ')}
          </p>
        </div>
        <button className="icon-btn" onClick={onClose}>
          ✕
        </button>
      </div>

      <div style={{ margin: '16px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 14 }}>
        <div>
          <div style={{ color: '#8E8E93' }}>Price / kWh</div>
          <div style={{ fontWeight: 600 }}>
            {station.energy_price != null ? `€${station.energy_price.toFixed(2)}` : 'Price unknown'}
          </div>
        </div>
        <div>
          <div style={{ color: '#8E8E93' }}>Max power</div>
          <div style={{ fontWeight: 600 }}>{station.max_power_kw ?? 'Unknown'} kW</div>
        </div>
        <div>
          <div style={{ color: '#8E8E93' }}>Session fee</div>
          <div style={{ fontWeight: 600 }}>
            {station.session_fee != null ? `€${station.session_fee.toFixed(2)}` : '—'}
          </div>
        </div>
        <div>
          <div style={{ color: '#8E8E93' }}>Operator</div>
          <div style={{ fontWeight: 600 }}>{station.operator || '—'}</div>
        </div>
        <div>
          <div style={{ color: '#8E8E93' }}>Connectors</div>
          <div style={{ fontWeight: 600 }}>{(station.connector_types || []).join(', ') || '—'}</div>
        </div>
      </div>

      {station.price_disclaimer && (
        <p style={{ fontSize: 12, color: '#8E8E93' }}>{station.price_disclaimer}</p>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button className="primary-pill" style={{ flex: 1 }} onClick={onNavigate}>
          Navigate
        </button>
      </div>

      {alternatives.length > 0 && (
        <>
          <h3 style={{ marginTop: 24 }}>Nearby alternatives</h3>
          {alternatives.map((alt) => (
            <button
              key={alt.id}
              className="search-result-item"
              onClick={() => onSelectAlternative(alt)}
            >
              <strong>{alt.name}</strong>
              <div style={{ color: '#8E8E93', fontSize: 13 }}>
                {alt.distance_km != null ? `${alt.distance_km} km · ` : ''}
                {alt.availability_label}
                {alt.energy_price != null ? ` · €${alt.energy_price.toFixed(2)}/kWh` : ''}
              </div>
            </button>
          ))}
        </>
      )}
    </div>
  );
}
