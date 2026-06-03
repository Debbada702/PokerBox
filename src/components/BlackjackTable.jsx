import PlayingCard from './PlayingCard.jsx';
import GameChat from './GameChat.jsx';
import { getBlackjackScore } from '../game/blackjackEngine.js';
import './BlackjackTable.css';

function HandView({ title, cards, hidden = false, meta = null }) {
  const visibleCards = hidden && cards.length > 1 ? [cards[0], null] : cards;
  return (
    <section className="blackjack-hand">
      <div className="blackjack-hand__head">
        <strong>{title}</strong>
        {meta && <span>{meta}</span>}
      </div>
      <div className="blackjack-hand__cards">
        {visibleCards.map((card, index) => (
          <PlayingCard key={card?.id ?? `hidden-${index}`} card={card} hidden={!card} size="md" delay={index * 60} />
        ))}
      </div>
    </section>
  );
}

function resultLabel(result) {
  return {
    win: 'Vinto',
    lose: 'Perso',
    push: 'Push',
    blackjack: 'Blackjack',
  }[result] ?? '';
}

export default function BlackjackTable({
  gameState,
  user,
  roomCode,
  onDeal,
  canDeal,
  onHit,
  onStand,
  onDouble,
}) {
  const humanIndex = gameState.players.findIndex((player) => player.isHuman);
  const humanTurn = gameState.stage === 'playing' && gameState.actionIndex === humanIndex;
  const activePlayer = gameState.players[gameState.actionIndex];
  const human = gameState.players[humanIndex];
  const canDouble = humanTurn && human?.hand?.length === 2 && human.chips >= human.bet;
  const hasRoomChat = roomCode && roomCode !== 'LOCAL';

  return (
    <div className="blackjack-room">
      <main className={`blackjack-room__layout ${hasRoomChat ? '' : 'blackjack-room__layout--solo'}`}>
        <section className="blackjack-table">
          <header className="blackjack-table__top">
            <div>
              <span>Blackjack</span>
              <strong>Mano #{gameState.handNumber}</strong>
            </div>
            <p>
              {gameState.stage === 'idle' && 'Pronto per una nuova mano'}
              {gameState.stage === 'playing' && `Turno di ${activePlayer?.name ?? '-'}`}
              {gameState.stage === 'showdown' && 'Mano conclusa'}
            </p>
          </header>

          <div className="blackjack-table__dealer">
            <HandView
              title="Banco"
              cards={gameState.dealer.hand}
              hidden={gameState.dealer.hidden}
              meta={gameState.dealer.hidden ? 'Carta coperta' : `${getBlackjackScore(gameState.dealer.hand)}`}
            />
          </div>

          <div className="blackjack-table__players">
            {gameState.players.map((player) => (
              <article
                key={player.userId ?? player.id}
                className={`blackjack-player ${player.isHuman ? 'blackjack-player--human' : ''} ${gameState.actionIndex === player.id && gameState.stage === 'playing' ? 'blackjack-player--turn' : ''}`}
              >
                <div className="blackjack-player__meta">
                  <strong>{player.name}</strong>
                  <span>{player.chips.toLocaleString()} chips</span>
                </div>
                <HandView
                  title={`${getBlackjackScore(player.hand)} punti`}
                  cards={player.hand}
                  meta={player.bet > 0 ? `Bet ${player.bet}` : null}
                />
                {player.result && (
                  <p className={`blackjack-player__result blackjack-player__result--${player.result}`}>
                    {resultLabel(player.result)}
                    {player.payout > 0 && <span> +{player.payout.toLocaleString()}</span>}
                  </p>
                )}
              </article>
            ))}
          </div>

          <footer className="blackjack-actions">
            <div className={`blackjack-actions__status ${humanTurn ? 'blackjack-actions__status--turn' : ''}`}>
              {humanTurn ? 'Tocca a te' : gameState.stage === 'playing' ? `Aspetta ${activePlayer?.name}` : 'Banco pronto'}
            </div>
            <div className="blackjack-actions__buttons">
              <button type="button" onClick={onDeal} disabled={!canDeal || gameState.stage === 'playing'}>
                Deal
              </button>
              <button type="button" onClick={onHit} disabled={!humanTurn}>
                Hit
              </button>
              <button type="button" onClick={onStand} disabled={!humanTurn}>
                Stand
              </button>
              <button type="button" onClick={onDouble} disabled={!canDouble}>
                Double
              </button>
            </div>
          </footer>
        </section>

        {hasRoomChat && (
          <aside className="blackjack-room__chat">
            <GameChat roomCode={roomCode} user={user} />
          </aside>
        )}
      </main>
    </div>
  );
}
