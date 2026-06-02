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
export const CHIP_VALUES = [5, 10, 25, 50, 100, 250, 500];

const BOT_NAMES = ['Alex', 'Mia', 'Leo', 'Sara', 'Max', 'Eva'];
const SUIT_TO_SOLVER = {
  '\u2660': 's',
  '\u2665': 'h',
  '\u2666': 'd',
  '\u2663': 'c',
};

let logId = 0;

function emptyBettingRound(bigBlind = BIG_BLIND) {
  return { actedIndices: [], lastRaiseIndex: -1, minRaise: bigBlind };
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
    actionLog: [],
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
    isHuman: true,
    isBot: false,
  }];

  for (let i = 1; i < count; i += 1) {
    roster.push({
      userId: null,
      nametag: BOT_NAMES[i - 1] ?? `Bot ${i}`,
      isHuman: false,
      isBot: true,
    });
  }

  return createGameFromRoster(roster, humanProfile);
}

export function createGameFromRoster(roster, humanProfile = null) {
  const humanChips = humanProfile?.chips ?? 10_000;
  const players = roster.map((seat, i) => ({
    id: i,
    userId: seat.userId,
    name: seat.nametag,
    holeCards: [],
    status: 'waiting',
    chips: seat.isHuman ? humanChips : 10_000,
    currentBet: 0,
    committed: 0,
    isHuman: !!seat.isHuman,
    isBot: !!seat.isBot,
  }));

  return baseTableState(players);
}

function pushLog(state, entry) {
  const full = { id: ++logId, timestamp: Date.now(), ...entry };
  return {
    ...state,
    actionLog: [full, ...(state.actionLog ?? [])].slice(0, 20),
  };
}

function resetPlayersForHand(players, dealerIndex) {
  return players.map((p, i) => ({
    ...p,
    holeCards: [],
    status: p.chips > 0 ? 'active' : 'folded',
    currentBet: 0,
    committed: 0,
    isDealer: i === dealerIndex,
  }));
}

function toSolverCard(card) {
  const rank = card.rank === '10' ? 'T' : card.rank;
  return `${rank}${SUIT_TO_SOLVER[card.suit] ?? 's'}`;
}

function solvePlayerHand(player, communityCards) {
  return Hand.solve([...player.holeCards, ...communityCards].map(toSolverCard));
}

function evaluateWinners(players, communityCards) {
  const solved = players
    .filter((p) => p.status === 'active' && p.holeCards.length === 2)
    .map((player) => ({ player, hand: solvePlayerHand(player, communityCards) }));

  if (solved.length === 0) return { winners: [], description: 'Nessuna mano valida' };

  const winningHands = Hand.winners(solved.map((entry) => entry.hand));
  const winners = solved.filter((entry) => winningHands.includes(entry.hand));
  return {
    winners,
    description: winners[0]?.hand?.descr ?? winners[0]?.hand?.name ?? 'Mano vincente',
  };
}

export function getNextActivePlayer(players, fromIndex) {
  const len = players.length;
  for (let step = 1; step <= len; step += 1) {
    const idx = (fromIndex + step) % len;
    if (players[idx].status === 'active') return idx;
  }
  return fromIndex;
}

function getNextActionablePlayer(players, fromIndex) {
  const len = players.length;
  for (let step = 1; step <= len; step += 1) {
    const idx = (fromIndex + step) % len;
    if (players[idx].status === 'active' && players[idx].chips > 0) return idx;
  }
  return -1;
}

function getFirstPostflopPlayer(players, dealerIndex) {
  const actionable = getNextActionablePlayer(players, dealerIndex);
  return actionable >= 0 ? actionable : getNextActivePlayer(players, dealerIndex);
}

function getActionableIndices(players) {
  return players
    .map((p, i) => (p.status === 'active' && p.chips > 0 ? i : -1))
    .filter((i) => i >= 0);
}

function allActiveMatched(players, currentBet) {
  return players
    .filter((p) => p.status === 'active')
    .every((p) => p.currentBet >= currentBet || p.chips === 0);
}

function markActed(bettingRound, playerIndex) {
  const acted = new Set(bettingRound.actedIndices);
  acted.add(playerIndex);
  return { ...bettingRound, actedIndices: [...acted] };
}

