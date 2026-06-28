import type { RecommendationCard } from '../../api/client';

interface Props {
  card: RecommendationCard;
  variant?: 'horizontal' | 'vertical';
  onSelect: (card: RecommendationCard) => void;
}

export function RecCard({ card, variant = 'horizontal', onSelect }: Props) {
  return (
    <button
      type="button"
      className={`rec-card${variant === 'vertical' ? ' rec-card--vertical' : ''}`}
      onClick={() => onSelect(card)}
    >
      <div className="rec-card-type">{card.type.replace('_', ' ')}</div>
      <div className="rec-card-name">{card.name || 'Charger'}</div>
      <div className="rec-card-meta">
        {card.travel_minutes} min · {card.distance_km} km · {card.availability}
      </div>
      <div className="rec-card-meta">
        {card.energy_price != null ? `€${card.energy_price.toFixed(2)}/kWh` : 'Price unknown'} ·{' '}
        {card.max_power_kw ?? '?'} kW
      </div>
      <div className="rec-card-reason">{card.reason}</div>
    </button>
  );
}
