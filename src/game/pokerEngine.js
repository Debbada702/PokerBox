import PokerSolver from 'pokersolver';
import { createDeck, drawCards, shuffleDeck } from './deck.js';

const { Hand } = PokerSolver;

export const PHASES = {
  IDLE: 'idle',
  PREFLOP: 'preflop',
  FLOP: 'flop',
  TURN: 'turn',
  RIVER: 'river',
  SHOWDOWN: 'showdown',
};

export const SMALL_BLIND = 10;
export const BIG_BLIND = 20;
export const CHIP_VALUES = [5, 10, 20, 50, 100, 250, 500];

const BOT_NAMES = ['Alex', 'Mia', 'Leo', 'Sara', 'Max', 'Eva'];
const SUIT_TO_SOLVER = {
  '\u2660': 's',
  '\u2665': 'h',
  '\u2666': 'd',
  '\u2663': 'c',
};

let logId = 0;

function emptyBettingRound(bigBlind = BIG_BLIND) {
  return {
    actedIndices: [],
    minRaise: bigBlind,
    lastAggressorIndex: -1,
  };
}

function baseTableState(players) {
  return {
    phase: PHASES.IDLE,
    players,
    communityCards: [],
    deck: [],
    pot: 0,
    currentBet: 0,
    activePlayerIndex: 0,
    dealerIndex: 0,
    smallBlindIndex: -1,
    bigBlindIndex: -1,
    actionLog: [],
    handHistory: [],
    winnerId: null,
    handNumber: 0,
    smallBlind: SMALL_BLIND,
    bigBlind: BIG_BLIND,
    bettingRound: emptyBettingRound(BIG_BLIND),
  };
}

export function createInitialState(playerCount = 6, humanProfile = null) {
  const count = Math.min(6, Math.max(2, playerCount));
  const roster = [{
    userId: humanProfile?.id ?? 0,
    nametag: humanProfile?.nametag ?? 'Tu',
    chips: humanProfile?.chips ?? 0,
    isHuman: true,
    isBot: false,
  }];

  for (let i = 1; i < count; i += 1) {
    roster.push({
      userId: null,
      nametag: BOT_NAMES[i - 1] ?? `Bot ${i}`,
      chips: 10_000,
      isHuman: false,
      isBot: true,
    });
  }

  return createGameFromRoster(roster, humanProfile);
}

export function createGameFromRoster(roster, humanProfile = null) {
  const players = roster.map((seat, i) => ({
    id: i,
    userId: seat.userId,
    name: seat.nametag,
    holeCards: [],
    status: 'waiting',
    chips: seat.isBot ? 10_000 : (seat.chips ?? (seat.isHuman ? humanProfile?.chips ?? 0 : 0)),
    currentBet: 0,
    committed: 0,
    isHuman: !!seat.isHuman,
    isBot: !!seat.isBot,
    isDealer: false,
    isSmallBlind: false,
    isBigBlind: false,
  }));

  return baseTableState(players);
}

export function withHumanPerspective(state, user) {
  if (!state || !user) return state;
  return {
    ...state,
    players: state.players.map((player) => ({
      ...player,
      isHuman: !player.isBot && player.userId === user.id,
    })),
  };
}

function pushLog(state, entry) {
  if (!entry) return state;
  const full = { id: ++logId, timestamp: Date.now(), ...entry };
  return {
    ...state,
    actionLog: [full, ...(state.actionLog ?? [])],
  };
}

function rightOf(index, length) {
  return (index - 1 + length) % length;
}

function walkLeft(players, fromIndex, predicate, includeStart = false) {
  const len = players.length;
  for (let step = includeStart ? 0 : 1; step <= len; step += 1) {
    const idx = (fromIndex + step) % len;
    if (predicate(players[idx], idx)) return idx;
  }
  return -1;
}

function walkRight(players, fromIndex, predicate, includeStart = false) {
  const len = players.length;
  for (let step = includeStart ? 0 : 1; step <= len; step += 1) {
    const idx = (fromIndex - step + len) % len;
    if (predicate(players[idx], idx)) return idx;
  }
  return -1;
}

function isInHand(player) {
  return player.status === 'active' || player.status === 'allin';
}

function isActionable(player) {
  return player.status === 'active' && player.chips > 0;
}

