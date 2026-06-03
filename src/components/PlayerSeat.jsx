import PlayingCard from './PlayingCard.jsx';
import './PlayerSeat.css';

export default function PlayerSeat({
  player,
  position,
  isActiveTurn,
  showCards,
}) {
  const {
    name,
    holeCards,
    status,
    chips,
    currentBet,
    isDealer,
    isSmallBlind,
    isBigBlind,
  } = player;
  const cardsVisible = showCards && holeCards.length > 0;
  const markers = [
    isDealer && { key: 'dealer', label: 'D', title: 'Dealer' },
    isSmallBlind && { key: 'sb', label: 'SB', title: 'Small blind' },
    isBigBlind && { key: 'bb', label: 'BB', title: 'Big blind' },
  ].filter(Boolean);

  return (
    <div
      className={`player-seat player-seat--${position} player-seat--${status} ${
        isActiveTurn ? 'player-seat--turn' : ''
      }`}
    >
      {markers.length > 0 && (
        <div className="player-seat__markers">
          {markers.map((marker) => (
            <span
              key={marker.key}
              className={`player-seat__marker player-seat__marker--${marker.key}`}
              title={marker.title}
            >
              {marker.label}
            </span>
          ))}
        </div>
      )}
      <div className="player-seat__cards">
        <PlayingCard card={holeCards[0]} hidden={!cardsVisible} size="sm" delay={0} />
        <PlayingCard card={holeCards[1]} hidden={!cardsVisible} size="sm" delay={60} />
      </div>
      <div className="player-seat__panel">
        {isActiveTurn && <span className="player-seat__turn-badge">Turno</span>}
        <span className="player-seat__name">{name}</span>
        <span className="player-seat__chips">{chips.toLocaleString()}</span>
        {currentBet > 0 && (
          <span className="player-seat__bet">{currentBet}</span>
        )}
      </div>
      {isActiveTurn && <span className="player-seat__turn-ring" aria-hidden />}
    </div>
  );
}
