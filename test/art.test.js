import test from "node:test";
import assert from "node:assert/strict";
import { vectorWidth, loadTextures, rasterise, decode } from "../web3d/src/art.js";

// Setup mock DOM environment for Node.js
function setupMockDOM() {
  const prevImage = globalThis.Image;
  const prevDoc = globalThis.document;
  const prevUrl = globalThis.URL;
  const prevBlob = globalThis.Blob;

  class MockImage {
    constructor() {
      this.src = "";
      this.width = 512;
      this.height = 717;
    }
    async decode() {
      return Promise.resolve();
    }
  }

  const mockCanvas = {
    width: 512,
    height: 717,
    getContext: () => ({
      fillStyle: "",
      fillRect: () => {},
      drawImage: () => {},
    }),
  };

  globalThis.Image = MockImage;
  globalThis.document = {
    createElement: (tag) => {
      if (tag === "canvas") return { ...mockCanvas };
      return {};
    },
  };
  globalThis.Blob = class MockBlob {
    constructor(parts, opts) {
      this.parts = parts;
      this.opts = opts;
    }
  };
  globalThis.URL = {
    createObjectURL: () => "blob:mock-url",
    revokeObjectURL: () => {},
  };

  return () => {
    globalThis.Image = prevImage;
    globalThis.document = prevDoc;
    globalThis.URL = prevUrl;
    globalThis.Blob = prevBlob;
  };
}

test("vectorWidth calculates width scaled by pixel ratio and capped at 1.5", () => {
  assert.equal(vectorWidth(1.0), 512);
  assert.equal(vectorWidth(1.25), Math.round(512 * 1.25));
  assert.equal(vectorWidth(1.5), 768);
  assert.equal(vectorWidth(2.0), 768, "capped at 1.5x (768px)");
  assert.equal(vectorWidth(3.0), 768, "capped at 1.5x (768px)");
  assert.equal(vectorWidth(0.5), 512, "floored at 1.0x (512px)");
});

test("decode resolves data URI to Three.js Texture", async () => {
  const cleanup = setupMockDOM();
  try {
    const tex = await decode("data:image/webp;base64,mock");
    assert.ok(tex);
    assert.ok(tex.image);
  } finally {
    cleanup();
  }
});

test("rasterise renders SVG to Three.js CanvasTexture", async () => {
  const cleanup = setupMockDOM();
  try {
    const tex = await rasterise("<svg></svg>", 512);
    assert.ok(tex);
    assert.ok(tex.isCanvasTexture);
  } finally {
    cleanup();
  }
});

test("loadTextures processes 52 faces and both red and blue deck backs", async () => {
  const cleanup = setupMockDOM();
  try {
    const mockArt = {
      "2C": "data:image/webp;base64,2C",
      "AS": "data:image/webp;base64,AS",
      "back": "data:image/webp;base64,back",
      "back-red": "data:image/webp;base64,backRed",
      "back-blue": "data:image/webp;base64,backBlue",
    };

    const result = await loadTextures(mockArt, { anisotropy: 4, pixelRatio: 1.0 });

    assert.ok(result, "returns loadTextures result");
    assert.ok(result.faces, "contains faces map");
    assert.ok(result.faces["2C"], "contains 2C face");
    assert.ok(result.faces["AS"], "contains AS face");
    assert.equal(result.faces.back, undefined, "back is removed from faces map");
    assert.equal(result.faces["back-red"], undefined, "back-red is removed from faces map");
    assert.equal(result.faces["back-blue"], undefined, "back-blue is removed from faces map");

    // Dual-deck back support for Crapette
    assert.ok(result.backRed, "result.backRed exists");
    assert.ok(result.backBlue, "result.backBlue exists");
    assert.ok(result.backs, "result.backs exists");
    assert.equal(result.backs.red, result.backRed);
    assert.equal(result.backs.blue, result.backBlue);

    // Fallback back texture
    assert.ok(result.back, "result.back fallback exists");

    // Metadata
    assert.equal(result.vector, false);
    assert.equal(result.width, null);
    assert.ok(result.ms >= 0);
  } finally {
    cleanup();
  }
});

test("loadTextures falls back to default back when specific deck backs are missing", async () => {
  const cleanup = setupMockDOM();
  try {
    const mockArt = {
      "KH": "data:image/webp;base64,KH",
      "back": "data:image/webp;base64,backDefault",
    };

    const result = await loadTextures(mockArt);
    assert.ok(result.back);
    assert.equal(result.backRed, result.back, "backRed falls back to back");
    assert.equal(result.backBlue, result.back, "backBlue falls back to back");
    assert.equal(result.backs.red, result.back);
    assert.equal(result.backs.blue, result.back);
  } finally {
    cleanup();
  }
});
