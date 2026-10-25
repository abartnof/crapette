// Card art and texture loader for Crapette.
// Adapted from cassino web3d/src/art.js @ 73f0cd7, supporting dual-deck card backs
// (Royal Crimson for Player 1, Midnight Navy for Player 2).

import { CanvasTexture, Texture } from "three";
import { cardTexture } from "./materials.js";

const ASPECT = 7 / 5;

// Wide enough for a card in the hand on a sharp screen; capped because card
// textures with mipmaps take significant GPU memory.
export function vectorWidth(pixelRatio) {
  return Math.round(512 * Math.min(Math.max(pixelRatio, 1), 1.5));
}

export async function rasterise(svg, width) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = Math.round(width * ASPECT);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; // white matte behind the raster art
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return new CanvasTexture(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function decode(uri) {
  const image = new Image();
  image.src = uri;
  await image.decode();
  return new Texture(image);
}

export async function loadTextures(art, { anisotropy = 1, pixelRatio = 1 } = {}) {
  const started = performance.now();
  const width = vectorWidth(pixelRatio);
  const entries = await Promise.all(
    Object.entries(art).map(async ([name, source]) => {
      const texture = source.startsWith("<svg") ? await rasterise(source, width) : await decode(source);
      return [name, cardTexture(texture, anisotropy)];
    }),
  );
  const textures = Object.fromEntries(entries);

  // Dual-deck card back resolution for Crapette:
  // Player 1 (Red / Crimson deck), Player 2 (Blue / Navy deck), with fallback to generic back.
  const back = textures.back || textures["back-blue"] || textures["back-red"] || null;
  const backRed = textures["back-red"] || textures.backRed || back;
  const backBlue = textures["back-blue"] || textures.backBlue || back;

  // Clean back textures from faces dictionary
  delete textures.back;
  delete textures["back-red"];
  delete textures["back-blue"];
  delete textures.backRed;
  delete textures.backBlue;

  const firstVal = Object.values(art)[0];
  const vector = typeof firstVal === "string" && firstVal.startsWith("<svg");

  return {
    faces: textures,
    back,
    backRed,
    backBlue,
    backs: {
      red: backRed,
      blue: backBlue,
    },
    vector,
    width: vector ? width : null,
    ms: performance.now() - started,
  };
}
