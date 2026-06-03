import PokerSolver from 'pokersolver';

const { Hand } = PokerSolver;

export const PHASES = {
  IDLE: 'idle',
  PREFLOP: 'preflop',
  FLOP: 'flop',
  TURN: 'turn',
  RIVER: 'river',
  SHOWDOWN: 'showdown',
};

export const BIG_BLIND = 20;
export const SMALL_BLIND = Math.floor(BIG_BLIND / 2);
export const CHIP_VALUES = [20, 50, 100, 200, 500, 1000];

const BOT_NAMES = ['Alex', 'Mia', 'Leo', 'Sara', 'Max', 'Eva'];
const SUITS = ['\u2660', '\u2665', '\u2666', '\u2663'];
const RANKS = [
  { rank: '2', value: 2 },
  { rank: '3', value: 3 },
  { rank: '4', value: 4 },
  { rank: '5', value: 5 },
  { rank: '6', value: 6 },
  { rank: '7', value: 7 },
  { rank: '8', value: 8 },
  { rank: '9', value: 9 },
  { rank: '10', value: 10 },
  { rank: 'J', value: 11 },
  { rank: 'Q', value: 12 },
  { rank: 'K', value: 13 },
  { rank: 'A', value: 14 },
];
const SUIT_TO_SOLVER = {
  '\u2660': 's',
  '\u2665': 'h',
  '\u2666': 'd',
  '\u2663': 'c',
};

let logId = 0;

export function nextIndex(index, count) {
  return (index + 1) % count;
}

export function prevIndex(index, count) {
  return (index - 1 + count) % count;
}

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const { rank, value } of RANKS) {
      deck.push({
        id: `${rank}${suit}`,
        suit,
        rank,
        value,
        label: `${rank}${suit}`,
        color: suit === '\u2665' || suit === '\u2666' ? 'red' : 'black',
      });
    }
  }
  return deck;
}

function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function drawOne(deck) {
  return deck.pop();
}

function playerStatus(player) {
  if (player.status === 'winner') return 'winner';
  if (!player.isActive) return 'folded';
  if (player.isAllIn) return 'allin';
  return player.chips > 0 ? 'active' : 'waiting';
}

function normalizePlayer(player) {
  const role = player.role ?? null;
  return {
    ...player,
    role,
    status: playerStatus(player),
    committed: player.totalBetThisHand ?? player.committed ?? 0,
    isDealer: role === 'dealer',
    isSmallBlind: role === 'sb',
    isBigBlind: role === 'bb',
  };
}

function normalizeState(state) {
  return {
    ...state,
    phase: state.stage,
    activePlayerIndex: state.actionIndex,
    bettingRound: {
      actedIndices: state.actedThisRound ?? [],
      minRaise: state.minRaise,
      lastAggressorIndex: state.lastAggressorIndex ?? -1,
    },
    players: state.players.map(normalizePlayer),
  };
}

function makePlayer(seat, index, humanProfile) {
  const isBot = !!seat.isBot;
  const isHuman = !!seat.isHuman;
  return normalizePlayer({
    id: index,
    userId: seat.userId,
    name: seat.nametag ?? `Player ${index + 1}`,
    chips: isBot ? 10_000 : (seat.chips ?? (isHuman ? humanProfile?.chips ?? 0 : 0)),
    holeCards: [],
    currentBet: 0,
    totalBetThisHand: 0,
    isActive: false,
    isAllIn: false,
    isHuman,
    isBot,
    role: null,
  });
}

