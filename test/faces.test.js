import test from "node:test";
import assert from "node:assert/strict";
import {
  largeTextByDefault,
  facesFor,
  rankAndSuit,
  drawJumbo,
  jumboTextures,
  JUMBO,
} from "../web3d/src/faces.js";

// A 2D context recorder that simulates canvas text measurement
function recorder() {
  const calls = [];
  let font = "";
  const ctx = {
    calls,
    fillStyle: "",
    textAlign: "",
    textBaseline: "",
    set font(f) {
      font = f;
    },
    get font() {
      return font;
    },
    measureText(text) {
      const size = Number(font.match(/([\d.]+)px/)?.[1] || 100);
      return {
        actualBoundingBoxAscent: 0.7 * size,
        actualBoundingBoxDescent: 0.1 * size,
        actualBoundingBoxLeft: 0,
        actualBoundingBoxRight: 0.8 * size * [...text.replace(/\uFE0E/g, "")].length,
      };
    },
    fillRect: (...a) => calls.push(["fillRect", ...a, ctx.fillStyle]),
    fillText: (text, x, y, maxWidth) => calls.push(["fillText", text, x, y, font, ctx.fillStyle, maxWidth]),
    save: () => calls.push(["save"]),
    restore: () => calls.push(["restore"]),
    translate: (x, y) => calls.push(["translate", x, y]),
    scale: (x, y) => calls.push(["scale", x, y]),
    rotate: (a) => calls.push(["rotate", a]),
  };
  return ctx;
}

test("largeTextByDefault activates on touch devices and tablets", () => {
  assert.ok(largeTextByDefault({ coarse: true }), "touch coarse pointer");
  assert.ok(largeTextByDefault({ coarse: true, mac: false, touchPoints: 5 }), "iPad / tablet");
  assert.ok(largeTextByDefault({ coarse: false, mac: true, touchPoints: 5 }), "iPad desktop mode");
  assert.ok(!largeTextByDefault({ coarse: false, mac: true, touchPoints: 0 }), "Mac laptop");
  assert.ok(!largeTextByDefault({ coarse: false, mac: false, touchPoints: 0 }), "Desktop PC");
});

test("facesFor handles auto preference and respects manual selection", () => {
  assert.equal(facesFor("auto", true), "jumbo");
  assert.equal(facesFor("auto", false), "classic");
  assert.equal(facesFor(undefined, true), "jumbo");
  assert.equal(facesFor("classic", true), "classic");
  assert.equal(facesFor("classic", false), "classic");
  assert.equal(facesFor("jumbo", true), "jumbo");
  assert.equal(facesFor("jumbo", false), "jumbo");
});

test("rankAndSuit extracts rank symbol (converting T to 10) and suit", () => {
  assert.deepEqual(rankAndSuit("TH"), ["10", "H"]);
  assert.deepEqual(rankAndSuit("AS"), ["A", "S"]);
  assert.deepEqual(rankAndSuit("7D"), ["7", "D"]);
  assert.deepEqual(rankAndSuit("QC"), ["Q", "C"]);
  assert.deepEqual(rankAndSuit("2S"), ["2", "S"]);
});

test("drawJumbo paints paper background covering the full card area", () => {
  const ctx = recorder();
  drawJumbo(ctx, 500, "QH");
  const [[call, x, y, w, h, fill]] = ctx.calls;
  assert.deepEqual([call, x, y, w], ["fillRect", 0, 0, 500]);
  assert.ok(Math.abs(h - 700) < 1e-9, `card height is 5:7 ratio (${h})`);
  assert.equal(fill, JUMBO.paper);
});

test("drawJumbo renders corner and large body rank and suit", () => {
  const ctx = recorder();
  drawJumbo(ctx, 500, "TH");
  const textCalls = ctx.calls.filter((c) => c[0] === "fillText");
  assert.equal(textCalls.length, 4, "corner rank+suit and large center rank+suit");
  assert.deepEqual(textCalls.map((t) => t[1]), ["10", "♥︎", "10", "♥︎"]);
  for (const t of textCalls) {
    assert.equal(t[5], JUMBO.red, "hearts drawn in red ink");
  }
});

test("drawJumbo uses ink colour for spades and clubs", () => {
  const ctx = recorder();
  drawJumbo(ctx, 500, "AS");
  const textCalls = ctx.calls.filter((c) => c[0] === "fillText");
  assert.deepEqual(textCalls.map((t) => t[1]), ["A", "♠︎", "A", "♠︎"]);
  for (const t of textCalls) {
    assert.equal(t[5], JUMBO.ink, "spades drawn in dark ink");
  }
});

test("jumboTextures creates a texture dictionary for all requested card codes", () => {
  const prevDoc = globalThis.document;
  const createdCanvases = [];

  globalThis.document = {
    createElement: (tag) => {
      if (tag === "canvas") {
        const ctx = recorder();
        const canvas = {
          width: 0,
          height: 0,
          getContext: () => ctx,
        };
        createdCanvases.push(canvas);
        return canvas;
      }
      return {};
    },
  };

  try {
    const codes = ["AS", "KH", "2D", "TC"];
    const textures = jumboTextures(codes, { width: 512, anisotropy: 2 });

    assert.equal(Object.keys(textures).length, 4);
    for (const code of codes) {
      assert.ok(textures[code], `texture created for ${code}`);
      assert.ok(textures[code].isCanvasTexture);
      assert.equal(textures[code].anisotropy, 2);
    }
  } finally {
    globalThis.document = prevDoc;
  }
});
