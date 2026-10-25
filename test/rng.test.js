import test from "node:test";
import assert from "node:assert/strict";
import { Rng } from "../src/engine/rng.js";

test("Rng: identical seed and purpose produce byte-identical streams", () => {
  const rng1 = Rng.stream(12345n, 0);
  const rng2 = Rng.stream(12345n, 0);
  const seq1 = Array.from({ length: 10 }, () => rng1.nextU64());
  const seq2 = Array.from({ length: 10 }, () => rng2.nextU64());
  assert.deepEqual(seq1, seq2);
});

test("Rng: different purposes produce distinct streams from same seed", () => {
  const rngDeal = Rng.stream(42n, 0);
  const rngAi = Rng.stream(42n, 1);
  assert.notEqual(rngDeal.nextU64(), rngAi.nextU64());
});

test("Rng: nextInt produces integers within [min, max)", () => {
  const rng = Rng.stream(999n, 0);
  for (let i = 0; i < 1000; i++) {
    const val = rng.nextInt(5, 15);
    assert.ok(val >= 5 && val < 15, `value ${val} out of bounds`);
  }
});

test("Rng: shuffle permutes array without losing elements", () => {
  const rng = Rng.stream(777n, 0);
  const original = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const shuffled = [...original];
  rng.shuffle(shuffled);
  assert.notDeepEqual(shuffled, original);
  assert.deepEqual([...shuffled].sort((a, b) => a - b), original);
});
