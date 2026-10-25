import test from "node:test";
import assert from "node:assert/strict";
import { CrapetteGame } from "../src/engine/game.js";
import { Card } from "../src/engine/cards.js";

test("Priorities: reserve card to foundation is flagged as Priority 1 compulsory", () => {
  const game = new CrapetteGame({ seed: 5n });
  const active = game.activePlayer;
  // Place Ace of Spades on reserve top
  game.players[active].reserve[game.players[active].reserve.length - 1] = new Card(active, "S", 1);

  const compulsory = game.getCompulsoryMoves();
  assert.ok(compulsory.some((m) => m.src === "r" && m.priority === 1));
});

test("Crapette blunder: drawing stock when compulsory move exists triggers Crapette eligibility", () => {
  const game = new CrapetteGame({ seed: 5n, mode: "competitive" });
  const active = game.activePlayer;
  // Make Ace of Spades available on reserve
  game.players[active].reserve[game.players[active].reserve.length - 1] = new Card(active, "S", 1);

  // Player ignores compulsory move and draws from stock
  const drawRes = game.send("draw");
  assert.equal(drawRes.ok, true);

  const state = game.state();
  assert.equal(state.crapetteEligible, true);

  // Opponent calls CRAPETTE!
  const crapetteRes = game.send("crapette");
  assert.equal(crapetteRes.ok, true);
  assert.equal(crapetteRes.penalty, true);

  // Active player should now be switched to the opponent
  assert.equal(game.activePlayer, 1 - active);
});

test("Crapette blunder: calling Crapette without a blunder is rejected", () => {
  const game = new CrapetteGame({ seed: 5n, mode: "competitive" });
  const active = game.activePlayer;
  // Clear any accidental aces
  game.foundations = Array.from({ length: 8 }, () => []);
  for (let i = 0; i < 8; i++) game.tableau[i] = [new Card(0, "S", 10)];
  game.players[active].reserve = [new Card(active, "H", 10)];

  // No blunder has occurred
  const res = game.send("crapette");
  assert.equal(res.ok, false);
  assert.match(res.error, /No Crapette blunder/);
});

test("Undo: restores previous board position and card location", () => {
  const game = new CrapetteGame({ seed: 5n });
  const active = game.activePlayer;
  game.tableau[0] = [new Card(0, "H", 9)];
  game.tableau[1] = [new Card(1, "S", 10)];

  const moveRes = game.send("m t0>t1");
  assert.equal(moveRes.ok, true);
  assert.equal(game.tableau[0].length, 0);
  assert.equal(game.tableau[1].length, 2);

  // Undo move
  const undoRes = game.send("undo");
  assert.equal(undoRes.ok, true);
  assert.equal(game.tableau[0].length, 1);
  assert.equal(game.tableau[1].length, 1);
  assert.equal(game.tableau[0][0].code, "9H");
});
