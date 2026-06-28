import type { RecommendationCard } from '../../api/client';
import { RecCard } from './RecCard';

interface Props {
  cards: RecommendationCard[];
  onSelect: (card: RecommendationCard) => void;
}

export function RecommendationCards({ cards, onSelect }: Props) {
  if (!cards.length) return null;

  return (
    <div className="rec-scroll">
      {cards.map((card) => (
        <RecCard
          key={`${card.type}-${card.station_id}`}
          card={card}
          variant="horizontal"
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
