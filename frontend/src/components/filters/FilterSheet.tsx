import type { Filters } from '../../api/client';

const PLUGS = ['IEC_62196_T2', 'IEC_62196_T2_COMBO', 'CHADEMO', 'TESLA'];

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
  onClose: () => void;
}

export function FilterSheet({ filters, onChange, onClose }: Props) {
  return (
    <div className="sheet">
      <div className="sheet-handle" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>Filter</h2>
        <button className="primary-pill" style={{ width: 'auto', padding: '10px 24px' }} onClick={onClose}>
          Save
        </button>
      </div>

      <p style={{ fontWeight: 600, marginBottom: 8 }}>Price</p>
      <div className="segmented" style={{ marginBottom: 20 }}>
        {['Free', '€', '€€', '€€€'].map((label, i) => (
          <button
            key={label}
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

      <p style={{ fontWeight: 600, marginBottom: 8 }}>Speed</p>
      <div className="segmented" style={{ marginBottom: 20 }}>
        <button
          className={filters.speed !== 'fast' ? 'active' : ''}
          onClick={() => onChange({ ...filters, speed: 'slow', min_kw: undefined })}
        >
          Slow
        </button>
        <button
          className={filters.speed === 'fast' ? 'active' : ''}
          onClick={() => onChange({ ...filters, speed: 'fast', min_kw: 50 })}
        >
          Fast
        </button>
      </div>

      <PlugsPicker
        selected={filters.connector_type}
        onSelect={(connector_type) => onChange({ ...filters, connector_type })}
      />

      <p style={{ fontWeight: 600, marginTop: 20, marginBottom: 8 }}>Availability</p>
      <div className="segmented" style={{ marginBottom: 20 }}>
        <button
          className={!filters.availability ? 'active' : ''}
          onClick={() => onChange({ ...filters, availability: undefined })}
        >
          All
        </button>
        <button
          className={filters.availability === 'available' ? 'active' : ''}
          onClick={() => onChange({ ...filters, availability: 'available' })}
        >
          Available
        </button>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <input
          type="checkbox"
          checked={!!filters.known_price_only}
          onChange={(e) => onChange({ ...filters, known_price_only: e.target.checked })}
        />
        Known price only
      </label>

      <input
        placeholder="Operator name"
        value={filters.operator || ''}
        onChange={(e) => onChange({ ...filters, operator: e.target.value || undefined })}
        style={{
          width: '100%',
          padding: 12,
          borderRadius: 12,
          border: '1px solid #eee',
          marginBottom: 12,
        }}
      />
    </div>
  );
}

function PlugsPicker({ selected, onSelect }: { selected?: string; onSelect: (v: string | undefined) => void }) {
  const labels: Record<string, string> = {
    IEC_62196_T2: 'Type 2',
    IEC_62196_T2_COMBO: 'CCS',
    CHADEMO: 'CHAdeMO',
    TESLA: 'NACS',
  };

  return (
    <>
      <p style={{ fontWeight: 600, marginBottom: 8 }}>Plugs</p>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
        {PLUGS.map((plug) => (
          <button
            key={plug}
            onClick={() => onSelect(selected === plug ? undefined : plug)}
            style={{
              minWidth: 80,
              padding: '16px 12px',
              borderRadius: 16,
              border: selected === plug ? '3px solid #000' : '1px solid #ddd',
              background: 'white',
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            {labels[plug] || plug}
          </button>
        ))}
      </div>
    </>
  );
}
