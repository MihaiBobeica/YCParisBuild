import { useEffect, useState } from 'react';
import { fetchOperators, type Filters } from '../../api/client';
import { MenuSheet } from '../layout/MenuSheet';

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
  onClose: () => void;
}

const PRICE_TIERS: Array<{ label: string; value: number }> = [
  { label: 'Free', value: 0 },
  { label: '€', value: 0.35 },
  { label: '€€', value: 0.55 },
  { label: '€€€', value: 999 },
];

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

const ACCESS_CLASSES: Array<{ label: string; value: string | undefined }> = [
  { label: 'All', value: undefined },
  { label: 'Public', value: 'public' },
  { label: 'Semi-public', value: 'semi-public' },
];

export function FilterSheet({ filters, onChange, onClose }: Props) {
  const [operators, setOperators] = useState<string[]>([]);

  useEffect(() => {
    fetchOperators()
      .then(setOperators)
      .catch(() => setOperators([]));
  }, []);

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
      <p className="filter-section-label">Price</p>
      <div className="segmented filter-segmented">
        {PRICE_TIERS.map((tier, i) => (
          <button
            key={tier.label}
            type="button"
            className={filters.max_price === tier.value ? 'active' : ''}
            onClick={() =>
              onChange({ ...filters, max_price: tier.value, known_price_only: i > 0 })
            }
          >
            {tier.label}
          </button>
        ))}
      </div>

      <p className="filter-section-label filter-section-label--spaced">Charging power</p>
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

      <p className="filter-section-label filter-section-label--spaced">Access</p>
      <div className="segmented filter-segmented">
        {ACCESS_CLASSES.map((opt) => (
          <button
            key={opt.label}
            type="button"
            className={(filters.access_class ?? undefined) === opt.value ? 'active' : ''}
            onClick={() => onChange({ ...filters, access_class: opt.value })}
          >
            {opt.label}
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

      <label className="filter-checkbox">
        <input
          type="checkbox"
          checked={!!filters.known_price_only}
          onChange={(e) => onChange({ ...filters, known_price_only: e.target.checked })}
        />
        Known price only
      </label>

      <p className="filter-section-label filter-section-label--spaced">Connector type</p>
      <p className="field-hint filter-hint">
        Set your car&apos;s plug in Account — the map only shows compatible chargers.
      </p>
    </MenuSheet>
  );
}