function baseState(players) {
  return normalizeState({
    players,
    dealerIndex: -1,
    sbIndex: -1,
    bbIndex: -1,
    smallBlindIndex: -1,
    bigBlindIndex: -1,
    deck: [],
    communityCards: [],
    burnedCards: [],
    pot: 0,
    sidePots: [],
    currentBet: 0,
    stage: PHASES.IDLE,
    actionIndex: 0,
    bigBlind: BIG_BLIND,
    smallBlind: SMALL_BLIND,
    minRaise: BIG_BLIND,
    lastRaiseAmount: BIG_BLIND,
    lastAggressorIndex: -1,
    actedThisRound: [],
    bbHasOption: false,
    handNumber: 0,
    actionLog: [],
    handHistory: [],
    winnerId: null,
  });
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
  return baseState(roster.map((seat, index) => makePlayer(seat, index, humanProfile)));
}

export function withHumanPerspective(state, user) {
  if (!state || !user) return state;
  return normalizeState({
    ...state,
    players: state.players.map((player) => ({
      ...player,
      isHuman: !player.isBot && player.userId === user.id,
    })),
  });
}

function pushLog(state, entry) {
  if (!entry) return normalizeState(state);
  return normalizeState({
    ...state,
    actionLog: [{ id: ++logId, timestamp: Date.now(), ...entry }, ...(state.actionLog ?? [])],
  });
}

function findNextSeat(players, fromIndex, predicate, includeStart = false) {
  const count = players.length;
  for (let step = includeStart ? 0 : 1; step <= count; step += 1) {
    const index = (fromIndex + step) % count;
    if (predicate(players[index], index)) return index;
  }
  return -1;
}

function isContestant(player) {
  return player.isActive || player.isAllIn;
}

function isActionable(player) {
  return player.isActive && !player.isAllIn && player.chips > 0;
}

export function getNextActivePlayer(players, fromIndex) {
  const index = findNextSeat(players, fromIndex, (player) => isContestant(player));
  return index >= 0 ? index : fromIndex;
}

function firstActionableFrom(players, fromIndex, includeStart = false) {
  return findNextSeat(players, fromIndex, isActionable, includeStart);
}

function archiveCurrentHand(state) {
  if (state.handNumber <= 0) return state.handHistory ?? [];
  const currentSummary = state.handHistory?.[0] ?? { handNumber: state.handNumber };
  return [
    { ...currentSummary, actions: state.actionLog ?? [] },
    ...(state.handHistory ?? []).slice(1),
  ];
}

function resetPlayersForHand(players, dealerIndex, sbIndex, bbIndex) {
  return players
    .filter((player) => player.chips > 0)
    .map((player, index) => normalizePlayer({
      ...player,
      id: index,
      holeCards: [],
      currentBet: 0,
      totalBetThisHand: 0,
      committed: 0,
      isActive: true,
      isAllIn: false,
      role: index === dealerIndex ? 'dealer' : index === sbIndex ? 'sb' : index === bbIndex ? 'bb' : null,
      status: undefined,
    }));
}

function postAmount(players, playerIndex, amount) {
  const updated = [...players];
  const player = { ...updated[playerIndex] };
  const paid = Math.min(Math.max(0, amount), player.chips);
  player.chips -= paid;
  player.currentBet += paid;
  player.totalBetThisHand += paid;
  player.committed = player.totalBetThisHand;
  if (player.chips === 0 && paid > 0) player.isAllIn = true;
  updated[playerIndex] = normalizePlayer(player);
  return { players: updated, paid };
}

function markActed(state, playerIndex) {
  const acted = new Set(state.actedThisRound ?? []);
  acted.add(playerIndex);
  return { ...state, actedThisRound: [...acted] };
}

function reopenRoundAfterAggression(state, aggressorIndex, raiseAmount) {
  return {
    ...state,
    actedThisRound: [aggressorIndex],
    minRaise: Math.max(state.bigBlind, raiseAmount),
    lastRaiseAmount: Math.max(raiseAmount, state.bigBlind),
    lastAggressorIndex: aggressorIndex,
    bbHasOption: false,
  };
}

