import test from "node:test";
import assert from "node:assert/strict";
import { Table3D } from "../web3d/src/table3d.js";

// Mock canvas and WebGL context for testing in Node
function createMockCanvas() {
  return {
    width: 800,
    height: 600,
    clientWidth: 800,
    clientHeight: 600,
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    getContext: (type) => {
      if (type === "webgl" || type === "webgl2") {
        return null; // Signals headless/mock mode
      }
      return null;
    },
  };
}

test("Table3D initializes and provides slot highlight and clear interface", () => {
  const canvas = createMockCanvas();
  const table = new Table3D({ canvas, headless: true });

  assert.ok(table, "Table3D instance created");
  assert.equal(typeof table.highlightSlots, "function");
  assert.equal(typeof table.clearHighlights, "function");
  assert.equal(typeof table.sync, "function");
  assert.equal(typeof table.raycast, "function");

  table.highlightSlots(["h0", "t2", "opp_r"]);
  assert.ok(table.activeHighlights.includes("h0"));
  assert.ok(table.activeHighlights.includes("t2"));
  assert.ok(table.activeHighlights.includes("opp_r"));

  table.clearHighlights();
  assert.equal(table.activeHighlights.length, 0);
});

test("Table3D sync updates internal slot card representations", () => {
  const canvas = createMockCanvas();
  const table = new Table3D({ canvas, headless: true });

  const mockState = {
    protocol: 1,
    activePlayer: 0,
    drawnCard: { code: "7H", suit: "H", rank: 7, deck: 0 },
    foundations: [
      [{ code: "AS", suit: "S", rank: 1, deck: 0 }],
      [], [], [], [], [], [], []
    ],
    tableau: [
      [{ code: "KD", suit: "D", rank: 13, deck: 0 }],
      [], [], [], [], [], [], []
    ],
    players: [
      { id: 0, reserve: [{ code: "9C", suit: "C", rank: 9, deck: 0 }], stockCount: 30, waste: [] },
      { id: 1, reserve: [{ code: "TD", suit: "D", rank: 10, deck: 1 }], stockCount: 35, waste: [] },
    ],
  };

  table.sync(mockState);
  assert.equal(table.lastSyncedState, mockState);
});