export function getNextActivePlayer(players, fromIndex) {
  const idx = walkRight(players, fromIndex, (player) => player.chips > 0 || isInHand(player));
  return idx >= 0 ? idx : fromIndex;
}

function getNextDealer(players, previousDealerIndex, isFirstHand) {
  const predicate = (player) => player.chips > 0;
  const idx = isFirstHand
    ? walkRight(players, 0, predicate, true)
    : walkLeft(players, previousDealerIndex, predicate);
  return idx >= 0 ? idx : previousDealerIndex;
}

function getNextActionablePlayer(players, fromIndex) {
  return walkRight(players, fromIndex, isActionable);
}

function getFirstActionableFrom(players, fromIndex) {
  return walkRight(players, fromIndex, isActionable, true);
}

function activeContestants(players) {
  return players.filter(isInHand);
}

function actionableIndices(players) {
  return players
    .map((player, index) => (isActionable(player) ? index : -1))
    .filter((index) => index >= 0);
}

function resetPlayersForHand(players, dealerIndex, sbIndex, bbIndex) {
  return players.map((player, index) => ({
    ...player,
    holeCards: [],
    status: player.chips > 0 ? 'active' : 'folded',
    currentBet: 0,
    committed: 0,
    isDealer: index === dealerIndex,
    isSmallBlind: index === sbIndex,
    isBigBlind: index === bbIndex,
  }));
}

function markActed(round, index) {
  const acted = new Set(round.actedIndices);
  acted.add(index);
  return { ...round, actedIndices: [...acted] };
}

function resetActedAfterRaise(round, raiserIndex, minRaise) {
  return {
    ...round,
    actedIndices: [raiserIndex],
    minRaise,
    lastAggressorIndex: raiserIndex,
  };
}

function bettingRoundComplete(players, currentBet, round) {
  const indices = actionableIndices(players);
  if (indices.length === 0) return true;

  return indices.every((index) => {
    const player = players[index];
    const matched = player.currentBet >= currentBet;
    const acted = round.actedIndices.includes(index);
    return matched && acted;
  });
}

function applyBet(players, playerIndex, amount, pot) {
  const updated = [...players];
  const player = { ...updated[playerIndex] };
  const paid = Math.min(Math.max(0, amount), player.chips);
  player.chips -= paid;
  player.currentBet += paid;
  player.committed = (player.committed ?? 0) + paid;
  if (player.status === 'active' && player.chips === 0) player.status = 'allin';
  updated[playerIndex] = player;
  return { players: updated, pot: pot + paid, paid };
}

function postBlind(state, playerIndex, amount, label) {
  const player = state.players[playerIndex];
  const result = applyBet(state.players, playerIndex, amount, state.pot);
  return pushLog(
    {
      ...state,
      players: result.players,
      pot: result.pot,
      currentBet: Math.max(state.currentBet, result.players[playerIndex].currentBet),
    },
    { type: 'blind', playerName: player.name, text: label, amount: result.paid },
  );
}

function dealHoleCards(players, deck, sbIndex) {
  const dealt = players.map((player) => ({ ...player, holeCards: [] }));
  let remainingDeck = deck;
  let seat = sbIndex;

  for (let cardRound = 0; cardRound < 2; cardRound += 1) {
    for (let count = 0; count < players.length; count += 1) {
      if (dealt[seat].status === 'active') {
        const draw = drawCards(remainingDeck, 1);
        dealt[seat] = { ...dealt[seat], holeCards: [...dealt[seat].holeCards, draw.drawn[0]] };
        remainingDeck = draw.remaining;
      }
      seat = rightOf(seat, players.length);
    }
  }

  return { players: dealt, deck: remainingDeck };
}

function toSolverCard(card) {
  const rank = card.rank === '10' ? 'T' : card.rank;
  return `${rank}${SUIT_TO_SOLVER[card.suit] ?? 's'}`;
}

function solvePlayerHand(player, communityCards) {
  return Hand.solve([...player.holeCards, ...communityCards].map(toSolverCard));
}

