import PlayingCard from './PlayingCard.jsx';
import './CommunityCards.css';

export default function CommunityCards({ cards, phase }) {
  const slots = [0, 1, 2, 3, 4];

  return (
    <div className="community-cards">
      <p className="community-cards__label">{phase}</p>
      <div className="community-cards__row">
        {slots.map((i) => (
          <div
            key={i}
            className={`community-cards__slot ${cards[i] ? 'community-cards__slot--dealt' : ''}`}
          >
            <PlayingCard card={cards[i] ?? null} size="md" delay={i * 100} />
          </div>
        ))}
      </div>
    </div>
  );
}