function dealHoleCards(players, deck, sbIndex) {
  const dealt = players.map((player) => ({ ...player, holeCards: [] }));
  let seat = sbIndex;
  for (let round = 0; round < 2; round += 1) {
    for (let n = 0; n < dealt.length; n += 1) {
      if (dealt[seat].isActive) {
        dealt[seat] = normalizePlayer({
          ...dealt[seat],
          holeCards: [...dealt[seat].holeCards, drawOne(deck)],
        });
      }
      seat = nextIndex(seat, dealt.length);
    }
  }
  return dealt;
}

function contestants(players) {
  return players.filter(isContestant);
}

function bettingRoundComplete(state) {
  const actionable = state.players
    .map((player, index) => (isActionable(player) ? index : -1))
    .filter((index) => index >= 0);

  if (actionable.length === 0) return true;

  return actionable.every((index) => {
    const player = state.players[index];
    return player.currentBet >= state.currentBet && (state.actedThisRound ?? []).includes(index);
  });
}

function resetStreetBets(players) {
  return players.map((player) => normalizePlayer({ ...player, currentBet: 0 }));
}

function buildSidePots(players) {
  const levels = [...new Set(players.map((player) => player.totalBetThisHand).filter((n) => n > 0))]
    .sort((a, b) => a - b);
  const sidePots = [];
  let previous = 0;

  for (const level of levels) {
    const contributors = players.filter((player) => player.totalBetThisHand >= level);
    const amount = (level - previous) * contributors.length;
    previous = level;
    if (amount <= 0) continue;
    sidePots.push({
      amount,
      eligiblePlayerIds: contributors.filter(isContestant).map((player) => player.id),
    });
  }

  return sidePots;
}

function solverCard(card) {
  const rank = card.rank === '10' ? 'T' : card.rank;
  return `${rank}${SUIT_TO_SOLVER[card.suit]}`;
}

function solveHand(player, communityCards) {
  return Hand.solve([...player.holeCards, ...communityCards].map(solverCard));
}

function winnersForPot(players, eligibleIds, communityCards) {
  const solved = players
    .filter((player) => eligibleIds.includes(player.id) && isContestant(player) && player.holeCards.length === 2)
    .map((player) => ({ player, hand: solveHand(player, communityCards) }));

  if (solved.length === 0) return { winners: [], description: 'Nessuna mano valida' };
  const winningHands = Hand.winners(solved.map((entry) => entry.hand));
  const winners = solved.filter((entry) => winningHands.includes(entry.hand));
  return {
    winners,
    description: winners[0]?.hand?.descr ?? winners[0]?.hand?.name ?? 'Mano vincente',
  };
}

function finishShowdown(state) {
  const players = state.players.map((player) => ({ ...player }));
  const pots = buildSidePots(players);
  const awards = new Map(players.map((player) => [player.id, 0]));
  const potResults = [];
  let description = 'Mano vincente';

  for (const pot of pots) {
    const result = winnersForPot(players, pot.eligiblePlayerIds, state.communityCards);
    if (result.winners.length === 0) continue;
    description = result.description;
    const share = Math.floor(pot.amount / result.winners.length);
    let remainder = pot.amount - share * result.winners.length;
    const winnerNames = [];

    for (const { player } of result.winners) {
      const target = players.find((p) => p.id === player.id);
      const payout = share + (remainder > 0 ? 1 : 0);
      target.chips += payout;
      awards.set(target.id, (awards.get(target.id) ?? 0) + payout);
      winnerNames.push(target.name);
      remainder = Math.max(0, remainder - 1);
    }

    potResults.push({ ...pot, winnerNames, description: result.description });
  }

  const winnerIds = [...awards.entries()].filter(([, amount]) => amount > 0).map(([id]) => id);
  const winnerSet = new Set(winnerIds);
  const totalAward = [...awards.values()].reduce((sum, amount) => sum + amount, 0);
  const finalPlayers = players.map((player) => normalizePlayer({
    ...player,
    status: winnerSet.has(player.id) ? 'winner' : undefined,
  }));
  const winnerNames = finalPlayers.filter((player) => winnerSet.has(player.id)).map((player) => player.name);

  return pushLog({
    ...state,
    stage: PHASES.SHOWDOWN,
    phase: PHASES.SHOWDOWN,
    players: finalPlayers,
    pot: 0,
    sidePots: potResults,
    currentBet: 0,
    actionIndex: 0,
    activePlayerIndex: 0,
    winnerId: winnerIds[0] ?? null,
    actedThisRound: [],
  }, {
    type: 'win',
    playerName: winnerNames.join(', ') || '?',
    winnerIds,
    text: winnerIds.length > 1 ? `split pot - ${description}` : `vince allo showdown - ${description}`,
    amount: totalAward,
  });
}