function pickWinners(eligiblePlayers, communityCards) {
  const solved = eligiblePlayers
    .filter((player) => isInHand(player) && player.holeCards.length === 2)
    .map((player) => ({ player, hand: solvePlayerHand(player, communityCards) }));

  if (solved.length === 0) return { winners: [], description: 'Nessuna mano valida' };

  const winningHands = Hand.winners(solved.map((entry) => entry.hand));
  const winners = solved.filter((entry) => winningHands.includes(entry.hand));
  return {
    winners,
    description: winners[0]?.hand?.descr ?? winners[0]?.hand?.name ?? 'Mano vincente',
  };
}

function settlePots(players, communityCards) {
  const updated = players.map((player) => ({ ...player }));
  const awards = new Map(updated.map((player) => [player.id, 0]));
  const levels = [...new Set(updated.map((player) => player.committed ?? 0).filter((n) => n > 0))]
    .sort((a, b) => a - b);
  const sidePots = [];
  let previous = 0;
  let description = 'Mano vincente';

  for (const level of levels) {
    const contributors = updated.filter((player) => (player.committed ?? 0) >= level);
    const amount = (level - previous) * contributors.length;
    previous = level;
    if (amount <= 0) continue;

    const eligible = contributors.filter(isInHand);
    const result = pickWinners(eligible, communityCards);
    if (result.winners.length === 0) continue;

    description = result.description;
    const share = Math.floor(amount / result.winners.length);
    let remainder = amount - share * result.winners.length;
    const winnerNames = [];

    for (const { player } of result.winners) {
      const target = updated.find((p) => p.id === player.id);
      if (!target) continue;
      const payout = share + (remainder > 0 ? 1 : 0);
      target.chips += payout;
      awards.set(target.id, (awards.get(target.id) ?? 0) + payout);
      winnerNames.push(target.name);
      remainder = Math.max(0, remainder - 1);
    }

    sidePots.push({ amount, winnerNames, description: result.description });
  }

  const winningIds = [...awards.entries()]
    .filter(([, amount]) => amount > 0)
    .map(([id]) => id);
  const winnerSet = new Set(winningIds);

  return {
    players: updated.map((player) => (
      winnerSet.has(player.id) ? { ...player, status: 'winner' } : player
    )),
    winnerIds: winningIds,
    winnerNames: updated.filter((player) => winnerSet.has(player.id)).map((player) => player.name),
    description,
    sidePots,
    totalAward: [...awards.values()].reduce((sum, amount) => sum + amount, 0),
  };
}

function finishShowdown(state) {
  const result = settlePots(state.players, state.communityCards);
  const winnerName = result.winnerNames.join(', ') || '?';
  const isSplit = result.winnerIds.length > 1;

  return pushLog(
    {
      ...state,
      phase: PHASES.SHOWDOWN,
      players: result.players,
      winnerId: result.winnerIds[0] ?? null,
      pot: 0,
      currentBet: 0,
      sidePots: result.sidePots,
      bettingRound: emptyBettingRound(state.bigBlind),
    },
    {
      type: 'win',
      playerName: winnerName,
      winnerIds: result.winnerIds,
      text: isSplit
        ? `split pot - ${result.description}`
        : `vince allo showdown - ${result.description}`,
      amount: result.totalAward,
    },
  );
}

function resetStreetBets(players) {
  return players.map((player) => ({ ...player, currentBet: 0 }));
}

function drawCommunity(state, count, label) {
  const draw = drawCards(state.deck, count);
  return pushLog(
    {
      ...state,
      deck: draw.remaining,
      communityCards: [...state.communityCards, ...draw.drawn],
    },
    { type: 'phase', text: label },
  );
}

function nextStreet(state) {
  const phaseMap = {
    [PHASES.PREFLOP]: PHASES.FLOP,
    [PHASES.FLOP]: PHASES.TURN,
    [PHASES.TURN]: PHASES.RIVER,
  };

  if (state.phase === PHASES.RIVER) return finishShowdown(state);

  let next = state;
  if (state.phase === PHASES.PREFLOP) {
    next = drawCommunity(state, 3, 'Flop - 3 carte comuni');
  } else if (state.phase === PHASES.FLOP) {
    next = drawCommunity(state, 1, 'Turn - quarta carta comune');
  } else if (state.phase === PHASES.TURN) {
    next = drawCommunity(state, 1, 'River - quinta carta comune');
  }

  const players = resetStreetBets(next.players);
  const first = getFirstActionableFrom(players, next.smallBlindIndex);
  const nextState = {
    ...next,
    phase: phaseMap[state.phase] ?? state.phase,
    players,
    currentBet: 0,
    activePlayerIndex: first >= 0 ? first : 0,
    bettingRound: emptyBettingRound(state.bigBlind),
  };

  if (actionableIndices(nextState.players).length <= 1) {
    return nextStreet(nextState);
  }

  return nextState;
}