function resetActedAfterRaise(bettingRound, raiserIndex, minRaise) {
  return { ...bettingRound, actedIndices: [raiserIndex], lastRaiseIndex: raiserIndex, minRaise };
}

function isBettingRoundComplete(players, currentBet, bettingRound) {
  const actionable = getActionableIndices(players);
  if (!allActiveMatched(players, currentBet)) return false;
  if (actionable.length === 0) return true;
  return actionable.every((i) => bettingRound.actedIndices.includes(i));
}

function applyBet(players, playerIndex, amount, pot) {
  const updated = [...players];
  const p = { ...updated[playerIndex] };
  const toPay = Math.min(Math.max(0, amount), p.chips);
  p.chips -= toPay;
  p.currentBet += toPay;
  p.committed = (p.committed ?? 0) + toPay;
  updated[playerIndex] = p;
  return { players: updated, pot: pot + toPay, added: toPay };
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
    { type: 'blind', playerName: player.name, text: label, amount: result.added },
  );
}

function burn(deck) {
  return drawCards(deck, 1).remaining;
}

function settleShowdown(players, communityCards) {
  const updatedPlayers = players.map((p) => ({ ...p }));
  const awards = new Map(updatedPlayers.map((p) => [p.id, 0]));
  const levels = [...new Set(updatedPlayers.map((p) => p.committed ?? 0).filter((n) => n > 0))]
    .sort((a, b) => a - b);

  let previous = 0;
  let description = 'Mano vincente';
  const potResults = [];

  for (const level of levels) {
    const contributors = updatedPlayers.filter((p) => (p.committed ?? 0) >= level);
    const potAmount = (level - previous) * contributors.length;
    previous = level;
    if (potAmount <= 0) continue;

    const eligible = contributors.filter((p) => p.status === 'active');
    const result = evaluateWinners(eligible, communityCards);
    if (result.winners.length === 0) continue;

    description = result.description;
    const share = Math.floor(potAmount / result.winners.length);
    let remainder = potAmount - share * result.winners.length;
    const potWinnerNames = [];

    for (const { player } of result.winners) {
      const target = updatedPlayers.find((p) => p.id === player.id);
      if (!target) continue;
      const payout = share + (remainder > 0 ? 1 : 0);
      target.chips += payout;
      awards.set(target.id, (awards.get(target.id) ?? 0) + payout);
      potWinnerNames.push(target.name);
      remainder = Math.max(0, remainder - 1);
    }

    potResults.push({ amount: potAmount, winnerNames: potWinnerNames, description: result.description });
  }

  const awardEntries = [...awards.entries()].filter(([, amount]) => amount > 0);
  const topAward = awardEntries.reduce((max, [, amount]) => Math.max(max, amount), 0);
  const winnerIds = awardEntries
    .filter(([, amount]) => amount === topAward)
    .map(([id]) => id);
  const winnerSet = new Set(winnerIds);
  const finalPlayers = updatedPlayers.map((p) => (
    winnerSet.has(p.id) ? { ...p, status: 'winner' } : p
  ));

  return {
    players: finalPlayers,
    winnerIds,
    winnerNames: finalPlayers.filter((p) => winnerSet.has(p.id)).map((p) => p.name),
    description,
    potResults,
  };
}

function finishShowdown(state, deck, communityCards) {
  const result = settleShowdown(state.players, communityCards);
  const winnerName = result.winnerNames.join(', ') || '?';
  const isSplit = result.winnerIds.length > 1;

  return pushLog(
    {
      ...state,
      phase: PHASES.SHOWDOWN,
      deck,
      communityCards,
      players: result.players,
      winnerId: result.winnerIds[0] ?? null,
      pot: 0,
      currentBet: 0,
      bettingRound: emptyBettingRound(state.bigBlind),
    },
    {
      type: 'win',
      playerName: winnerName,
      text: isSplit
        ? `split pot - ${result.description}`
        : `vince allo showdown - ${result.description}`,
      amount: state.pot,
    },
  );
}

