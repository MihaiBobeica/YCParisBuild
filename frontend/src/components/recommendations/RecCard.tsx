import type { RecommendationCard } from '../../api/client';

interface Props {
  card: RecommendationCard;
  variant?: 'horizontal' | 'vertical';
  onSelect: (card: RecommendationCard) => void;
}

function badgeClass(color: string | null): string {
  if (color === 'green') return 'badge badge-green';
  if (color === 'orange') return 'badge badge-orange';
  if (color === 'red') return 'badge badge-red';
  return 'badge badge-gray';
}

export function RecCard({ card, variant = 'horizontal', onSelect }: Props) {
  const specs = [
    card.travel_minutes != null ? `${card.travel_minutes} min` : null,
    card.energy_price != null ? `€${card.energy_price.toFixed(2)}/kWh` : null,
    card.max_power_kw != null ? `${card.max_power_kw} kW` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <button
      type="button"
      className={`rec-row${variant === 'vertical' ? ' rec-row--vertical' : ''}`}
      onClick={() => onSelect(card)}
    >
      <div className="rec-row-main">
        <span className="rec-row-name">{card.name || 'Charger'}</span>
        <span className="rec-row-specs">{specs || card.reason}</span>
      </div>
      <div className="rec-row-side">
        {card.availability && (
          <span className={badgeClass(card.pin_color)}>{card.availability}</span>
        )}
        {card.distance_km != null && (
          <span className="rec-row-distance">{card.distance_km} km</span>
        )}
      </div>
    </button>
  );
}
