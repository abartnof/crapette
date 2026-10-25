import test from "node:test";
import assert from "node:assert/strict";
import { CrapetteGame } from "../src/engine/game.js";
import { CrapetteAI } from "../src/engine/ai.js";
import { Card } from "../src/engine/cards.js";

test("AI: calls Crapette immediately when opponent commits a blunder", () => {
  const game = new CrapetteGame({ seed: 77n, mode: "competitive" });
  const ai = new CrapetteAI({ skill: "master" });

  // Human is active and commits blunder by drawing with Ace on reserve
  const active = game.activePlayer;
  game.players[active].reserve[game.players[active].reserve.length - 1] = new Card(active, "S", 1);
  game.send("draw");

  const move = ai.chooseMove(game);
  assert.equal(move, "crapette");
});

test("AI: executes compulsory foundation moves first", () => {
  const game = new CrapetteGame({ seed: 88n });
  const ai = new CrapetteAI({ skill: "master" });
  const active = game.activePlayer;

  // Make Ace of Diamonds available on reserve
  game.players[active].reserve[game.players[active].reserve.length - 1] = new Card(active, "D", 1);

  const move = ai.chooseMove(game);
  assert.match(move, /^m r>h/);
});

test("AI: executes tableau to foundation compulsory move when reserve cannot", () => {
  const game = new CrapetteGame({ seed: 88n });
  const ai = new CrapetteAI({ skill: "master" });
  const active = game.activePlayer;

  // Reserve top is not an Ace
  game.players[active].reserve[game.players[active].reserve.length - 1] = new Card(active, "H", 10);
  // Tableau 2 has an Ace of Spades
  game.tableau[2] = [new Card(active, "S", 1)];

  const move = ai.chooseMove(game);
  assert.match(move, /^m t2>h/);
});

test("AI: prioritizes loading opponent reserve with matching suit adjacent rank", () => {
  const game = new CrapetteGame({ seed: 88n });
  const ai = new CrapetteAI({ skill: "master" });
  const active = game.activePlayer;
  const opp = 1 - active;

  // Clear foundations of aces to avoid foundation priority
  game.foundations = Array.from({ length: 8 }, () => []);
  for (let i = 0; i < 8; i++) game.tableau[i] = [new Card(0, "S", 10)];

  game.players[opp].reserve[game.players[opp].reserve.length - 1] = new Card(opp, "H", 7);
  game.players[active].reserve[game.players[active].reserve.length - 1] = new Card(active, "H", 8);

  const move = ai.chooseMove(game);
  assert.equal(move, "m r>opp_r");
});

test("AI: loads opponent waste when opponent reserve is not loadable", () => {
  const game = new CrapetteGame({ seed: 88n });
  const ai = new CrapetteAI({ skill: "master" });
  const active = game.activePlayer;
  const opp = 1 - active;

  game.foundations = Array.from({ length: 8 }, () => []);
  for (let i = 0; i < 8; i++) game.tableau[i] = [new Card(0, "S", 10)];

  // Opponent reserve cannot be loaded (King of Spades)
  game.players[opp].reserve[game.players[opp].reserve.length - 1] = new Card(opp, "S", 13);
  // Opponent waste has 4 of Diamonds
  game.players[opp].waste = [new Card(opp, "D", 4)];
  // Active reserve has 5 of Diamonds
  game.players[active].reserve[game.players[active].reserve.length - 1] = new Card(active, "D", 5);

  const move = ai.chooseMove(game);
  assert.equal(move, "m r>opp_w");
});

test("AI: executes tableau building moves", () => {
  const game = new CrapetteGame({ seed: 88n });
  const ai = new CrapetteAI({ skill: "master" });
  const active = game.activePlayer;
  const opp = 1 - active;

  // Clear foundations
  game.foundations = Array.from({ length: 8 }, () => []);
  // Make sure no opponent loading is possible
  game.players[opp].reserve[game.players[opp].reserve.length - 1] = new Card(opp, "C", 2);
  game.players[opp].waste = [];

  // Active reserve has Red 8
  game.players[active].reserve[game.players[active].reserve.length - 1] = new Card(active, "H", 8);
  // Tableau 0 has Black 9 (can receive Red 8)
  game.tableau[0] = [new Card(active, "S", 9)];
  for (let i = 1; i < 8; i++) game.tableau[i] = [new Card(0, "S", 2)];

  const move = ai.chooseMove(game);
  assert.equal(move, "m r>t0");
});

test("AI: fills empty tableau space from reserve", () => {
  const game = new CrapetteGame({ seed: 88n });
  const ai = new CrapetteAI({ skill: "master" });
  const active = game.activePlayer;
  const opp = 1 - active;

  // Clear foundations
  game.foundations = Array.from({ length: 8 }, () => []);
  // No opponent loading
  game.players[opp].reserve[game.players[opp].reserve.length - 1] = new Card(opp, "C", 2);
  game.players[opp].waste = [];

  // Reserve has card that cannot build on any tableau
  game.players[active].reserve[game.players[active].reserve.length - 1] = new Card(active, "H", 8);
  // Tableau 3 is empty, others cannot receive Red 8
  for (let i = 0; i < 8; i++) {
    game.tableau[i] = i === 3 ? [] : [new Card(0, "H", 2)];
  }

  const move = ai.chooseMove(game);
  assert.equal(move, "m r>t3");
});