function finishFoldWin(state) {
  const remaining = contestants(state.players);
  if (remaining.length !== 1) return null;
  const winner = remaining[0];
  const players = state.players.map((player) => normalizePlayer({
    ...player,
    chips: player.id === winner.id ? player.chips + state.pot : player.chips,
    status: player.id === winner.id ? 'winner' : undefined,
  }));

  return pushLog({
    ...state,
    stage: PHASES.SHOWDOWN,
    phase: PHASES.SHOWDOWN,
    players,
    pot: 0,
    sidePots: buildSidePots(state.players),
    currentBet: 0,
    actionIndex: 0,
    activePlayerIndex: 0,
    winnerId: winner.id,
    actedThisRound: [],
  }, {
    type: 'win',
    playerName: winner.name,
    winnerIds: [winner.id],
    text: 'vince - tutti fold',
    amount: state.pot,
  });
}

function burnCard(state) {
  const deck = [...state.deck];
  const burned = drawOne(deck);
  return {
    ...state,
    deck,
    burnedCards: burned ? [...(state.burnedCards ?? []), burned] : (state.burnedCards ?? []),
  };
}

function revealCommunity(state, count, label) {
  const next = burnCard(state);
  const deck = [...next.deck];
  const cards = [];
  for (let i = 0; i < count; i += 1) cards.push(drawOne(deck));
  return pushLog({
    ...next,
    deck,
    communityCards: [...next.communityCards, ...cards],
  }, { type: 'phase', text: label });
}

function advanceStage(state) {
  if (state.stage === PHASES.RIVER) return finishShowdown(state);

  let next = state;
  let stage = state.stage;
  if (state.stage === PHASES.PREFLOP) {
    next = revealCommunity(state, 3, 'Flop - 3 carte comuni');
    stage = PHASES.FLOP;
  } else if (state.stage === PHASES.FLOP) {
    next = revealCommunity(state, 1, 'Turn - quarta carta comune');
    stage = PHASES.TURN;
  } else if (state.stage === PHASES.TURN) {
    next = revealCommunity(state, 1, 'River - quinta carta comune');
    stage = PHASES.RIVER;
  }

  const players = resetStreetBets(next.players);
  const first = firstActionableFrom(players, next.sbIndex, true);
  const street = normalizeState({
    ...next,
    players,
    stage,
    currentBet: 0,
    minRaise: next.bigBlind,
    lastRaiseAmount: next.bigBlind,
    lastAggressorIndex: -1,
    actedThisRound: [],
    bbHasOption: false,
    actionIndex: first >= 0 ? first : 0,
  });

  if (players.filter(isActionable).length <= 1) return advanceStage(street);
  return street;
}

