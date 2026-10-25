import test from "node:test";
import assert from "node:assert/strict";
import { calculateDealScore, MatchLedger } from "../src/engine/scoring.js";
import { CrapetteGame } from "../src/engine/game.js";
import { Card } from "../src/engine/cards.js";

test("Scoring: calculates deal points with winner bonus and loser penalties", () => {
  // Player 0 wins.
  // Player 1 (loser) has 5 cards in reserve, 10 in stock, 4 in waste.
  const state = {
    winner: 0,
    players: [
      { id: 0, reserve: [], stock: [], waste: [] },
      {
        id: 1,
        reserve: new Array(5).fill(null),
        stock: new Array(10).fill(null),
        waste: new Array(4).fill(null),
      },
    ],
  };

  const score = calculateDealScore(state);
  assert.equal(score.winner, 0);
  assert.equal(score.loser, 1);
  assert.equal(score.winnerBonus, 30);
  assert.equal(score.reservePenalty, 10); // 5 * 2
  assert.equal(score.stockWastePenalty, 14); // 10 + 4
  assert.equal(score.totalPoints, 54); // 30 + 10 + 14
  assert.deepEqual(score.dealScores, [54, 0]);
});

test("Scoring: handles Player 1 winning with remaining loser cards", () => {
  const state = {
    winner: 1,
    players: [
      {
        id: 0,
        reserve: new Array(3).fill(null),
        stock: new Array(8).fill(null),
        waste: new Array(2).fill(null),
      },
      { id: 1, reserve: [], stock: [], waste: [] },
    ],
  };

  const score = calculateDealScore(state);
  assert.equal(score.winner, 1);
  assert.equal(score.loser, 0);
  assert.equal(score.winnerBonus, 30);
  assert.equal(score.reservePenalty, 6); // 3 * 2
  assert.equal(score.stockWastePenalty, 10); // 8 + 2
  assert.equal(score.totalPoints, 46); // 30 + 6 + 10
  assert.deepEqual(score.dealScores, [0, 46]);
});

test("Scoring: supports CrapetteGame instance directly", () => {
  const game = new CrapetteGame({ seed: 1n });
  game.winner = 0;
  // Winner has empty piles
  game.players[0].reserve = [];
  game.players[0].stock = [];
  game.players[0].waste = [];
  game.drawnCard = null;

  // Loser has 2 reserve, 5 stock, 1 waste
  game.players[1].reserve = [new Card(1, "S", 1), new Card(1, "S", 2)];
  game.players[1].stock = new Array(5).fill(new Card(1, "S", 3));
  game.players[1].waste = [new Card(1, "S", 4)];

  const score = calculateDealScore(game);
  assert.equal(score.winner, 0);
  assert.equal(score.winnerBonus, 30);
  assert.equal(score.reservePenalty, 4); // 2 * 2
  assert.equal(score.stockWastePenalty, 6); // 5 + 1
  assert.equal(score.totalPoints, 40); // 30 + 4 + 6
  assert.deepEqual(score.dealScores, [40, 0]);
});

test("MatchLedger: tracks multiple deals and accumulates totals", () => {
  const ledger = new MatchLedger();

  assert.equal(ledger.dealCount, 0);
  assert.deepEqual(ledger.totals, [0, 0]);
  assert.equal(ledger.leader, null);

  // Deal 1: Player 0 wins 45 points
  ledger.recordDeal({
    winner: 0,
    loser: 1,
    totalPoints: 45,
    dealScores: [45, 0],
  });

  assert.equal(ledger.dealCount, 1);
  assert.deepEqual(ledger.totals, [45, 0]);
  assert.equal(ledger.leader, 0);

  // Deal 2: Player 1 wins 52 points
  ledger.recordDeal({
    winner: 1,
    loser: 0,
    totalPoints: 52,
    dealScores: [0, 52],
  });

  assert.equal(ledger.dealCount, 2);
  assert.deepEqual(ledger.totals, [45, 52]);
  assert.equal(ledger.leader, 1);

  // Deal 3: Player 0 wins 30 points
  ledger.recordDeal({
    winner: 0,
    loser: 1,
    totalPoints: 30,
    dealScores: [30, 0],
  });

  assert.equal(ledger.dealCount, 3);
  assert.deepEqual(ledger.totals, [75, 52]);
  assert.equal(ledger.leader, 0);

  // Match target verification
  assert.equal(ledger.isMatchOver(100), false);
  assert.equal(ledger.isMatchOver(70), true);

  // Reset ledger
  ledger.reset();
  assert.equal(ledger.dealCount, 0);
  assert.deepEqual(ledger.totals, [0, 0]);
  assert.equal(ledger.leader, null);
});
