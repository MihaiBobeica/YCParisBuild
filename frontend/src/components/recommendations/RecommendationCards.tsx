import type { RecommendationCard } from '../../api/client';

interface Props {
  cards: RecommendationCard[];
  onSelect: (card: RecommendationCard) => void;
}

export function RecommendationCards({ cards, onSelect }: Props) {
  if (!cards.length) return null;

  return (
    <div className="rec-scroll">
      {cards.map((card) => (
        <button
          key={`${card.type}-${card.station_id}`}
          className="rec-card"
          onClick={() => onSelect(card)}
          style={{ textAlign: 'left', border: 'none', cursor: 'pointer' }}
        >
          <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#8E8E93', marginBottom: 4 }}>
            {card.type.replace('_', ' ')}
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{card.name}</div>
          <div style={{ color: '#8E8E93', fontSize: 13, marginBottom: 8 }}>
            {card.travel_minutes} min · {card.distance_km} km · {card.availability}
          </div>
          <div style={{ fontSize: 13, marginBottom: 8 }}>
            {card.energy_price != null ? `€${card.energy_price.toFixed(2)}/kWh` : 'Price unknown'} ·{' '}
            {card.max_power_kw ?? '?'} kW
          </div>
          <div style={{ fontSize: 12, fontWeight: 500 }}>{card.reason}</div>
        </button>
      ))}
    </div>
  );
}
