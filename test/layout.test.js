import test from "node:test";
import assert from "node:assert/strict";
import { CrapetteGame } from "../src/engine/game.js";
import {
  CARD,
  RISE,
  LIFT,
  slotPositions,
  hitSlot,
  layout,
  cardPose,
} from "../web3d/src/layout.js";

test("CARD units and constants", () => {
  assert.equal(CARD.width, 6.35);
  assert.equal(CARD.height, 8.89);
  assert.equal(CARD.thickness, 0.03);
  assert.ok(RISE > 0 && RISE < 0.1);
  assert.ok(LIFT >= 2.0);
});

test("slotPositions: contains all 22 slots with valid coordinates and bounds", () => {
  const slots = slotPositions(16 / 9);

  // Check 8 foundations
  for (let i = 0; i < 8; i++) {
    const key = `h${i}`;
    assert.ok(slots[key], `Missing foundation slot ${key}`);
    assert.equal(slots[key].id, key);
    assert.ok(typeof slots[key].x === "number");
    assert.ok(typeof slots[key].z === "number");
    assert.ok(slots[key].bounds);
    assert.ok(slots[key].bounds.minX < slots[key].bounds.maxX);
    assert.ok(slots[key].bounds.minZ < slots[key].bounds.maxZ);
  }

  // Check 8 tableau
  for (let i = 0; i < 8; i++) {
    const key = `t${i}`;
    assert.ok(slots[key], `Missing tableau slot ${key}`);
    assert.equal(slots[key].id, key);
  }

  // Check Player 0 zones
  assert.ok(slots.r, "Missing Player 0 reserve slot 'r'");
  assert.ok(slots.s, "Missing Player 0 stock slot 's'");
  assert.ok(slots.w, "Missing Player 0 waste slot 'w'");

  // Check Player 1 zones
  assert.ok(slots.opp_r, "Missing Player 1 reserve slot 'opp_r'");
  assert.ok(slots.opp_s, "Missing Player 1 stock slot 'opp_s'");
  assert.ok(slots.opp_w, "Missing Player 1 waste slot 'opp_w'");
});

test("Foundation layout symmetry: central 2 columns of 4 rows", () => {
  const slots = slotPositions(16 / 9);

  // h0..h3 are left column (-x), h4..h7 are right column (+x)
  for (let i = 0; i < 4; i++) {
    const left = slots[`h${i}`];
    const right = slots[`h${i + 4}`];

    assert.ok(left.x < 0, `Foundation h${i} should be on the left (-x)`);
    assert.ok(right.x > 0, `Foundation h${i + 4} should be on the right (+x)`);

    // Reflection symmetry across x=0
    assert.ok(Math.abs(left.x + right.x) < 1e-4, `Foundation h${i} and h${i + 4} should mirror across x=0`);
    assert.ok(Math.abs(left.z - right.z) < 1e-4, `Foundation h${i} and h${i + 4} should share z coordinate`);
  }

  // Vertical row symmetry across z=0
  // row 0 vs row 3, row 1 vs row 2
  assert.ok(Math.abs(slots.h0.z + slots.h3.z) < 1e-4, "h0 and h3 should be symmetric across z=0");
  assert.ok(Math.abs(slots.h1.z + slots.h2.z) < 1e-4, "h1 and h2 should be symmetric across z=0");

  // 180-degree rotational symmetry around (0,0)
  assert.ok(Math.abs(slots.h0.x + slots.h7.x) < 1e-4);
  assert.ok(Math.abs(slots.h0.z + slots.h7.z) < 1e-4);
});

test("Tableau layout: t0..t3 on left cascading left; t4..t7 on right cascading right", () => {
  const game = new CrapetteGame({ seed: 1n });
  const s = game.state();
  // Clear any duplicates and place unique cards in tableau 0 and tableau 4
  s.tableau[0] = [
    { deck: 0, suit: "S", rank: 10, code: "TS", id: 1000 },
    { deck: 1, suit: "H", rank: 9, code: "9H", id: 1001 },
    { deck: 0, suit: "C", rank: 8, code: "8C", id: 1002 },
  ];
  s.tableau[4] = [
    { deck: 1, suit: "D", rank: 10, code: "TD", id: 1003 },
    { deck: 0, suit: "S", rank: 9, code: "9S", id: 1004 },
  ];

  const lay = layout(s, 16 / 9);

  // Left tableau t0 cascading outward to the left (decreasing x)
  const p0 = lay.poses[1000];
  const p1 = lay.poses[1001];
  const p2 = lay.poses[1002];

  assert.ok(p0.x < 0, "t0 base should have negative x");
  assert.ok(p1.x < p0.x, "t0 card 1 must cascade outward to the left (p1.x < p0.x)");
  assert.ok(p2.x < p1.x, "t0 card 2 must cascade outward to the left (p2.x < p1.x)");
  assert.ok(p1.y > p0.y, "Card higher in cascade must have higher y");
  assert.ok(p2.y > p1.y, "Card higher in cascade must have higher y");
  assert.equal(p0.z, p1.z, "Cascading cards share row z");
  assert.equal(p1.z, p2.z, "Cascading cards share row z");

  // Right tableau t4 cascading outward to the right (increasing x)
  const p4_0 = lay.poses[1003];
  const p4_1 = lay.poses[1004];

  assert.ok(p4_0.x > 0, "t4 base should have positive x");
  assert.ok(p4_1.x > p4_0.x, "t4 card 1 must cascade outward to the right (p4_1.x > p4_0.x)");
  assert.ok(p4_1.y > p4_0.y, "Card higher in cascade must have higher y");
});

