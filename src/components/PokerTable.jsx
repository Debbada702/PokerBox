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
  userNametag,
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
    handNumber,
  } = gameState;

  const human = getHumanPlayer(gameState);
  const toCall = human ? Math.max(0, currentBet - human.currentBet) : 0;
  const { local, opponents } = splitLocalAndOpponents(players);
  const showCards = phase === 'showdown';
  const humanTurn =
    local?.engineIndex === activePlayerIndex &&
    phase !== 'idle' &&
    phase !== 'showdown';

  const latest = actionLog?.[0] ?? null;
  const activePlayer = players[activePlayerIndex];
  const phaseLabel = getPhaseLabel(phase);

  return (
    <div className="poker-room">
      <header className="poker-room__header">
        <div className="poker-room__brand">
          <span className="poker-room__logo">PB</span>
          <h1 className="poker-room__title">PokerBox</h1>
        </div>
        <div className="poker-room__stats">
          {userNametag && (
            <span className="poker-room__stat poker-room__stat--user">{userNametag}</span>
          )}
          <span className="poker-room__stat">Mano #{handNumber}</span>
          <span className="poker-room__stat poker-room__stat--phase">{phaseLabel}</span>
        </div>
      </header>

      <ActionFeed entries={actionLog ?? []} latest={latest} />

      <div className="poker-room__table-zone">
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

            {opponents.map((entry, i) => (
              <PlayerSeat
                key={entry.player.id}
                player={entry.player}
                position={getOpponentSeatPosition(i, opponents.length)}
                isActiveTurn={
                  entry.engineIndex === activePlayerIndex && phase !== 'showdown'
                }
                showCards={showCards}
              />
            ))}

            <div className="poker-table__center">
              {activePlayer && phase !== 'idle' && phase !== 'showdown' && (
                <div className="poker-table__turn-banner">
                  <span>Turno</span>
                  <strong>{activePlayer.name}</strong>
                </div>
              )}
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
            </div>
          </div>
        </div>
      </div>

      <footer className="poker-room__footer">
        <div className={`poker-room__turn-status ${humanTurn ? 'poker-room__turn-status--you' : ''}`}>
          {phase === 'idle' || phase === 'showdown'
            ? 'Mano conclusa: premi Deal per continuare'
            : humanTurn
              ? 'E il tuo turno'
              : `Turno di ${activePlayer?.name ?? 'giocatore'}`}
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
        />
        <GameChat roomCode={roomCode} user={user} />
      </footer>
    </div>
  );
}
