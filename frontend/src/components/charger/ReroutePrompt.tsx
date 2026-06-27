import type { StationPin } from '../../api/client';

interface Props {
  alternative: StationPin;
  onSwitch: () => void;
  onDismiss: () => void;
}

export function ReroutePrompt({ alternative, onSwitch, onDismiss }: Props) {
  return (
    <div className="sheet" style={{ maxHeight: '40vh' }}>
      <div className="sheet-handle" />
      <h3 style={{ marginTop: 0 }}>This charger may no longer be available</h3>
      <p style={{ color: '#8E8E93' }}>Switch to a better option?</p>
      <div className="rec-card" style={{ minWidth: 'unset', marginBottom: 16 }}>
        <strong>{alternative.name}</strong>
        <div style={{ color: '#8E8E93', fontSize: 13, marginTop: 4 }}>
          {alternative.availability_label}
          {alternative.energy_price != null ? ` · €${alternative.energy_price.toFixed(2)}/kWh` : ''}
          {alternative.max_power_kw ? ` · ${alternative.max_power_kw} kW` : ''}
        </div>
      </div>
      <button className="primary-pill" onClick={onSwitch} style={{ marginBottom: 8 }}>
        Switch
      </button>
      <button
        className="pill-btn"
        style={{ width: '100%', boxShadow: 'none', background: '#F2F2F7' }}
        onClick={onDismiss}
      >
        Keep current charger
      </button>
    </div>
  );
}
