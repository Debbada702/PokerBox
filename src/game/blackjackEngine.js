const SUITS = ['\u2660', '\u2665', '\u2666', '\u2663'];
const RANKS = [
  ['2', 2],
  ['3', 3],
  ['4', 4],
  ['5', 5],
  ['6', 6],
  ['7', 7],
  ['8', 8],
  ['9', 9],
  ['10', 10],
  ['J', 10],
  ['Q', 10],
  ['K', 10],
  ['A', 11],
];

export const BLACKJACK_BET = 100;
export const BLACKJACK_MAX_PLAYERS = 4;
export const HOUSE_PLAYER_ID = 'eb0a1de3-fd65-410a-83b6-4cbcaac89de5';

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const [rank, value] of RANKS) {
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

function draw(deck) {
  return deck.pop();
}

function scoreHand(cards) {
  let total = cards.reduce((sum, card) => sum + card.value, 0);
  let aces = cards.filter((card) => card.rank === 'A').length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

function isBlackjack(cards) {
  return cards.length === 2 && scoreHand(cards) === 21;
}

function nextWaitingPlayer(players, fromIndex = -1) {
  for (let step = 1; step <= players.length; step += 1) {
    const index = (fromIndex + step) % players.length;
    if (players[index].status === 'playing') return index;
  }
  return -1;
}

function normalize(state) {
  return {
    ...state,
    phase: state.stage,
    activePlayerIndex: state.actionIndex,
  };
}

function log(state, entry) {
  return normalize({
    ...state,
    actionLog: [{ id: `${Date.now()}-${Math.random()}`, timestamp: Date.now(), ...entry }, ...(state.actionLog ?? [])],
  });
}

export function createBlackjackGameFromRoster(roster, humanProfile = null) {
  const players = roster
    .filter((seat) => !seat.isBot)
    .slice(0, BLACKJACK_MAX_PLAYERS)
    .map((seat, index) => ({
      id: index,
      userId: seat.userId,
      name: seat.nametag,
      chips: seat.chips ?? (seat.isHuman ? humanProfile?.chips ?? 0 : 0),
      hand: [],
      bet: 0,
      status: 'waiting',
      result: null,
      payout: 0,
      betDecision: 'pending',
      isHuman: !!seat.isHuman,
      isBot: false,
    }));

  return normalize({
    gameType: 'blackjack',
    stage: 'idle',
    players,
    dealer: { hand: [], score: 0, hidden: true },
    deck: [],
    pot: 0,
    actionIndex: 0,
    handNumber: 0,
    actionLog: [],
    bankDelta: 0,
    bankTransferId: null,
  });
}

export function startBlackjackBettingRound(rawState) {
  const seated = rawState.players.filter((player) => player.chips > 0);
  if (seated.length === 0) return log(rawState, { type: 'info', text: 'Servono chips per giocare blackjack' });

  return log(normalize({
    ...rawState,
    stage: 'betting',
    players: seated.map((player, index) => ({
      ...player,
      id: index,
      hand: [],
      bet: 0,
      status: 'betting',
      result: null,
      payout: 0,
      betDecision: 'pending',
    })),
    dealer: { hand: [], score: 0, hidden: true },
    deck: [],
    pot: 0,
    handNumber: rawState.handNumber + 1,
    actionIndex: 0,
    actionLog: [],
    bankDelta: 0,
    bankTransferId: null,
  }), { type: 'phase', text: 'Apertura puntate blackjack' });
}

export function blackjackBet(rawState, userId, amount) {
  const state = normalize(rawState);
  if (state.stage !== 'betting') return state;

  const players = state.players.map((player) => {
    if (player.userId !== userId || player.betDecision !== 'pending') return player;
    const bet = Math.min(Math.max(0, Math.trunc(amount)), player.chips);
    return {
      ...player,
      bet,
      chips: player.chips - bet,
      status: bet > 0 ? 'ready' : 'skipped',
      betDecision: bet > 0 ? 'bet' : 'skip',
    };
  });

  const next = normalize({
    ...state,
    players,
    pot: players.reduce((sum, player) => sum + player.bet, 0),
  });

  if (players.every((player) => player.betDecision !== 'pending')) {
    return dealBlackjackHand(next);
  }

  const bettor = players.find((player) => player.userId === userId);
  return log(next, {
    type: bettor?.bet > 0 ? 'bet' : 'check',
    playerName: bettor?.name,
    text: bettor?.bet > 0 ? `punta ${bettor.bet}` : 'salta la mano',
    amount: bettor?.bet ?? 0,
  });
}

export function dealBlackjackHand(rawState) {
  const activeBettors = rawState.players.filter((player) => player.bet > 0 && player.status !== 'skipped');
  if (activeBettors.length === 0) return log({ ...rawState, stage: 'idle', phase: 'idle' }, { type: 'info', text: 'Nessuna puntata: mano annullata' });

  const deck = shuffleDeck(createDeck());
  let players = rawState.players.map((player, index) => ({
    ...player,
    id: index,
    hand: [],
    status: player.bet > 0 ? 'playing' : 'skipped',
    result: null,
    payout: 0,
  }));
  let dealer = { hand: [], score: 0, hidden: true };
  const pot = players.reduce((sum, player) => sum + player.bet, 0);

  for (let round = 0; round < 2; round += 1) {
    players = players.map((player) => (
      player.bet > 0 ? { ...player, hand: [...player.hand, draw(deck)] } : player
    ));
    dealer = { ...dealer, hand: [...dealer.hand, draw(deck)] };
  }

  players = players.map((player) => (
    isBlackjack(player.hand) ? { ...player, status: 'stand' } : player
  ));

  const first = nextWaitingPlayer(players);
  let state = normalize({
    ...rawState,
    gameType: 'blackjack',
    stage: first >= 0 ? 'playing' : 'dealer',
    players,
    dealer: { ...dealer, score: scoreHand(dealer.hand), hidden: first >= 0 },
    deck,
    pot,
    actionIndex: first >= 0 ? first : 0,
    handNumber: rawState.handNumber,
    bankDelta: 0,
    bankTransferId: null,
  });

  state = log(state, { type: 'phase', text: `Mano blackjack #${state.handNumber}` });
  if (first < 0) return settleBlackjack(state);
  return state;
}

function continueOrSettle(state, players, deck, dealer = state.dealer) {
  const next = nextWaitingPlayer(players, state.actionIndex);
  const base = normalize({ ...state, players, deck, dealer, actionIndex: next >= 0 ? next : 0 });
  if (next >= 0) return base;
  return settleBlackjack({ ...base, stage: 'dealer', dealer: { ...dealer, hidden: false } });
}

export function blackjackAction(rawState, action) {
  const state = normalize(rawState);
  if (state.stage !== 'playing') return state;
  const player = state.players[state.actionIndex];
  if (!player || player.status !== 'playing') return state;

  let deck = [...state.deck];
  let players = [...state.players];

  if (action === 'hit') {
    const hand = [...player.hand, draw(deck)];
    const score = scoreHand(hand);
    players[state.actionIndex] = {
      ...player,
      hand,
      status: score > 21 ? 'bust' : 'playing',
    };
    const next = log(continueOrSettle(state, players, deck), {
      type: score > 21 ? 'fold' : 'call',
      playerName: player.name,
      text: score > 21 ? 'sballa' : 'pesca carta',
    });
    return next;
  }

  if (action === 'stand') {
    players[state.actionIndex] = { ...player, status: 'stand' };
    return log(continueOrSettle(state, players, deck), {
      type: 'check',
      playerName: player.name,
      text: 'sta',
    });
  }

  if (action === 'double' && player.hand.length === 2 && player.chips >= player.bet) {
    const hand = [...player.hand, draw(deck)];
    const score = scoreHand(hand);
    players[state.actionIndex] = {
      ...player,
      chips: player.chips - player.bet,
      bet: player.bet * 2,
      hand,
      status: score > 21 ? 'bust' : 'stand',
    };
    return log(continueOrSettle({ ...state, pot: state.pot + player.bet }, players, deck), {
      type: 'raise',
      playerName: player.name,
      text: 'double',
      amount: player.bet,
    });
  }

  return state;
}

function settleBlackjack(rawState) {
  let deck = [...rawState.deck];
  let dealer = { ...rawState.dealer, hidden: false };
  while (scoreHand(dealer.hand) < 17) {
    dealer = { ...dealer, hand: [...dealer.hand, draw(deck)] };
  }
  dealer.score = scoreHand(dealer.hand);
  const dealerBust = dealer.score > 21;
  const dealerBlackjack = isBlackjack(dealer.hand);
  let bankDelta = 0;

  const players = rawState.players.map((player) => {
    if (player.bet <= 0) {
      return { ...player, status: 'skipped', result: 'skip', payout: 0 };
    }

    const score = scoreHand(player.hand);
    const blackjack = isBlackjack(player.hand);
    let result;
    let payout = 0;

    if (score > 21) {
      result = 'lose';
      bankDelta += player.bet;
    } else if (blackjack && !dealerBlackjack) {
      result = 'blackjack';
      payout = player.bet + Math.floor(player.bet * 1.5);
      bankDelta -= Math.floor(player.bet * 1.5);
    } else if (dealerBlackjack && !blackjack) {
      result = 'lose';
      bankDelta += player.bet;
    } else if (dealerBust || score > dealer.score) {
      result = 'win';
      payout = player.bet * 2;
      bankDelta -= player.bet;
    } else if (score === dealer.score) {
      result = 'push';
      payout = player.bet;
    } else {
      result = 'lose';
      bankDelta += player.bet;
    }

    return {
      ...player,
      chips: player.chips + payout,
      status: 'settled',
      result,
      payout,
    };
  });

  return log(normalize({
    ...rawState,
    stage: 'showdown',
    players,
    dealer,
    deck,
    pot: 0,
    actionIndex: 0,
    bankDelta,
    bankTransferId: `${rawState.handNumber}-${Date.now()}`,
  }), {
    type: 'win',
    playerName: 'Banco',
    text: bankDelta >= 0 ? `banco +${bankDelta}` : `banco ${bankDelta}`,
    amount: Math.abs(bankDelta),
  });
}

export function getBlackjackScore(cards) {
  return scoreHand(cards);
}
