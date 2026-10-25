// Card representations and standard rules for Crapette (Russian Bank).

export const SUITS = ["S", "H", "D", "C"]; // Spades, Hearts, Diamonds, Clubs
export const SUIT_NAMES = { S: "Spades", H: "Hearts", D: "Diamonds", C: "Clubs" };
export const SUIT_GLYPHS = { S: "♠", H: "♥", D: "♦", C: "♣" };
export const RANKS = "A23456789TJQK";
export const RANK_NAMES = [
  "",
  "Ace",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "Jack",
  "Queen",
  "King",
];

export class Card {
  constructor(deck, suit, rank) {
    this.deck = deck; // 0 (Red / Player 0) or 1 (Blue / Player 1)
    this.suit = suit; // 'S', 'H', 'D', 'C'
    this.rank = rank; // 1..13
    this.code = `${RANKS[rank - 1]}${suit}`;
    const suitIdx = SUITS.indexOf(suit);
    this.id = deck * 52 + suitIdx * 13 + (rank - 1);
  }

  get color() {
    return this.suit === "H" || this.suit === "D" ? "red" : "black";
  }

  get rankName() {
    return RANK_NAMES[this.rank];
  }

  get suitName() {
    return SUIT_NAMES[this.suit];
  }

  get glyph() {
    return SUIT_GLYPHS[this.suit];
  }

  toString() {
    return `${this.code} (Deck ${this.deck})`;
  }
}

export function deckPack(deckId) {
  const pack = [];
  for (const suit of SUITS) {
    for (let r = 1; r <= 13; r++) {
      pack.push(new Card(deckId, suit, r));
    }
  }
  return pack;
}

export function fullDoublePack() {
  return [...deckPack(0), ...deckPack(1)];
}

// Tableau building rule: descending sequence with strictly alternating colors
export function canBuildOnTableau(child, parent) {
  if (!parent) return true; // Empty space can be filled by any card
  return child.color !== parent.color && child.rank === parent.rank - 1;
}

// Foundation building rule: ascending sequence of same suit, starting with Ace
export function canBuildOnFoundation(card, topCard) {
  if (!topCard) {
    return card.rank === 1; // Only Ace can start an empty foundation
  }
  return card.suit === topCard.suit && card.rank === topCard.rank + 1;
}

// Opponent loading rule: same suit, adjacent rank (+1 or -1), no wrapping
export function canLoadOnOpponent(card, targetTop) {
  if (!targetTop) return false;
  if (card.suit !== targetTop.suit) return false;
  const diff = Math.abs(card.rank - targetTop.rank);
  return diff === 1;
}
