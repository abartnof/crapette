import test from "node:test";
import assert from "node:assert/strict";
import { InteractionController } from "../web3d/src/interaction.js";

// Mock Table3D interface for interaction tests
class MockTable3D {
  constructor() {
    this.highlighted = [];
    this.cleared = false;
  }

  highlightSlots(slots) {
    this.highlighted = [...slots];
    this.cleared = false;
  }

  clearHighlights() {
    this.highlighted = [];
    this.cleared = true;
  }
}

function createTestState() {
  return {
    protocol: 1,
    activePlayer: 0,
    drawnCard: null,
    legal: [
      "draw",
      "m r>h0",
      "m r>h",
      "m r>t2",
      "m t1>t4",
      "m t1>opp_r",
    ],
  };
}

test("InteractionController computes legal destinations and highlights slots on card selection", () => {
  const table = new MockTable3D();
  let state = createTestState();
  const moves = [];

  const interaction = new InteractionController({
    table,
    getGameState: () => state,
    onMove: (src, dst) => moves.push({ src, dst }),
  });

  // Clicking Reserve top card 'r'
  interaction.handleCardClick({ sourceSlot: "r", cardCode: "AS" });

  assert.equal(interaction.selectedSource, "r");
  assert.deepEqual(interaction.legalDestinations.sort(), ["h", "h0", "t2"].sort());
  assert.ok(table.highlighted.includes("h0"));
  assert.ok(table.highlighted.includes("t2"));

  // Clicking an unhighlighted invalid slot does not move
  interaction.handleSlotClick("t7");
  assert.equal(moves.length, 0);

  // Clicking highlighted slot "t2" executes the move
  interaction.handleSlotClick("t2");
  assert.equal(moves.length, 1);
  assert.deepEqual(moves[0], { src: "r", dst: "t2" });
  assert.equal(interaction.selectedSource, null);
  assert.equal(table.cleared, true);
});

test("InteractionController deselects when clicking the same card again", () => {
  const table = new MockTable3D();
  let state = createTestState();

  const interaction = new InteractionController({
    table,
    getGameState: () => state,
    onMove: () => {},
  });

  interaction.handleCardClick({ sourceSlot: "r", cardCode: "AS" });
  assert.equal(interaction.selectedSource, "r");

  interaction.handleCardClick({ sourceSlot: "r", cardCode: "AS" });
  assert.equal(interaction.selectedSource, null);
  assert.equal(table.cleared, true);
});

test("InteractionController double-clicking eligible card auto-plays to foundation", () => {
  const table = new MockTable3D();
  let state = createTestState();
  const moves = [];

  const interaction = new InteractionController({
    table,
    getGameState: () => state,
    onMove: (src, dst) => moves.push({ src, dst }),
  });

  // Double click reserve card 'r' which can go to foundation 'h'
  interaction.handleCardDoubleClick({ sourceSlot: "r", cardCode: "AS" });
  assert.equal(moves.length, 1);
  assert.equal(moves[0].src, "r");
  assert.ok(moves[0].dst === "h" || moves[0].dst === "h0");
});

test("InteractionController drag-and-drop moves card to valid drop slot", () => {
  const table = new MockTable3D();
  let state = createTestState();
  const moves = [];

  const interaction = new InteractionController({
    table,
    getGameState: () => state,
    onMove: (src, dst) => moves.push({ src, dst }),
  });

  // Start dragging card at t1
  interaction.handleDragStart({ sourceSlot: "t1", cardCode: "8S" });
  assert.equal(interaction.draggedSource, "t1");
  assert.ok(table.highlighted.includes("t4"));
  assert.ok(table.highlighted.includes("opp_r"));

  // Drop on valid slot 'opp_r'
  interaction.handleDragEnd("opp_r");
  assert.equal(moves.length, 1);
  assert.deepEqual(moves[0], { src: "t1", dst: "opp_r" });
  assert.equal(interaction.draggedSource, null);
  assert.equal(table.cleared, true);
});

test("InteractionController drag-and-drop cancels on invalid drop slot", () => {
  const table = new MockTable3D();
  let state = createTestState();
  const moves = [];

  const interaction = new InteractionController({
    table,
    getGameState: () => state,
    onMove: (src, dst) => moves.push({ src, dst }),
  });

  interaction.handleDragStart({ sourceSlot: "t1", cardCode: "8S" });
  interaction.handleDragEnd("t0"); // Not in legal destinations
  assert.equal(moves.length, 0);
  assert.equal(interaction.draggedSource, null);
  assert.equal(table.cleared, true);
});

test("InteractionController clicking or tapping Stock pile triggers onDraw", () => {
  const table = new MockTable3D();
  let state = createTestState();
  let draws = 0;

  const interaction = new InteractionController({
    table,
    getGameState: () => state,
    onDraw: () => { draws += 1; },
  });

  // Clicking stock card directly
  interaction.handleCardClick({ sourceSlot: "s", cardCode: "BACK" });
  assert.equal(draws, 1);

  // Clicking stock slot
  interaction.handleSlotClick("s");
  assert.equal(draws, 2);

  // Clicking player 0 stock alias "s0"
  interaction.handleCardClick({ sourceSlot: "s0", cardCode: "BACK" });
  assert.equal(draws, 3);
});

test("InteractionController clicking or tapping Waste pile with drawn card triggers onWaste", () => {
  const table = new MockTable3D();
  let state = {
    ...createTestState(),
    drawnCard: { code: "5D", suit: "D", rank: 5, deck: 0 },
    legal: ["waste", "m drawn>t3"],
  };
  let wastes = 0;

  const interaction = new InteractionController({
    table,
    getGameState: () => state,
    onWaste: () => { wastes += 1; },
  });

  // Clicking waste pile directly
  interaction.handleCardClick({ sourceSlot: "w", cardCode: "9C" });
  assert.equal(wastes, 1);

  // Clicking waste slot
  interaction.handleSlotClick("w");
  assert.equal(wastes, 2);

  // Dragging drawn card to waste slot triggers onWaste
  interaction.handleDragStart({ sourceSlot: "drawn", cardCode: "5D" });
  assert.equal(interaction.draggedSource, "drawn");
  interaction.handleDragEnd("w");
  assert.equal(wastes, 3);
  assert.equal(interaction.draggedSource, null);
});
