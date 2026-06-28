import type { Filters } from '../../api/client';
import { MenuSheet } from '../layout/MenuSheet';

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
  onClose: () => void;
}

export function FilterSheet({ filters, onChange, onClose }: Props) {
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
        {['Free', '€', '€€', '€€€'].map((label, i) => (
          <button
            key={label}
            type="button"
            className={filters.max_price === [0, 0.35, 0.55, 999][i] ? 'active' : ''}
            onClick={() =>
              onChange({
                ...filters,
                max_price: [0, 0.35, 0.55, 999][i],
                known_price_only: i > 0,
              })
            }
          >
            {label}
          </button>
        ))}
      </div>

      <p className="filter-section-label">Speed</p>
      <div className="segmented filter-segmented">
        <button
          type="button"
          className={filters.speed !== 'fast' ? 'active' : ''}
          onClick={() => onChange({ ...filters, speed: 'slow', min_kw: undefined })}
        >
          Slow
        </button>
        <button
          type="button"
          className={filters.speed === 'fast' ? 'active' : ''}
          onClick={() => onChange({ ...filters, speed: 'fast', min_kw: 50 })}
        >
          Fast
        </button>
      </div>

      <p className="filter-section-label">Connector type</p>
      <p className="field-hint filter-hint">
        Set your car&apos;s plug in Account — the map only shows compatible chargers.
      </p>

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

      <label className="filter-checkbox">
        <input
          type="checkbox"
          checked={!!filters.known_price_only}
          onChange={(e) => onChange({ ...filters, known_price_only: e.target.checked })}
        />
        Known price only
      </label>

      <input
        className="filter-operator-input"
        placeholder="Operator name"
        value={filters.operator || ''}
        onChange={(e) => onChange({ ...filters, operator: e.target.value || undefined })}
      />
    </MenuSheet>
  );
}
