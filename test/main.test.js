import test from "node:test";
import assert from "node:assert/strict";
import { GameController } from "../web3d/src/main.js";

class MockSound {
  constructor() {
    this.played = [];
  }
  cardSlide() { this.played.push("cardSlide"); }
  cardSnap() { this.played.push("cardSnap"); }
  cardFlip() { this.played.push("cardFlip"); }
  foundationChime(rank) { this.played.push(`foundationChime_${rank}`); }
  crapetteCall() { this.played.push("crapetteCall"); }
  victoryFanfare() { this.played.push("victoryFanfare"); }
  setMuted() {}
  isMuted() { return false; }
}

class MockHUD {
  constructor() {
    this.rendered = [];
    this.toasts = [];
  }
  render(state, ledger) {
    this.rendered.push({ state, ledger });
  }
  showToast(msg) {
    this.toasts.push(msg);
  }
  setMuted() {}
  setSkill() {}
}

class MockTable {
  constructor() {
    this.synced = [];
  }
  sync(state) {
    this.synced.push(state);
  }
  highlightSlots() {}
  clearHighlights() {}
}

test("GameController initializes components and syncs initial state", () => {
  const sound = new MockSound();
  const hud = new MockHUD();
  const table = new MockTable();

  const controller = new GameController({
    sound,
    hud,
    table,
    seed: 12345n,
    stepDelayMs: 0,
  });

  assert.ok(controller.game);
  assert.ok(controller.ai);
  assert.ok(controller.ledger);
  assert.equal(hud.rendered.length, 1);
  assert.equal(table.synced.length, 1);
});

test("GameController wires audio on draw and moves", () => {
  const sound = new MockSound();
  const hud = new MockHUD();
  const table = new MockTable();

  const controller = new GameController({
    sound,
    hud,
    table,
    seed: 12345n,
    stepDelayMs: 0,
  });

  // Force active player to 0
  controller.game.activePlayer = 0;
  controller.game.drawnCard = null;

  controller.handleDraw();
  assert.ok(sound.played.includes("cardSlide"), "cardSlide played on draw");

  // Put an Ace as drawn card so it can legally move to foundation
  controller.game.drawnCard = { code: "AD", suit: "D", rank: 1, deck: 0 };

  // Move to foundation
  controller.handleMove("drawn", "h");
  // Check if foundation chime played
  const playedChime = sound.played.some((p) => p.startsWith("foundationChime_"));
  assert.ok(playedChime, "foundation chime played on foundation move");
});

test("GameController wires audio on Crapette call", () => {
  const sound = new MockSound();
  const hud = new MockHUD();
  const table = new MockTable();

  const controller = new GameController({
    sound,
    hud,
    table,
    seed: 12345n,
    stepDelayMs: 0,
  });

  controller.game.crapetteBlunder = { type: "test_blunder" };
  controller.handleCrapette();
  assert.ok(sound.played.includes("crapetteCall"), "crapetteCall played on crapette");
});

test("GameController stepAI advances AI moves when active player is 1", async () => {
  const sound = new MockSound();
  const hud = new MockHUD();
  const table = new MockTable();

  const controller = new GameController({
    sound,
    hud,
    table,
    seed: 12345n,
    stepDelayMs: 0,
  });

  controller.game.activePlayer = 1;
  await controller.stepAI();

  // Either AI played a move or ended its turn
  assert.ok(hud.rendered.length >= 2, "HUD updated during AI step");
});

test("GameController supports AI vs AI mode and toggling mode", () => {
  const sound = new MockSound();
  const hud = new MockHUD();
  const table = new MockTable();

  const controller = new GameController({
    sound,
    hud,
    table,
    seed: 12345n,
    stepDelayMs: 0,
  });

  assert.equal(controller.gameMode, "human_vs_ai");
  controller.toggleGameMode();
  assert.equal(controller.gameMode, "ai_vs_ai");
  controller.toggleGameMode();
  assert.equal(controller.gameMode, "human_vs_ai");
});

test("GameController stepAI executes moves for player 0 in AI vs AI mode", async () => {
  const sound = new MockSound();
  const hud = new MockHUD();
  const table = new MockTable();

  const controller = new GameController({
    sound,
    hud,
    table,
    seed: 12345n,
    stepDelayMs: 0,
    gameMode: "ai_vs_ai",
  });

  controller.game.activePlayer = 0;
  await controller.stepAI();

  assert.ok(hud.rendered.length >= 2, "HUD updated during AI vs AI step for player 0");
});

test("GameController stepAI handles pass action", async () => {
  const sound = new MockSound();
  const hud = new MockHUD();
  const table = new MockTable();

  const controller = new GameController({
    sound,
    hud,
    table,
    seed: 12345n,
    stepDelayMs: 0,
    gameMode: "ai_vs_ai",
  });

  // Mock AI returning 'pass'
  controller.ai.chooseMove = () => "pass";
  controller.game.activePlayer = 0;

  await controller.stepAI();
  assert.equal(controller.game.activePlayer, 1, "Turn passed to player 1 on pass");
});

test("GameController runs a match in AI vs AI mode to completion", async () => {
  const sound = new MockSound();
  const hud = new MockHUD();
  const table = new MockTable();

  const controller = new GameController({
    sound,
    hud,
    table,
    seed: 42n,
    stepDelayMs: -1, // disable auto timer, step manually
    gameMode: "ai_vs_ai",
  });

  let steps = 0;
  while (controller.game.winner == null && steps < 2000) {
    await controller.stepAI();
    steps++;
  }

  assert.notEqual(controller.game.winner, null, "Game finished with a winner");
  assert.ok(controller.ledger.dealCount >= 1, "Deal score was recorded in ledger");
});