function archiveCurrentHand(state) {
  if (state.handNumber <= 0) return state.handHistory ?? [];
  const currentSummary = state.handHistory?.[0] ?? { handNumber: state.handNumber };
  return [
    { ...currentSummary, actions: state.actionLog ?? [] },
    ...(state.handHistory ?? []).slice(1),
  ];
}

export function dealHand(state) {
  const activeSeats = state.players.filter((player) => player.chips > 0).length;
  if (activeSeats < 2) {
    return pushLog(state, { type: 'info', text: 'Servono almeno 2 giocatori con chips per iniziare' });
  }

  const dealerIndex = getNextDealer(state.players, state.dealerIndex, state.handNumber === 0);
  const sbIndex = getNextActivePlayer(state.players, dealerIndex);
  const bbIndex = getNextActivePlayer(state.players, sbIndex);

  let deck = shuffleDeck(createDeck());
  let players = resetPlayersForHand(state.players, dealerIndex, sbIndex, bbIndex);
  const dealt = dealHoleCards(players, deck, sbIndex);
  players = dealt.players;
  deck = dealt.deck;
  const firstToAct = getNextActionablePlayer(players, bbIndex);

  let next = {
    ...state,
    phase: PHASES.PREFLOP,
    players,
    communityCards: [],
    deck,
    pot: 0,
    currentBet: 0,
    activePlayerIndex: firstToAct >= 0 ? firstToAct : bbIndex,
    actionLog: [],
    dealerIndex,
    smallBlindIndex: sbIndex,
    bigBlindIndex: bbIndex,
    winnerId: null,
    handNumber: state.handNumber + 1,
    handHistory: [
      {
        handNumber: state.handNumber + 1,
        dealerName: players[dealerIndex]?.name ?? '?',
        smallBlindName: players[sbIndex]?.name ?? '?',
        bigBlindName: players[bbIndex]?.name ?? '?',
        timestamp: Date.now(),
      },
      ...archiveCurrentHand(state),
    ],
    bettingRound: emptyBettingRound(state.bigBlind),
  };

  next = postBlind(next, sbIndex, state.smallBlind, `small blind (${state.smallBlind})`);
  next = postBlind(next, bbIndex, state.bigBlind, `big blind (${state.bigBlind})`);

  const firstPlayer = next.players[next.activePlayerIndex];
  return pushLog(next, {
    type: 'info',
    text: firstPlayer ? `${firstPlayer.name}, prima azione pre-flop` : 'Nuova mano - preflop',
  });
}

function finishIfOnlyOneCanWin(state) {
  const contestants = activeContestants(state.players);
  if (contestants.length !== 1) return null;
  const winner = contestants[0];
  return pushLog(
    {
      ...state,
      players: state.players.map((player) => (
        player.id === winner.id
          ? { ...player, chips: player.chips + state.pot, status: 'winner' }
          : player
      )),
      pot: 0,
      currentBet: 0,
      phase: PHASES.SHOWDOWN,
      winnerId: winner.id,
      bettingRound: emptyBettingRound(state.bigBlind),
    },
    {
      type: 'win',
      playerName: winner.name,
      winnerIds: [winner.id],
      text: 'vince - tutti fold',
      amount: state.pot,
    },
  );
}