test("AI: draws card from stock when no moves remaining and no card drawn", () => {
  const game = new CrapetteGame({ seed: 88n });
  const ai = new CrapetteAI({ skill: "master" });
  const active = game.activePlayer;
  const opp = 1 - active;

  game.foundations = Array.from({ length: 8 }, () => []);
  // No tableau spaces empty
  for (let i = 0; i < 8; i++) game.tableau[i] = [new Card(0, "H", 2)];
  game.players[opp].reserve[game.players[opp].reserve.length - 1] = new Card(opp, "C", 5);
  game.players[opp].waste = [];
  // Active reserve cannot move to foundation, opponent, or tableau
  game.players[active].reserve[game.players[active].reserve.length - 1] = new Card(active, "D", 2);
  assert.equal(game.drawnCard, null);

  const move = ai.chooseMove(game);
  assert.equal(move, "draw");
});

test("AI: plays drawn card to foundation if possible", () => {
  const game = new CrapetteGame({ seed: 88n });
  const ai = new CrapetteAI({ skill: "master" });
  const active = game.activePlayer;

  // Active has drawn an Ace
  game.drawnCard = new Card(active, "S", 1);

  const move = ai.chooseMove(game);
  assert.match(move, /^m drawn>h/);
});

test("AI: plays drawn card to opponent if possible", () => {
  const game = new CrapetteGame({ seed: 88n });
  const ai = new CrapetteAI({ skill: "master" });
  const active = game.activePlayer;
  const opp = 1 - active;

  game.foundations = Array.from({ length: 8 }, () => []);
  game.players[opp].reserve[game.players[opp].reserve.length - 1] = new Card(opp, "D", 6);
  game.drawnCard = new Card(active, "D", 7);

  const move = ai.chooseMove(game);
  assert.equal(move, "m drawn>opp_r");
});

test("AI: plays drawn card to tableau if possible", () => {
  const game = new CrapetteGame({ seed: 88n });
  const ai = new CrapetteAI({ skill: "master" });
  const active = game.activePlayer;
  const opp = 1 - active;

  game.foundations = Array.from({ length: 8 }, () => []);
  game.players[opp].reserve[game.players[opp].reserve.length - 1] = new Card(opp, "C", 2);
  game.tableau[4] = [new Card(0, "S", 10)]; // Black 10
  for (let i = 0; i < 8; i++) if (i !== 4) game.tableau[i] = [new Card(0, "C", 2)];

  // Drawn card is Red 9
  game.drawnCard = new Card(active, "H", 9);

  const move = ai.chooseMove(game);
  assert.equal(move, "m drawn>t4");
});

test("AI: discards drawn card to waste when it cannot be moved", () => {
  const game = new CrapetteGame({ seed: 88n });
  const ai = new CrapetteAI({ skill: "master" });
  const active = game.activePlayer;
  const opp = 1 - active;

  game.foundations = Array.from({ length: 8 }, () => []);
  for (let i = 0; i < 8; i++) game.tableau[i] = [new Card(0, "C", 2)];
  game.players[opp].reserve[game.players[opp].reserve.length - 1] = new Card(opp, "C", 9);
  game.players[opp].waste = [];

  // Drawn card is King of Hearts (cannot go to C2 or C9 or empty foundation)
  game.drawnCard = new Card(active, "H", 13);

  const move = ai.chooseMove(game);
  assert.equal(move, "waste");
});

test("AI: supports novice skill setting with occasional oversights", () => {
  const novice = new CrapetteAI({ skill: "novice" });
  const master = new CrapetteAI({ skill: "master" });

  assert.equal(novice.skill, "novice");
  assert.equal(master.skill, "master");
});

test("AI: prevents infinite loop tableau oscillations", () => {
  const game = new CrapetteGame({ seed: 1n });
  const ai = new CrapetteAI({ seed: 1n });

  // Move 40 in seed 1n previously triggered t2>t4 and t4>t2 loop
  const moves = [];
  for (let m = 0; m < 60; m++) {
    const move = ai.chooseMove(game);
    assert.ok(move, `Move ${m} should not be null`);
    moves.push(move);
    const res = game.send(move);
    assert.equal(res.ok, true, `Move ${move} failed: ${res.error}`);
  }

  // Ensure no consecutive reverse oscillations like t2>t4 followed by t4>t2
  let oscillations = 0;
  for (let i = 0; i < moves.length - 1; i++) {
    if (moves[i] === "m t2>t4" && moves[i + 1] === "m t4>t2") oscillations++;
  }
  assert.equal(oscillations, 0, "AI must not oscillate cards between tableau columns");
});

test("AI: successfully plays 50 full simulated games to completion", () => {
  let finished = 0;
  const wins = [0, 0];
  for (let i = 0; i < 50; i++) {
    const seed = BigInt(i + 1);
    const game = new CrapetteGame({ seed });
    const ai = new CrapetteAI({ seed });
    let moves = 0;
    while (game.winner == null && moves < 2500) {
      const move = ai.chooseMove(game);
      if (!move) break;
      const res = game.send(move);
      if (!res.ok) break;
      moves++;
    }
    if (game.winner != null) {
      finished++;
      wins[game.winner]++;
    }
  }
  assert.equal(finished, 50, "All 50 simulated games must finish with a winner");
  assert.ok(wins[0] > 10 && wins[1] > 10, "Both players should win a healthy share of matches");
});
