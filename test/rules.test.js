import test from "node:test";
import assert from "node:assert/strict";
import { CrapetteGame } from "../src/engine/game.js";
import { Card } from "../src/engine/cards.js";

test("Game Setup: correctly deals reserves, tableau, and stocks", () => {
  const game = new CrapetteGame({ seed: 100n });
  const s = game.state();

  assert.equal(s.players[0].reserve.length, 13);
  assert.equal(s.players[1].reserve.length, 13);
  assert.equal(s.players[0].stock.length, 35);
  assert.equal(s.players[1].stock.length, 35);
  assert.equal(s.tableau.length, 8);
  for (let i = 0; i < 8; i++) {
    assert.equal(s.tableau[i].length, 1);
  }
  assert.equal(s.foundations.length, 8);
  for (let i = 0; i < 8; i++) {
    assert.equal(s.foundations[i].length, 0);
  }
});

test("First player selection: lower reserve card plays first", () => {
  const game = new CrapetteGame({ seed: 42n });
  const p0Rank = game.players[0].reserve[game.players[0].reserve.length - 1].rank;
  const p1Rank = game.players[1].reserve[game.players[1].reserve.length - 1].rank;
  if (p0Rank < p1Rank) {
    assert.equal(game.activePlayer, 0);
  } else if (p1Rank < p0Rank) {
    assert.equal(game.activePlayer, 1);
  }
});

test("Foundation building: moves card from reserve or tableau to foundation", () => {
  const game = new CrapetteGame({ seed: 1n });
  // Set up an Ace on active player's reserve
  const active = game.activePlayer;
  game.players[active].reserve[game.players[active].reserve.length - 1] = new Card(active, "S", 1); // Ace of Spades

  const res = game.send("m r>h");
  assert.equal(res.ok, true);
  // Foundation 0 should now hold the Ace of Spades
  const state = game.state();
  const fCount = state.foundations.flat().length;
  assert.equal(fCount, 1);
  assert.equal(state.players[active].reserve.length, 12);
});

test("Tableau building: moves card between tableau columns with alternating colors", () => {
  const game = new CrapetteGame({ seed: 1n });
  // Put a 9 of Hearts on tableau 0 and a 10 of Spades on tableau 1
  game.tableau[0] = [new Card(0, "H", 9)];
  game.tableau[1] = [new Card(1, "S", 10)];

  const res = game.send("m t0>t1");
  assert.equal(res.ok, true);
  assert.equal(game.tableau[0].length, 0);
  assert.equal(game.tableau[1].length, 2);
  assert.equal(game.tableau[1][1].code, "9H");
});

test("Opponent loading: can play matching suit adjacent rank on opponent reserve", () => {
  const game = new CrapetteGame({ seed: 1n });
  const active = game.activePlayer;
  const opp = 1 - active;

  // Set opponent's top reserve to 7 of Diamonds
  game.players[opp].reserve[game.players[opp].reserve.length - 1] = new Card(opp, "D", 7);
  // Set active player's reserve to 8 of Diamonds
  game.players[active].reserve[game.players[active].reserve.length - 1] = new Card(active, "D", 8);

  const res = game.send("m r>opp_r");
  assert.equal(res.ok, true);
  // Opponent reserve now has 14 cards, top card is 8 of Diamonds
  assert.equal(game.players[opp].reserve.length, 14);
  assert.equal(game.players[opp].reserve[game.players[opp].reserve.length - 1].code, "8D");
});

test("Turn flow: drawing stock and discarding to waste ends turn", () => {
  const game = new CrapetteGame({ seed: 1n });
  const startPlayer = game.activePlayer;

  // Draw a card
  const drawRes = game.send("draw");
  assert.equal(drawRes.ok, true);
  assert.ok(game.drawnCard !== null);

  // Send to waste
  const wasteRes = game.send("waste");
  assert.equal(wasteRes.ok, true);
  assert.equal(game.drawnCard, null);
  // Turn should now pass to the other player!
  assert.equal(game.activePlayer, 1 - startPlayer);
});
