import PlayingCard from './PlayingCard.jsx';
import GameChat from './GameChat.jsx';
import { getBlackjackScore } from '../game/blackjackEngine.js';
import './BlackjackTable.css';

const BET_CHIPS = [20, 50, 100, 200, 500, 1000];

function HandView({ title, cards, hidden = false, meta = null, owner = 'player' }) {
  const visibleCards = hidden && cards.length > 1 ? [cards[0], null] : cards;
  return (
    <section className="blackjack-hand">
      <div className="blackjack-hand__head">
        <strong>{title}</strong>
        {meta && <span>{meta}</span>}
      </div>
      <div className="blackjack-hand__cards">
        {visibleCards.map((card, index) => (
          <span
            key={card?.id ?? `hidden-${index}`}
            className={`blackjack-hand__card-slot blackjack-hand__card-slot--${owner} ${hidden && index === 1 ? 'blackjack-hand__card-slot--hidden' : 'blackjack-hand__card-slot--reveal'}`}
            style={{ '--card-index': index }}
          >
            <PlayingCard card={card} hidden={!card} size="md" delay={index * 70} />
          </span>
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
    skip: 'No bet',
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
  selectedBet,
  onSelectBet,
  onBet,
  onSkip,
}) {
  const humanIndex = gameState.players.findIndex((player) => player.isHuman);
  const humanTurn = gameState.stage === 'playing' && gameState.actionIndex === humanIndex;
  const activePlayer = gameState.players[gameState.actionIndex];
  const human = gameState.players[humanIndex];
  const humanBetting = gameState.stage === 'betting' && human?.betDecision === 'pending';
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
              {gameState.stage === 'betting' && 'Puntate aperte'}
              {gameState.stage === 'playing' && `Turno di ${activePlayer?.name ?? '-'}`}
              {gameState.stage === 'showdown' && 'Mano conclusa'}
            </p>
          </header>

          <div className="blackjack-table__dealer">
            <div className="blackjack-table__shoe" aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <HandView
              title="Banco"
              cards={gameState.dealer.hand}
              hidden={gameState.dealer.hidden}
              meta={gameState.dealer.hidden ? 'Carta coperta' : `${getBlackjackScore(gameState.dealer.hand)}`}
              owner="dealer"
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
                {player.bet > 0 && (
                  <div className="blackjack-player__chips" aria-label={`Puntata ${player.bet}`}>
                    <span />
                    <span />
                    <strong>{player.bet.toLocaleString()}</strong>
                  </div>
                )}
                <HandView
                  title={player.hand.length > 0 ? `${getBlackjackScore(player.hand)} punti` : player.status === 'skipped' ? 'No bet' : 'In attesa'}
                  cards={player.hand}
                  meta={player.bet > 0 ? `Bet ${player.bet}` : null}
                  owner="player"
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
              {humanBetting && 'Scegli la tua puntata'}
              {!humanBetting && humanTurn && 'Tocca a te'}
              {!humanBetting && !humanTurn && gameState.stage === 'betting' && 'Aspetta le puntate'}
              {!humanBetting && !humanTurn && gameState.stage === 'playing' && `Aspetta ${activePlayer?.name}`}
              {!humanBetting && !humanTurn && gameState.stage !== 'playing' && gameState.stage !== 'betting' && 'Banco pronto'}
            </div>
            {gameState.stage === 'betting' && (
              <div className="blackjack-bets">
                <div className="blackjack-bets__chips">
                  {BET_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      className={selectedBet === chip ? 'blackjack-bets__chip blackjack-bets__chip--active' : 'blackjack-bets__chip'}
                      onClick={() => onSelectBet(chip)}
                      disabled={!humanBetting || chip > (human?.chips ?? 0)}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
                <div className="blackjack-bets__actions">
                  <button type="button" onClick={onBet} disabled={!humanBetting || selectedBet > (human?.chips ?? 0)}>
                    Bet {selectedBet}
                  </button>
                  <button type="button" onClick={onSkip} disabled={!humanBetting}>
                    No bet
                  </button>
                </div>
              </div>
            )}
            <div className="blackjack-actions__buttons">
              <button type="button" onClick={onDeal} disabled={!canDeal || gameState.stage === 'playing' || gameState.stage === 'betting'}>
                Apri puntate
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