test("Player 0 and Player 1 slot symmetry and card poses", () => {
  const slots = slotPositions(16 / 9);

  // Player 0 (Human at +z facing -z):
  // Reserve on human's right (+x, +z)
  assert.ok(slots.r.x > 0 && slots.r.z > 0, "Player 0 reserve must be at +x, +z");
  // Stock on human's left (-x, +z)
  assert.ok(slots.s.x < 0 && slots.s.z > 0, "Player 0 stock must be at -x, +z");
  // Waste to the right of stock (larger x than stock, +z)
  assert.ok(slots.w.x > slots.s.x && slots.w.z > 0, "Player 0 waste must be to the right of stock");

  // Player 1 (Opponent at -z facing +z):
  // Reserve on opponent's right (-x, -z)
  assert.ok(slots.opp_r.x < 0 && slots.opp_r.z < 0, "Player 1 reserve must be at -x, -z");
  // Stock on opponent's left (+x, -z)
  assert.ok(slots.opp_s.x > 0 && slots.opp_s.z < 0, "Player 1 stock must be at +x, -z");
  // Waste to the right of opponent stock (from opp POV facing +z, to the right is -x direction, so smaller x than opp stock)
  assert.ok(slots.opp_w.x < slots.opp_s.x && slots.opp_w.z < 0, "Player 1 waste must be to the right of opponent stock");

  // 180° Rotational symmetry between Player 0 and Player 1
  assert.ok(Math.abs(slots.r.x + slots.opp_r.x) < 1e-4);
  assert.ok(Math.abs(slots.r.z + slots.opp_r.z) < 1e-4);
  assert.ok(Math.abs(slots.s.x + slots.opp_s.x) < 1e-4);
  assert.ok(Math.abs(slots.s.z + slots.opp_s.z) < 1e-4);
  assert.ok(Math.abs(slots.w.x + slots.opp_w.x) < 1e-4);
  assert.ok(Math.abs(slots.w.z + slots.opp_w.z) < 1e-4);
});

test("Full game state layout computes poses for all 104 cards", () => {
  const game = new CrapetteGame({ seed: 999n });
  const s = game.state();

  const lay = layout(s, 16 / 9);
  assert.ok(lay.poses);

  // Total cards in crapette = 104
  const ids = Object.keys(lay.poses);
  assert.equal(ids.length, 104, "Must lay out all 104 cards");

  for (let id = 0; id < 104; id++) {
    const pose = lay.poses[id];
    assert.ok(pose, `Card id ${id} must have a pose`);
    assert.ok(!Number.isNaN(pose.x), `x must be valid for ${id}`);
    assert.ok(!Number.isNaN(pose.y), `y must be valid for ${id}`);
    assert.ok(!Number.isNaN(pose.z), `z must be valid for ${id}`);
    assert.ok(!Number.isNaN(pose.rotX), `rotX must be valid for ${id}`);
    assert.ok(!Number.isNaN(pose.rotY), `rotY must be valid for ${id}`);
    assert.ok(!Number.isNaN(pose.rotZ), `rotZ must be valid for ${id}`);
    assert.equal(typeof pose.faceUp, "boolean");
  }

  // Check reserve cards: 12 face down, top face up
  const p0Reserve = s.players[0].reserve;
  assert.equal(p0Reserve.length, 13);
  for (let i = 0; i < 12; i++) {
    assert.equal(lay.poses[p0Reserve[i].id].faceUp, false, `Reserve card ${i} should be face down`);
  }
  assert.equal(lay.poses[p0Reserve[12].id].faceUp, true, "Top reserve card must be face up");

  // Check stock cards: all face down
  for (const card of s.players[0].stock) {
    assert.equal(lay.poses[card.id].faceUp, false, "Stock card should be face down");
  }
});

test("Drawn card floats with LIFT in front of stock/waste", () => {
  const game = new CrapetteGame({ seed: 42n });
  game.send("draw"); // Active player draws
  const s = game.state();
  assert.ok(s.drawnCard);

  const lay = layout(s, 16 / 9);
  const drawnPose = lay.poses[s.drawnCard.id];
  assert.ok(drawnPose);
  assert.ok(drawnPose.y >= LIFT, "Drawn card y should be >= LIFT");
  assert.equal(drawnPose.faceUp, true, "Drawn card must be face up");
});

test("hitSlot: picks the right slot from table plane coordinates", () => {
  const slots = slotPositions(16 / 9);

  // Exact center of h0
  const hitH0 = hitSlot(slots, slots.h0.x, slots.h0.z);
  assert.equal(hitH0?.id, "h0");

  // Exact center of r
  const hitR = hitSlot(slots, slots.r.x, slots.r.z);
  assert.equal(hitR?.id, "r");

  // Near corner within bounds
  const hitW = hitSlot(slots, slots.w.x + 1.0, slots.w.z + 1.0);
  assert.equal(hitW?.id, "w");

  // Far off table
  const hitNone = hitSlot(slots, 200, 200);
  assert.equal(hitNone, null);
});
