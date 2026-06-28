import type { StationPin } from '../../api/client';

interface Props {
  alternative: StationPin;
  onSwitch: () => void;
  onDismiss: () => void;
}

export function ReroutePrompt({ alternative, onSwitch, onDismiss }: Props) {
  return (
    <div className="sheet reroute-sheet">
      <div className="sheet-handle" />
      <h3 className="reroute-title">This charger may no longer be available</h3>
      <p className="reroute-sub">Switch to a better option?</p>
      <div className="reroute-alt">
        <strong>{alternative.name}</strong>
        <div className="reroute-alt-meta">
          {alternative.availability_label}
          {alternative.energy_price != null ? ` · €${alternative.energy_price.toFixed(2)}/kWh` : ''}
          {alternative.max_power_kw ? ` · ${alternative.max_power_kw} kW` : ''}
        </div>
      </div>
      <button type="button" className="primary-pill reroute-switch" onClick={onSwitch}>
        Switch
      </button>
      <button type="button" className="reroute-keep" onClick={onDismiss}>
        Keep current charger
      </button>
    </div>
  );
}