function advancePhase(state) {
  const { phase, players } = state;
  let newDeck = [...state.deck];
  let communityCards = [...state.communityCards];
  let next = state;

  if (phase === PHASES.PREFLOP) {
    const flop = drawCards(burn(newDeck), 3);
    newDeck = flop.remaining;
    communityCards = flop.drawn;
    next = pushLog(state, { type: 'phase', text: 'Flop - 3 carte sul board' });
  } else if (phase === PHASES.FLOP) {
    const turn = drawCards(burn(newDeck), 1);
    newDeck = turn.remaining;
    communityCards = [...communityCards, ...turn.drawn];
    next = pushLog(state, { type: 'phase', text: 'Turn - quarta carta' });
  } else if (phase === PHASES.TURN) {
    const river = drawCards(burn(newDeck), 1);
    newDeck = river.remaining;
    communityCards = [...communityCards, ...river.drawn];
    next = pushLog(state, { type: 'phase', text: 'River - quinta carta' });
  } else if (phase === PHASES.RIVER) {
    return finishShowdown(state, newDeck, communityCards);
  }

  const phaseMap = {
    [PHASES.PREFLOP]: PHASES.FLOP,
    [PHASES.FLOP]: PHASES.TURN,
    [PHASES.TURN]: PHASES.RIVER,
  };
  const resetBets = players.map((p) => ({ ...p, currentBet: 0 }));
  const firstActive = getFirstPostflopPlayer(resetBets, state.dealerIndex);

  const nextState = {
    ...next,
    phase: phaseMap[phase] ?? phase,
    deck: newDeck,
    communityCards,
    players: resetBets,
    currentBet: 0,
    activePlayerIndex: firstActive >= 0 ? firstActive : 0,
    bettingRound: emptyBettingRound(state.bigBlind),
  };

  if (getActionableIndices(nextState.players).length <= 1) {
    return advancePhase(nextState);
  }

  return nextState;
}

export function dealHand(state) {
  const playerCount = state.players.length;
  const dealerIndex = (state.dealerIndex + 1) % playerCount;
  let deck = shuffleDeck(createDeck());
  const holeDraw = drawCards(deck, playerCount * 2);
  deck = holeDraw.remaining;

  const players = resetPlayersForHand(state.players, dealerIndex).map((p, i) => ({
    ...p,
    holeCards: [holeDraw.drawn[i * 2], holeDraw.drawn[i * 2 + 1]],
  }));

  const sbIndex = getNextActivePlayer(players, dealerIndex);
  const bbIndex = getNextActivePlayer(players, sbIndex);
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
    dealerIndex,
    winnerId: null,
    handNumber: state.handNumber + 1,
    bettingRound: emptyBettingRound(state.bigBlind),
  };

  next = postBlind(next, sbIndex, state.smallBlind, `small blind (${state.smallBlind})`);
  next = postBlind(next, bbIndex, state.bigBlind, `big blind (${state.bigBlind})`);

  const human = next.players.find((p) => p.isHuman);
  return pushLog(next, {
    type: 'info',
    text: human ? `${human.name}, a te la prima azione` : 'Nuova mano - preflop',
  });
}