export function dealHand(state) {
  const seated = state.players.filter((player) => player.chips > 0);
  if (seated.length < 2) {
    return pushLog(state, { type: 'info', text: 'Servono almeno 2 giocatori con chips per iniziare' });
  }

  const previousDealerUserId = state.dealerIndex >= 0 ? state.players[state.dealerIndex]?.userId : null;
  const previousDealerName = state.dealerIndex >= 0 ? state.players[state.dealerIndex]?.name : null;
  const filtered = seated.map((player, index) => ({ ...player, id: index }));
  let dealerIndex = 0;

  if (state.handNumber > 0) {
    const previousIndex = filtered.findIndex((player) => (
      previousDealerUserId ? player.userId === previousDealerUserId : player.name === previousDealerName
    ));
    dealerIndex = previousIndex >= 0 ? nextIndex(previousIndex, filtered.length) : 0;
  }

  const sbIndex = nextIndex(dealerIndex, filtered.length);
  const bbIndex = nextIndex(sbIndex, filtered.length);
  const deck = shuffleDeck(createDeck());
  let players = resetPlayersForHand(filtered, dealerIndex, sbIndex, bbIndex);
  players = dealHoleCards(players, deck, sbIndex);

  let pot = 0;
  let result = postAmount(players, sbIndex, SMALL_BLIND);
  players = result.players;
  pot += result.paid;
  result = postAmount(players, bbIndex, BIG_BLIND);
  players = result.players;
  pot += result.paid;

  const firstToAct = firstActionableFrom(players, bbIndex);
  const handNumber = state.handNumber + 1;
  const next = normalizeState({
    ...state,
    players,
    dealerIndex,
    sbIndex,
    bbIndex,
    smallBlindIndex: sbIndex,
    bigBlindIndex: bbIndex,
    deck,
    communityCards: [],
    burnedCards: [],
    pot,
    sidePots: buildSidePots(players),
    currentBet: BIG_BLIND,
    stage: PHASES.PREFLOP,
    actionIndex: firstToAct >= 0 ? firstToAct : bbIndex,
    bigBlind: BIG_BLIND,
    smallBlind: SMALL_BLIND,
    minRaise: BIG_BLIND,
    lastRaiseAmount: BIG_BLIND,
    lastAggressorIndex: -1,
    actedThisRound: [],
    bbHasOption: true,
    handNumber,
    actionLog: [],
    handHistory: [
      {
        handNumber,
        dealerName: players[dealerIndex]?.name ?? '?',
        smallBlindName: players[sbIndex]?.name ?? '?',
        bigBlindName: players[bbIndex]?.name ?? '?',
        timestamp: Date.now(),
      },
      ...archiveCurrentHand(state),
    ],
    winnerId: null,
  });

  return pushLog(pushLog(pushLog(next, {
    type: 'blind',
    playerName: players[sbIndex]?.name,
    text: `small blind (${SMALL_BLIND})`,
    amount: players[sbIndex]?.currentBet ?? 0,
  }), {
    type: 'blind',
    playerName: players[bbIndex]?.name,
    text: `big blind (${BIG_BLIND})`,
    amount: players[bbIndex]?.currentBet ?? 0,
  }), {
    type: 'info',
    text: `${players[next.actionIndex]?.name ?? 'Giocatore'}, prima azione preflop`,
  });
}

function actionToBet(state, player, action, amount) {
  const toCall = Math.max(0, state.currentBet - player.currentBet);
  if (action === 'call') return player.currentBet + toCall;
  if (action === 'allin') return player.currentBet + player.chips;
  if (action === 'bet') return amount;
  if (action === 'raise') return amount;
  return player.currentBet;
}

