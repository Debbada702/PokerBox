import './PlayingCard.css';

const PIP_COUNTS = {
  A: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
};

const FACE_RANKS = new Set(['J', 'Q', 'K']);

export default function PlayingCard({ card, hidden, size = 'md', delay = 0 }) {
  if (hidden) {
    return (
      <div
        className={`playing-card playing-card--back playing-card--${size}`}
        style={{ animationDelay: `${delay}ms` }}
        aria-hidden
      >
        <span className="playing-card__back-frame" />
        <span className="playing-card__back-mark">PB</span>
      </div>
    );
  }
  if (!card) {
    return <div className={`playing-card playing-card--empty playing-card--${size}`} />;
  }

  const pipCount = PIP_COUNTS[card.rank] ?? 0;
  const isFace = FACE_RANKS.has(card.rank);

  return (
    <div
      className={`playing-card playing-card--face playing-card--${card.color} playing-card--${size}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="playing-card__paper">
        <span className="playing-card__corner playing-card__corner--tl">
          <span className="playing-card__rank">{card.rank}</span>
          <span className="playing-card__suit">{card.suit}</span>
        </span>
        {isFace ? (
          <span className={`playing-card__royal playing-card__royal--${card.rank}`} aria-hidden>
            <span className="playing-card__royal-crown" />
            <span className="playing-card__royal-head" />
            <span className="playing-card__royal-body">
              <span className="playing-card__royal-rank">{card.rank}</span>
              <span className="playing-card__royal-suit">{card.suit}</span>
            </span>
            <span className="playing-card__royal-weapon" />
          </span>
        ) : (
          <span className={`playing-card__pips playing-card__pips--${pipCount}`} aria-hidden>
            {Array.from({ length: pipCount }, (_, index) => (
              <span
                key={`${card.id}-${index}`}
                className={`playing-card__pip playing-card__pip--${index + 1}`}
              >
                {card.suit}
              </span>
            ))}
          </span>
        )}
        <span className="playing-card__corner playing-card__corner--br">
          <span className="playing-card__rank">{card.rank}</span>
          <span className="playing-card__suit">{card.suit}</span>
        </span>
      </div>
    </div>
  );
}
