import { useEffect, useState } from 'react';
import { fetchOperators, type Filters } from '../../api/client';
import { MenuSheet } from '../layout/MenuSheet';
import { CONNECTOR_OPTIONS, type ConnectorPreference } from '../../hooks/useUserProfile';

interface Props {
  filters: Filters;
  connectorType: ConnectorPreference;
  onChange: (filters: Filters) => void;
  onClose: () => void;
}

const POWER_TIERS: Array<{ label: string; value: number | undefined }> = [
  { label: 'Any', value: undefined },
  { label: '11+', value: 11 },
  { label: '22+', value: 22 },
  { label: '50+', value: 50 },
  { label: '150+', value: 150 },
];

const PARKING_TYPES: Array<{ label: string; value: string | undefined }> = [
  { label: 'All', value: undefined },
  { label: 'On street', value: 'ON_STREET' },
  { label: 'Garage', value: 'PARKING_GARAGE' },
  { label: 'Motorway', value: 'ALONG_MOTORWAY' },
];

export function FilterSheet({ filters, connectorType, onChange, onClose }: Props) {
  const [operators, setOperators] = useState<string[]>([]);

  useEffect(() => {
    fetchOperators()
      .then(setOperators)
      .catch(() => setOperators([]));
  }, []);

  const connectorLabel =
    CONNECTOR_OPTIONS.find((c) => c.id === connectorType)?.label ?? null;

  return (
    <MenuSheet
      title="Filter"
      onClose={onClose}
      headerAction={
        <button type="button" className="menu-sheet-save" onClick={onClose}>
          Save
        </button>
      }
    >
      <p className="filter-section-label">Charging power</p>
      <div className="segmented filter-segmented">
        {POWER_TIERS.map((tier) => (
          <button
            key={tier.label}
            type="button"
            className={(filters.min_kw ?? undefined) === tier.value ? 'active' : ''}
            onClick={() => onChange({ ...filters, min_kw: tier.value })}
          >
            {tier.label}
            {tier.value ? ' kW' : ''}
          </button>
        ))}
      </div>

      <p className="filter-section-label filter-section-label--spaced">Parking</p>
      <div className="segmented filter-segmented">
        {PARKING_TYPES.map((opt) => (
          <button
            key={opt.label}
            type="button"
            className={(filters.parking_type ?? undefined) === opt.value ? 'active' : ''}
            onClick={() => onChange({ ...filters, parking_type: opt.value })}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <p className="filter-section-label filter-section-label--spaced">Availability</p>
      <div className="segmented filter-segmented">
        <button
          type="button"
          className={!filters.availability ? 'active' : ''}
          onClick={() => onChange({ ...filters, availability: undefined })}
        >
          All
        </button>
        <button
          type="button"
          className={filters.availability === 'available' ? 'active' : ''}
          onClick={() => onChange({ ...filters, availability: 'available' })}
        >
          Available
        </button>
      </div>

      <p className="filter-section-label filter-section-label--spaced">Operator</p>
      <select
        className="field-input filter-operator-select"
        value={filters.operator || ''}
        onChange={(e) => onChange({ ...filters, operator: e.target.value || undefined })}
      >
        <option value="">Any operator</option>
        {operators.map((op) => (
          <option key={op} value={op}>
            {op}
          </option>
        ))}
      </select>

      <p className="filter-section-label filter-section-label--spaced">Connector type</p>
      <p className="field-hint filter-hint">
        {connectorLabel
          ? `Using your Account connector: ${connectorLabel}. The map only shows compatible chargers.`
          : 'Set your car’s connector in Account — the map only shows compatible chargers.'}
      </p>
    </MenuSheet>
  );
}
