/**
 * Vista tavolo: il giocatore locale è sempre in basso (verso il monitor).
 * Gli avversari sono distribuiti sul lato opposto del tavolo.
 * (In multiplayer ogni client ruoterebbe la stessa logica sul proprio id.)
 */

const OPPONENT_POSITIONS = {
  1: ['top'],
  2: ['top-left', 'top-right'],
  3: ['left', 'top', 'right'],
  4: ['bottom-left', 'top-left', 'top-right', 'bottom-right'],
  5: ['bottom-left', 'top-left', 'top', 'top-right', 'bottom-right'],
};

export function splitLocalAndOpponents(players) {
  const localIndex = players.findIndex((p) => p.isHuman);
  const local =
    localIndex >= 0 ? { player: players[localIndex], engineIndex: localIndex } : null;

  const opponents = [];
  for (let i = 0; i < players.length; i++) {
    if (i === localIndex) continue;
    opponents.push({ player: players[i], engineIndex: i });
  }

  return { local, opponents };
}

export function getOpponentSeatPosition(visualIndex, opponentCount) {
  const layout = OPPONENT_POSITIONS[opponentCount];
  if (!layout) return 'top';
  return layout[visualIndex] ?? 'top';
}
