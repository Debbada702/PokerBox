import PlayingCard from './PlayingCard.jsx';
import './HeroSeat.css';

export default function HeroSeat({ player, isActiveTurn, showCards, phase }) {
  if (!player) return null;

  const { name, holeCards, status, chips, currentBet, isDealer } = player;
  const cardsVisible = showCards || (phase !== 'idle' && holeCards.length > 0);

  return (
    <div
      className={`hero-seat hero-seat--${status} ${isActiveTurn ? 'hero-seat--turn' : ''}`}
    >
      <div className="hero-seat__inner">
        <div className="hero-seat__avatar" aria-hidden>
          {name.charAt(0)}
        </div>
        <div className="hero-seat__body">
          <div className="hero-seat__meta">
            <span className="hero-seat__name">{name}</span>
            {isDealer && <span className="hero-seat__dealer">D</span>}
            <span className={`hero-seat__status hero-seat__status--${status}`}>
              {status === 'active' && 'In gioco'}
              {status === 'folded' && 'Fold'}
              {status === 'winner' && 'Vincitore'}
              {status === 'waiting' && 'In attesa'}
            </span>
          </div>
          <div className="hero-seat__chips-row">
            <span className="hero-seat__chips">{chips.toLocaleString()}</span>
            <span className="hero-seat__chips-label">chips</span>
            {currentBet > 0 && (
              <span className="hero-seat__bet">Puntata {currentBet}</span>
            )}
          </div>
        </div>
        <div className="hero-seat__cards">
          <PlayingCard card={holeCards[0]} hidden={!cardsVisible} size="xl" delay={0} />
          <PlayingCard card={holeCards[1]} hidden={!cardsVisible} size="xl" delay={100} />
        </div>
      </div>
      {isActiveTurn && <p className="hero-seat__turn-hint">E il tuo turno</p>}
    </div>
  );
}
