import test from "node:test";
import assert from "node:assert/strict";
import {
  Card,
  SUITS,
  fullDoublePack,
  canBuildOnTableau,
  canBuildOnFoundation,
  canLoadOnOpponent,
} from "../src/engine/cards.js";

test("Cards: double pack contains 104 cards with 52 in each deck", () => {
  const pack = fullDoublePack();
  assert.equal(pack.length, 104);

  const deck0 = pack.filter((c) => c.deck === 0);
  const deck1 = pack.filter((c) => c.deck === 1);
  assert.equal(deck0.length, 52);
  assert.equal(deck1.length, 52);

  const ids = new Set(pack.map((c) => c.id));
  assert.equal(ids.size, 104);
});

test("Cards: card codes and properties parse correctly", () => {
  const c = new Card(0, "H", 1); // Ace of Hearts, deck 0
  assert.equal(c.code, "AH");
  assert.equal(c.color, "red");
  assert.equal(c.rankName, "Ace");

  const kingSpades = new Card(1, "S", 13);
  assert.equal(kingSpades.code, "KS");
  assert.equal(kingSpades.color, "black");
  assert.equal(kingSpades.rankName, "King");
});

test("Cards: tableau building rules (descending alternating colors)", () => {
  const red7 = new Card(0, "H", 7);
  const black8 = new Card(1, "S", 8);
  const red8 = new Card(0, "D", 8);
  const black9 = new Card(1, "C", 9);

  // Red 7 on Black 8: valid
  assert.equal(canBuildOnTableau(red7, black8), true);
  // Red 7 on Red 8: invalid (same color)
  assert.equal(canBuildOnTableau(red7, red8), false);
  // Red 7 on Black 9: invalid (not rank - 1)
  assert.equal(canBuildOnTableau(red7, black9), false);
  // Black 8 on Red 7: invalid (ascending)
  assert.equal(canBuildOnTableau(black8, red7), false);
});

test("Cards: foundation building rules (ascending same suit, starts with Ace)", () => {
  const aceSpades = new Card(0, "S", 1);
  const twoSpades = new Card(1, "S", 2);
  const twoHearts = new Card(0, "H", 2);

  // Empty foundation accepts only Ace
  assert.equal(canBuildOnFoundation(aceSpades, null), true);
  assert.equal(canBuildOnFoundation(twoSpades, null), false);

  // Foundation with Ace of Spades accepts only Two of Spades
  assert.equal(canBuildOnFoundation(twoSpades, aceSpades), true);
  assert.equal(canBuildOnFoundation(twoHearts, aceSpades), false);
});

test("Cards: opponent loading rules (same suit, rank +/- 1, no wrapping)", () => {
  const heart6 = new Card(0, "H", 6);
  const heart5 = new Card(1, "H", 5);
  const heart7 = new Card(1, "H", 7);
  const spade5 = new Card(1, "S", 5);
  const heart8 = new Card(1, "H", 8);

  // On Heart 6, can play Heart 5 (-1) or Heart 7 (+1)
  assert.equal(canLoadOnOpponent(heart5, heart6), true);
  assert.equal(canLoadOnOpponent(heart7, heart6), true);

  // Wrong suit is invalid
  assert.equal(canLoadOnOpponent(spade5, heart6), false);
  // Difference of 2 is invalid
  assert.equal(canLoadOnOpponent(heart8, heart6), false);

  // No wrapping: Ace cannot go on King, King cannot go on Ace
  const aceClubs = new Card(0, "C", 1);
  const kingClubs = new Card(1, "C", 13);
  assert.equal(canLoadOnOpponent(aceClubs, kingClubs), false);
  assert.equal(canLoadOnOpponent(kingClubs, aceClubs), false);
});