export function playerAction(rawState, action, options = {}) {
  const state = normalizeState(rawState);
  if (state.stage === PHASES.IDLE || state.stage === PHASES.SHOWDOWN) return state;

  const playerIndex = state.actionIndex;
  const player = state.players[playerIndex];
  if (!player || !isActionable(player)) return state;

  const toCall = Math.max(0, state.currentBet - player.currentBet);
  let players = [...state.players];
  let pot = state.pot;
  let next = state;
  let logEntry = null;

  if (action === 'fold') {
    players[playerIndex] = normalizePlayer({ ...player, isActive: false, status: undefined });
    next = markActed({ ...state, players }, playerIndex);
    logEntry = { type: 'fold', playerName: player.name, text: 'fold' };
  } else if (action === 'check') {
    if (toCall > 0) return pushLog(state, { type: 'info', text: 'Non puoi check: devi call, raise o fold' });
    next = markActed(state, playerIndex);
    logEntry = { type: 'check', playerName: player.name, text: 'check' };
  } else if (action === 'call' || action === 'bet' || action === 'raise' || action === 'allin') {
    const requestedTotal = actionToBet(state, player, action, options.raiseTo ?? options.betAmount ?? state.bigBlind);
    const oldCurrentBet = state.currentBet;

    if (action === 'bet' && state.currentBet > 0) return state;
    if (action === 'raise' && state.currentBet === 0) return state;
    if (action === 'bet' && requestedTotal < state.bigBlind) return state;
    if (action === 'raise' && requestedTotal < state.currentBet + state.lastRaiseAmount && requestedTotal < player.currentBet + player.chips) {
      return pushLog(state, { type: 'info', text: `Raise minimo: ${state.currentBet + state.lastRaiseAmount}` });
    }

    const amountToPay = Math.max(0, requestedTotal - player.currentBet);
    const result = postAmount(players, playerIndex, amountToPay);
    players = result.players;
    pot += result.paid;

    const newBet = players[playerIndex].currentBet;
    const raiseAmount = Math.max(0, newBet - oldCurrentBet);
    const isFullRaise = raiseAmount >= state.lastRaiseAmount;
    const hasAggressed = newBet > oldCurrentBet && (action === 'bet' || action === 'raise' || action === 'allin');

    next = normalizeState({
      ...state,
      players,
      pot,
      sidePots: buildSidePots(players),
      currentBet: Math.max(state.currentBet, newBet),
    });

    next = hasAggressed && isFullRaise
      ? reopenRoundAfterAggression(next, playerIndex, raiseAmount)
      : markActed(next, playerIndex);

    logEntry = {
      type: hasAggressed ? 'raise' : 'call',
      playerName: player.name,
      text: players[playerIndex].isAllIn
        ? `all-in a ${newBet}`
        : hasAggressed
          ? `${state.currentBet === 0 ? 'bet' : 'raise'} a ${newBet}`
          : (toCall > 0 ? 'call' : 'check'),
      amount: result.paid,
    };
  }

  if (playerIndex === state.bbIndex && state.stage === PHASES.PREFLOP) {
    next = { ...next, bbHasOption: false };
  }

  next = pushLog(next, logEntry);
  const foldWin = finishFoldWin(next);
  if (foldWin) return foldWin;

  if (bettingRoundComplete(next)) {
    return advanceStage(next);
  }

  const nextTurn = firstActionableFrom(next.players, playerIndex);
  return normalizeState({
    ...next,
    actionIndex: nextTurn >= 0 ? nextTurn : playerIndex,
  });
}

export function getRandomBotAction(state) {
  const actor = state.players[state.activePlayerIndex];
  const toCall = Math.max(0, state.currentBet - actor.currentBet);
  const canCheck = toCall === 0;
  const canRaise = actor.chips > toCall + state.bigBlind;

  if (!canCheck && actor.chips <= toCall) return { action: 'allin' };
  if (Math.random() < 0.1 && !canCheck) return { action: 'fold' };
  if (canRaise && Math.random() < 0.22) {
    const raiseBy = CHIP_VALUES[Math.floor(Math.random() * CHIP_VALUES.length)];
    return { action: state.currentBet === 0 ? 'bet' : 'raise', raiseTo: state.currentBet + Math.max(state.bigBlind, raiseBy) };
  }
  return { action: canCheck ? 'check' : 'call' };
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
  return normalizeState({
    ...state,
    players: state.players.map((player) => (player.isHuman ? normalizePlayer({ ...player, chips }) : player)),
  });
}