export function playerAction(state, action, options = {}) {
  if (state.phase === PHASES.IDLE || state.phase === PHASES.SHOWDOWN) return state;

  const { activePlayerIndex, players, currentBet, pot } = state;
  const active = players[activePlayerIndex];
  if (!active || active.status !== 'active' || active.chips === 0) return state;

  const minRaise = state.bettingRound?.minRaise ?? state.bigBlind;
  const requestedRaise = Math.max(minRaise, options.betAmount ?? minRaise);
  let updatedPlayers = [...players];
  let newPot = pot;
  let newCurrentBet = currentBet;
  let bettingRound = state.bettingRound ?? emptyBettingRound(state.bigBlind);
  let logEntry = null;

  if (action === 'fold') {
    updatedPlayers[activePlayerIndex] = { ...active, status: 'folded' };
    bettingRound = markActed(bettingRound, activePlayerIndex);
    logEntry = { type: 'fold', playerName: active.name, text: 'ha fatto fold' };
  } else if (action === 'check') {
    if (active.currentBet < currentBet) {
      return pushLog(state, { type: 'info', text: 'Non puoi check - call o fold' });
    }
    bettingRound = markActed(bettingRound, activePlayerIndex);
    logEntry = { type: 'check', playerName: active.name, text: 'check' };
  } else if (action === 'call') {
    const toCall = Math.max(0, currentBet - active.currentBet);
    const result = applyBet(updatedPlayers, activePlayerIndex, toCall, newPot);
    updatedPlayers = result.players;
    newPot = result.pot;
    bettingRound = markActed(bettingRound, activePlayerIndex);
    logEntry = {
      type: toCall > 0 ? 'call' : 'check',
      playerName: active.name,
      text: toCall > 0 && result.players[activePlayerIndex].chips === 0 ? 'call all-in' : (toCall > 0 ? 'call' : 'check'),
      amount: result.added,
    };
  } else if (action === 'raise') {
    const toCall = Math.max(0, currentBet - active.currentBet);
    if (active.chips <= toCall) {
      return pushLog(state, { type: 'info', text: 'Chips insufficienti per rilanciare: call all-in o fold' });
    }

    const result = applyBet(updatedPlayers, activePlayerIndex, toCall + requestedRaise, newPot);
    updatedPlayers = result.players;
    newPot = result.pot;
    newCurrentBet = updatedPlayers[activePlayerIndex].currentBet;

    const actualRaise = Math.max(0, newCurrentBet - currentBet);
    bettingRound = resetActedAfterRaise(
      bettingRound,
      activePlayerIndex,
      actualRaise >= minRaise ? actualRaise : minRaise,
    );
    logEntry = {
      type: 'raise',
      playerName: active.name,
      text: updatedPlayers[activePlayerIndex].chips === 0 ? `all-in a ${newCurrentBet}` : `raise a ${newCurrentBet}`,
      amount: result.added,
    };
  }

  let next = pushLog(
    { ...state, players: updatedPlayers, pot: newPot, currentBet: newCurrentBet, bettingRound },
    logEntry,
  );

  const remainingActive = updatedPlayers.filter((p) => p.status === 'active');
  if (remainingActive.length === 1) {
    const winner = remainingActive[0];
    const potWon = newPot;
    const finalPlayers = updatedPlayers.map((p) =>
      p.id === winner.id ? { ...p, status: 'winner', chips: p.chips + potWon } : p,
    );
    return pushLog(
      {
        ...next,
        players: finalPlayers,
        pot: 0,
        phase: PHASES.SHOWDOWN,
        winnerId: winner.id,
        currentBet: 0,
        bettingRound: emptyBettingRound(state.bigBlind),
      },
      { type: 'win', playerName: winner.name, text: 'vince - tutti fold', amount: potWon },
    );
  }

  if (isBettingRoundComplete(updatedPlayers, newCurrentBet, bettingRound)) {
    return advancePhase({
      ...next,
      players: updatedPlayers,
      pot: newPot,
      currentBet: newCurrentBet,
      bettingRound,
    });
  }

  const nextIndex = getNextActionablePlayer(updatedPlayers, activePlayerIndex);
  return {
    ...next,
    players: updatedPlayers,
    pot: newPot,
    currentBet: newCurrentBet,
    activePlayerIndex: nextIndex >= 0 ? nextIndex : activePlayerIndex,
    bettingRound,
  };
}

export function getRandomBotAction(state) {
  const { players, activePlayerIndex, currentBet, bigBlind } = state;
  const active = players[activePlayerIndex];
  const toCall = Math.max(0, currentBet - active.currentBet);
  const canCheck = toCall === 0;
  const canRaise = active.chips > toCall + bigBlind;
  const actions = canCheck
    ? ['check', ...(canRaise ? ['raise'] : []), 'fold']
    : ['call', ...(canRaise ? ['raise'] : []), 'fold'];
  const weights = canCheck
    ? [0.58, ...(canRaise ? [0.27] : []), 0.15]
    : [0.68, ...(canRaise ? [0.22] : []), 0.1];

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
  return state.players.find((p) => p.isHuman);
}

export function syncHumanChipsInState(state, chips) {
  return {
    ...state,
    players: state.players.map((p) => (p.isHuman ? { ...p, chips } : p)),
  };
}
