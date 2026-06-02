import PlayerSeat from './PlayerSeat.jsx';
import HeroSeat from './HeroSeat.jsx';
import CommunityCards from './CommunityCards.jsx';
import ActionsBar from './ActionsBar.jsx';
import ActionFeed from './ActionFeed.jsx';
import ChipSelector from './ChipSelector.jsx';
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
  onCheck,
  onCall,
  onRaise,
  onFold,
  userNametag,
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

  return (
    <div className="poker-room">
      <header className="poker-room__header">
        <div className="poker-room__brand">
          <span className="poker-room__logo">♠</span>
          <h1 className="poker-room__title">PokerBox</h1>
        </div>
        <div className="poker-room__stats">
          {userNametag && (
            <span className="poker-room__stat poker-room__stat--user">{userNametag}</span>
          )}
          <span className="poker-room__stat">Mano #{handNumber}</span>
          <span className="poker-room__stat poker-room__stat--phase">
            {getPhaseLabel(phase)}
          </span>
        </div>
      </header>

      <ActionFeed entries={actionLog ?? []} latest={latest} />

      <div className="poker-room__table-zone">
        <div className="poker-room__spotlight" aria-hidden />
        <div className="poker-table">
          <div className="poker-table__rail" />
          <div className="poker-table__felt">
            <div className="poker-table__racetrack" aria-hidden />
            <div className="poker-table__logo-felt">PokerBox</div>

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
                  Turno di <strong>{activePlayer.name}</strong>
                </div>
              )}
              <CommunityCards
                cards={communityCards}
                phase={getPhaseLabel(phase)}
              />
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
          onCheck={onCheck}
          onCall={onCall}
          onRaise={onRaise}
          onFold={onFold}
          disabled={!humanTurn}
          pot={pot}
          currentBet={currentBet}
          toCall={toCall}
          selectedBet={selectedBet}
          humanChips={human?.chips}
        />
      </footer>
    </div>
  );
}
