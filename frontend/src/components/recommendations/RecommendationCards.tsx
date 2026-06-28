import type { RecommendationCard } from '../../api/client';
import { RecCard } from './RecCard';

interface Props {
  cards: RecommendationCard[];
  onSelect: (card: RecommendationCard) => void;
}

export function RecommendationCards({ cards, onSelect }: Props) {
  if (!cards.length) return null;

  return (
    <div className="rec-panel-list">
      {cards.map((card) => (
        <RecCard
          key={`${card.type}-${card.station_id}`}
          card={card}
          variant="vertical"
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
