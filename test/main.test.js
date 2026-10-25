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
    this.hints = [];
    this.tutorials = [];
    this.mode = null;
    this.skill = null;
    this.muted = false;
  }
  render(state, ledger) {
    this.rendered.push({ state, ledger });
  }
  showToast(msg) {
    this.toasts.push(msg);
  }
  showHintModal(hint) {
    this.hints.push(hint);
  }
  hideHintModal() {}
  showTutorialModal(page) {
    this.tutorials.push(page);
  }
  hideTutorialModal() {}
  setMuted(m) { this.muted = m; }
  setSkill(s) { this.skill = s; }
  setMode(m) { this.mode = m; }
}

class MockTable {
  constructor() {
    this.synced = [];
    this.highlights = [];
    this.felt = null;
  }
  sync(state) {
    this.synced.push(state);
  }
  highlightSlots(slots) {
    this.highlights = [...slots];
  }
  clearHighlights() {
    this.highlights = [];
  }
  setFelt(felt) {
    this.felt = felt;
  }
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

test("GameController requestHint generates ZPD hint, shows modal, and highlights slots", () => {
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

  controller.requestHint();

  assert.equal(hud.hints.length, 1, "Hint modal was shown");
  const hint = hud.hints[0];
  assert.ok(hint.headline || hint.what, "Hint has headline or action");
  assert.ok(hint.rule, "Hint has pedagogical rule reminder");
  assert.ok(hint.tension, "Hint has strategic tension");
  assert.ok(table.highlights.length > 0, "Target slots were highlighted");
});

test("GameController triggers progressive tutorial popups when feature appears", () => {
  const sound = new MockSound();
  const hud = new MockHUD();
  const table = new MockTable();

  const controller = new GameController({
    sound,
    hud,
    table,
    seed: 12345n,
    stepDelayMs: 0,
    tutorial: true,
  });

  // Deal start triggers the intro tutorial page
  assert.ok(hud.tutorials.length >= 1, "Tutorial page was popped up for new player");
  assert.equal(hud.tutorials[0].key, "intro");
});

test("GameController startNewGame configures game parameters and resets state", () => {
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

  controller.startNewGame({
    mode: "ai_vs_ai",
    rules: "casual",
    skill: 2.5,
    tutorial: false,
    hints: true,
    seed: "99999",
  });

  assert.equal(controller.gameMode, "ai_vs_ai");
  assert.equal(controller.mode, "casual");
  assert.equal(controller.skill, 2.5);
  assert.equal(controller.tutorialEnabled, false);
  assert.equal(controller.hintsEnabled, true);
  assert.equal(controller.seed, 99999n);
});

test("GameController changeFelt updates table felt design", () => {
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

  controller.changeFelt("slate");
  assert.equal(table.felt, "slate");
});
