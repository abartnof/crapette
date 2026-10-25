// Two-deck card manager (104 cards: Red and Blue) and scene objects for Crapette.
// From cassino web3d/src/deck.js @ 73f0cd7 and kit/js/deck.js.
//
// The cards as scene objects: one mesh per card, its ink line, and which face
// it shows.
//
// A card's face is assigned only when the player may know it: until then it
// shows its deck's back on both sides, so nothing in the scene can reveal a
// card the player could not see at a real table.
//
// For Crapette:
// Two full 52-card decks (104 cards in total):
// - Deck 0 (Red / Player 1 / Player 0): cards 0..51
// - Deck 1 (Blue / Player 2 / Player 1): cards 52..103
// Twin cards from different decks keep their own materials (and back art),
// so dimming an unplayable card dims only that specific card.

import { Mesh } from "three";
import { cardGeometry } from "./cards.js";
import { cardMaterials, INK, inkMaterial, RAMPS } from "./materials.js";

const SUITS = ["S", "H", "D", "C"];
const RANKS = "A23456789TJQK";

export function codeFromId(id) {
  const suitIdx = Math.floor((id % 52) / 13);
  const rankIdx = (id % 52) % 13;
  return `${RANKS[rankIdx]}${SUITS[suitIdx]}`;
}

// The ink line is also the selection language, which keeps the table free
// of glows and badges: a card pointed at takes a heavier line, a hinted one
// a cyan line, one chosen to move an amber line.
export const INKS = {
  plain: { color: INK },
  hover: { color: INK, heavier: 1.5 },
  hint: { color: "#009fb7", heavier: 1.6 },
  chosen: { color: "#e8900c", heavier: 1.6 },
};

export function createDeck(stage, textures, { inkWidth = 2.5 } = {}) {
  const geometry = cardGeometry();
  const ramp = RAMPS.card();
  const inks = {};
  for (const [name, { color, heavier = 1 }] of Object.entries(INKS)) {
    inks[name] = inkMaterial({ color, width: inkWidth * heavier });
    stage?.registerInk?.(inks[name]);
  }
  const ink = inks.plain;

  function getBackTexture(deck = 0) {
    if (deck === 0) {
      return textures.redBack ?? textures.backs?.[0] ?? textures.backs?.red ?? textures.back;
    }
    return textures.blueBack ?? textures.backs?.[1] ?? textures.backs?.blue ?? textures.back;
  }

  // Per-mesh material maps so twins (same face in Red vs Blue deck) have
  // independent materials, allowing dimming and differing back textures.
  const known = new WeakMap();
  const unknowns = new WeakMap();
  const cardMeshes = [];

  const unknownOf = (mesh) => {
    let mat = unknowns.get(mesh);
    if (!mat) {
      const back = getBackTexture(mesh.userData.deck ?? 0);
      mat = cardMaterials({ face: back, back, ramp });
      unknowns.set(mesh, mat);
    }
    return mat;
  };

  const materialsOf = (mesh, code) => {
    let byCode = known.get(mesh);
    if (!byCode) known.set(mesh, (byCode = {}));
    if (!byCode[code]) {
      const back = getBackTexture(mesh.userData.deck ?? 0);
      const face = textures.faces?.[code] ?? back;
      byCode[code] = cardMaterials({ face, back, ramp });
    }
    return byCode[code];
  };

  function card(arg = null, maybeDeck = 0) {
    let id = undefined;
    let deck = 0;
    let code = null;

    if (typeof arg === "number") {
      id = arg;
      deck = Math.floor(id / 52);
      code = codeFromId(id);
    } else if (typeof arg === "string") {
      code = arg;
      deck = maybeDeck ?? 0;
    } else if (arg && typeof arg === "object") {
      deck = arg.deck ?? (arg.id !== undefined ? Math.floor(arg.id / 52) : 0);
      id = arg.id;
      code = arg.code !== undefined ? arg.code : (id !== undefined ? codeFromId(id) : null);
    }

    const mesh = new Mesh(geometry);
    mesh.userData = { id, deck, code };
    mesh.material = code ? materialsOf(mesh, code) : unknownOf(mesh);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Ink line outline child
    const outlineMesh = new Mesh(geometry, ink);
    mesh.add(outlineMesh);

    cardMeshes.push(mesh);
    stage?.scene?.add?.(mesh);
    return mesh;
  }

  // Create the complete 104 cards double pack (0..51 Red, 52..103 Blue)
  function create104() {
    const pack = [];
    for (let id = 0; id < 104; id++) {
      const deck = id < 52 ? 0 : 1;
      const code = codeFromId(id);
      pack.push(card({ id, deck, code }));
    }
    return pack;
  }

  // Show this card's face -- or, with null, hide it again.
  function reveal(mesh, code) {
    mesh.material = code ? materialsOf(mesh, code) : unknownOf(mesh);
    mesh.userData.code = code;
  }

  // Change every face's art -- e.g. to Jumbo Index faces -- on cards where they lie.
  function setFaces(faces) {
    textures.faces = Object.assign(textures.faces || {}, faces);
    for (const mesh of cardMeshes) {
      const byCode = known.get(mesh) ?? {};
      for (const [code, materials] of Object.entries(byCode)) {
        if (textures.faces[code]) {
          materials[0].map = textures.faces[code];
          materials[0].needsUpdate = true;
        }
      }
      if (mesh.userData.code && textures.faces[mesh.userData.code] && mesh.material?.[0]) {
        mesh.material[0].map = textures.faces[mesh.userData.code];
        mesh.material[0].needsUpdate = true;
      }
    }
  }

  // Which line a card is drawn with, and whether its face is dimmed (a card
  // that may not be played).
  function decorate(mesh, { line = "plain", dim = false } = {}) {
    if (mesh.children[0] && inks[line]) {
      mesh.children[0].material = inks[line];
    }
    const code = mesh.userData?.code;
    if (code) {
      materialsOf(mesh, code)[0].color.setScalar(dim ? 0.72 : 1);
    } else if (mesh.material?.[0]) {
      mesh.material[0].color.setScalar(dim ? 0.72 : 1);
    }
  }

  return { card, create104, reveal, decorate, setFaces, geometry, ink, inks };
}

export function place(mesh, pose) {
  if (!mesh || !pose) return;
  if (pose.position) {
    mesh.position.copy(pose.position);
  } else if ("x" in pose) {
    mesh.position.set(pose.x, pose.y, pose.z);
  }
  if (pose.quaternion) {
    mesh.quaternion.copy(pose.quaternion);
  } else if ("rotX" in pose) {
    mesh.rotation.set(pose.rotX, pose.rotY ?? 0, pose.rotZ ?? 0);
  }
}
