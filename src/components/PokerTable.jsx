import PlayerSeat from './PlayerSeat.jsx';
import HeroSeat from './HeroSeat.jsx';
import CommunityCards from './CommunityCards.jsx';
import ActionsBar from './ActionsBar.jsx';
import ActionFeed from './ActionFeed.jsx';
import ChipSelector from './ChipSelector.jsx';
import WinBurst from './WinBurst.jsx';
import GameChat from './GameChat.jsx';
import { getPhaseLabel, getHumanPlayer } from '../game/pokerEngine.js';
import {
  splitLocalAndOpponents,
  getOpponentSeatPosition,
} from '../game/seatLayout.js';
import './PokerTable.css';

function roleLabel(player) {
  if (player?.role === 'dealer') return 'Dealer';
  if (player?.role === 'sb') return 'Small blind';
  if (player?.role === 'bb') return 'Big blind';
  return null;
}

function tableStatusText({ phase, humanTurn, activePlayer, handNumber }) {
  if (phase === 'idle') return 'Tavolo pronto: premi Deal per iniziare';
  if (phase === 'showdown') return `Mano #${handNumber} conclusa`;
  if (humanTurn) return 'Tocca a te';
  return `Turno di ${activePlayer?.name ?? 'giocatore'}`;
}

export default function PokerTable({
  gameState,
  selectedBet,
  onSelectBet,
  onDeal,
  canDeal = true,
  onCheck,
  onCall,
  onRaise,
  onAllIn,
  onFold,
  roomCode,
  user,
}) {
  const {
    phase,
    players,
    communityCards,
    pot,
    currentBet,
    activePlayerIndex,
    actionLog,
    handHistory,
    handNumber,
    sidePots,
  } = gameState;

  const human = getHumanPlayer(gameState);
  const activePlayer = players[activePlayerIndex];
  const dealerPlayer = players.find((player) => player.role === 'dealer');
  const smallBlindPlayer = players.find((player) => player.role === 'sb');
  const bigBlindPlayer = players.find((player) => player.role === 'bb');
  const { local, opponents } = splitLocalAndOpponents(players);
  const phaseLabel = getPhaseLabel(phase);
  const showCards = phase === 'showdown';
  const hasRoomChat = roomCode && roomCode !== 'LOCAL';
  const humanTurn = local?.engineIndex === activePlayerIndex && phase !== 'idle' && phase !== 'showdown';
  const toCall = human ? Math.max(0, currentBet - human.currentBet) : 0;
  const maxRaise = human ? Math.max(0, human.chips - toCall) : 0;
  const minRaise = Math.min(gameState.bettingRound?.minRaise ?? gameState.bigBlind ?? 20, Math.max(1, maxRaise));
  const humanBlindRole = human?.role === 'sb' ? 'small' : human?.role === 'bb' ? 'big' : null;
  const latest = actionLog?.[0] ?? null;
  const hasRealSidePots = sidePots?.length > 1 && players.some((player) => player.isAllIn);

  const roleRows = [
    ['D', dealerPlayer],
    ['SB', smallBlindPlayer],
    ['BB', bigBlindPlayer],
  ];

  return (
    <div className="poker-room">
      <div className={`poker-room__arena ${hasRoomChat ? '' : 'poker-room__arena--chatless'}`}>
        <aside className="poker-room__side poker-room__side--history">
          <ActionFeed
            entries={actionLog ?? []}
            handNumber={handNumber}
            dealerName={dealerPlayer?.name}
            handHistory={handHistory ?? []}
          />
        </aside>

        <main className="poker-room__play" aria-label="Tavolo Texas Hold'em">
          <section className="poker-room__table-zone">
            <div className="poker-table">
              <div className="poker-table__rail" />
              <div className="poker-table__felt">
                <div className="poker-table__racetrack" aria-hidden />
                <div className="poker-table__phase-strip">
                  <span>{phaseLabel}</span>
                  <strong>Mano #{handNumber}</strong>
                </div>
                <div className="poker-table__logo-felt">PB</div>
                <WinBurst latest={latest} human={human} />

                {opponents.map((entry, index) => (
                  <PlayerSeat
                    key={`${entry.player.userId ?? entry.player.name}-${entry.engineIndex}`}
                    player={entry.player}
                    position={getOpponentSeatPosition(index, opponents.length)}
                    isActiveTurn={entry.engineIndex === activePlayerIndex && phase !== 'showdown'}
                    showCards={showCards}
                  />
                ))}

                <div className="poker-table__center">
                  <div className={`poker-table__turn-banner ${humanTurn ? 'poker-table__turn-banner--human' : ''}`}>
                    <span>{phase === 'showdown' ? 'Risultato' : 'Turno'}</span>
                    <strong>{phase === 'showdown' ? latest?.playerName ?? '-' : activePlayer?.name ?? '-'}</strong>
                  </div>

                  <CommunityCards cards={communityCards} phase={phaseLabel} />

                  <div className="poker-table__pot">
                    <span className="poker-table__chip-stack" aria-hidden>
                      <span className="poker-table__chip poker-table__chip--red" />
                      <span className="poker-table__chip poker-table__chip--gold" />
                      <span className="poker-table__chip poker-table__chip--blue" />
                    </span>
                    <span className="poker-table__pot-label">Pot totale</span>
                    <span className="poker-table__pot-value">{pot.toLocaleString()}</span>
                  </div>

                  {hasRealSidePots && (
                    <div className="poker-table__sidepots">
                      {sidePots.map((sidePot, index) => (
                        <span key={`${sidePot.amount}-${index}`}>
                          Side {index + 1}: {sidePot.amount.toLocaleString()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="poker-room__footer">
            <div className={`poker-room__turn-status ${humanTurn ? 'poker-room__turn-status--you' : ''}`}>
              {tableStatusText({ phase, humanTurn, activePlayer, handNumber })}
            </div>

            <div className="poker-room__roles" aria-label="Ruoli della mano">
              {roleRows.map(([label, player]) => (
                <span key={label} className="poker-room__role">
                  <strong>{label}</strong>
                  {player?.name ?? '-'}
                  {player && <em>{roleLabel(player)}</em>}
                </span>
              ))}
            </div>

            <HeroSeat
              player={local?.player}
              isActiveTurn={humanTurn}
              showCards={showCards}
              phase={phase}
            />

            <ChipSelector
              selected={selectedBet}
              onSelect={onSelectBet}
              disabled={!humanTurn}
              min={minRaise}
              max={maxRaise}
              toCall={toCall}
            />

            <ActionsBar
              phase={phase}
              onDeal={onDeal}
              canDeal={canDeal}
              onCheck={onCheck}
              onCall={onCall}
              onRaise={onRaise}
              onAllIn={onAllIn}
              onFold={onFold}
              disabled={!humanTurn}
              pot={pot}
              currentBet={currentBet}
              toCall={toCall}
              selectedBet={selectedBet}
              humanChips={human?.chips}
              humanBlindRole={humanBlindRole}
            />
          </section>
        </main>

        {hasRoomChat && (
          <aside className="poker-room__side poker-room__side--chat">
            <GameChat roomCode={roomCode} user={user} />
          </aside>
        )}
      </div>
    </div>
  );
}