export function playerAction(state, action, options = {}) {
  if (state.phase === PHASES.IDLE || state.phase === PHASES.SHOWDOWN) return state;

  const actorIndex = state.activePlayerIndex;
  const actor = state.players[actorIndex];
  if (!actor || !isActionable(actor)) return state;

  let players = [...state.players];
  let pot = state.pot;
  let currentBet = state.currentBet;
  let round = state.bettingRound ?? emptyBettingRound(state.bigBlind);
  let logEntry = null;
  const toCall = Math.max(0, currentBet - actor.currentBet);
  const minRaise = round.minRaise ?? state.bigBlind;

  if (action === 'fold') {
    players[actorIndex] = { ...actor, status: 'folded' };
    round = markActed(round, actorIndex);
    logEntry = { type: 'fold', playerName: actor.name, text: 'fold' };
  } else if (action === 'check') {
    if (toCall > 0) {
      return pushLog(state, { type: 'info', text: 'Non puoi check: devi call, raise o fold' });
    }
    round = markActed(round, actorIndex);
    logEntry = { type: 'check', playerName: actor.name, text: 'check' };
  } else if (action === 'call') {
    const result = applyBet(players, actorIndex, toCall, pot);
    players = result.players;
    pot = result.pot;
    round = markActed(round, actorIndex);
    logEntry = {
      type: toCall > 0 ? 'call' : 'check',
      playerName: actor.name,
      text: result.players[actorIndex].status === 'allin' && result.paid > 0 ? 'call all-in' : (toCall > 0 ? 'call' : 'check'),
      amount: result.paid,
    };
  } else if (action === 'raise' || action === 'allin') {
    const wantedRaise = action === 'allin'
      ? actor.chips - toCall
      : Math.max(minRaise, options.betAmount ?? minRaise);
    const result = applyBet(players, actorIndex, toCall + Math.max(0, wantedRaise), pot);
    players = result.players;
    pot = result.pot;

    const newActorBet = players[actorIndex].currentBet;
    const actualRaise = Math.max(0, newActorBet - currentBet);
    currentBet = Math.max(currentBet, newActorBet);

    if (actualRaise >= minRaise) {
      round = resetActedAfterRaise(round, actorIndex, actualRaise);
    } else {
      round = markActed(round, actorIndex);
    }

    logEntry = {
      type: 'raise',
      playerName: actor.name,
      text: players[actorIndex].status === 'allin' ? `all-in a ${newActorBet}` : `raise a ${newActorBet}`,
      amount: result.paid,
    };
  }

  let next = pushLog(
    { ...state, players, pot, currentBet, bettingRound: round },
    logEntry,
  );

  const foldedWin = finishIfOnlyOneCanWin(next);
  if (foldedWin) return foldedWin;

  if (bettingRoundComplete(players, currentBet, round)) {
    return nextStreet(next);
  }

  const nextIndex = getNextActionablePlayer(players, actorIndex);
  return {
    ...next,
    activePlayerIndex: nextIndex >= 0 ? nextIndex : actorIndex,
  };
}

export function getRandomBotAction(state) {
  const { players, activePlayerIndex, currentBet, bigBlind } = state;
  const actor = players[activePlayerIndex];
  const toCall = Math.max(0, currentBet - actor.currentBet);
  const canCheck = toCall === 0;
  const canRaise = actor.chips > toCall + bigBlind;
  const actions = canCheck
    ? ['check', ...(canRaise ? ['raise'] : []), 'fold']
    : ['call', ...(canRaise ? ['raise'] : []), 'fold'];
  const weights = canCheck
    ? [0.62, ...(canRaise ? [0.25] : []), 0.13]
    : [0.68, ...(canRaise ? [0.2] : []), 0.12];

  const r = Math.random();
  let acc = 0;
  let picked = actions[0];
  for (let i = 0; i < actions.length; i += 1) {
    acc += weights[i];
    if (r < acc) {
      picked = actions[i];
      break;
    }
  }

  const chipPick = CHIP_VALUES[Math.floor(Math.random() * CHIP_VALUES.length)];
  return { action: picked, betAmount: Math.max(bigBlind, chipPick) };
}

export function getPhaseLabel(phase) {
  const labels = {
    [PHASES.IDLE]: 'In attesa',
    [PHASES.PREFLOP]: 'Preflop',
    [PHASES.FLOP]: 'Flop',
    [PHASES.TURN]: 'Turn',
    [PHASES.RIVER]: 'River',
    [PHASES.SHOWDOWN]: 'Showdown',
  };
  return labels[phase] ?? phase;
}

export function getHumanPlayer(state) {
  return state.players.find((player) => player.isHuman);
}

export function syncHumanChipsInState(state, chips) {
  return {
    ...state,
    players: state.players.map((player) => (player.isHuman ? { ...player, chips } : player)),
  };
}
