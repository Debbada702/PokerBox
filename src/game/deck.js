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
  ['J', 11],
  ['Q', 12],
  ['K', 13],
  ['A', 14],
];

export function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const [rank, value] of RANKS) {
      deck.push({
        id: `${rank}${suit}`,
        rank,
        suit,
        value,
        label: `${rank}${suit}`,
        color: suit === '\u2665' || suit === '\u2666' ? 'red' : 'black',
      });
    }
  }
  return deck;
}

export function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function drawCards(deck, count) {
  return {
    drawn: deck.slice(0, count),
    remaining: deck.slice(count),
  };
}
