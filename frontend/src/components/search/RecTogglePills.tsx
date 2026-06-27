interface Props {
  active: 'fastest' | 'cheapest' | null;
  onChange: (mode: 'fastest' | 'cheapest' | null) => void;
}

export function RecTogglePills({ active, onChange }: Props) {
  return (
    <div className="top-bar-center">
      <button
        className={`pill-btn${active === 'fastest' ? ' active' : ''}`}
        onClick={() => onChange(active === 'fastest' ? null : 'fastest')}
      >
        Fastest
      </button>
      <button
        className={`pill-btn${active === 'cheapest' ? ' active' : ''}`}
        onClick={() => onChange(active === 'cheapest' ? null : 'cheapest')}
      >
        Cheapest
      </button>
    </div>
  );
}
