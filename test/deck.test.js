import test from "node:test";
import assert from "node:assert/strict";
import { Mesh, Texture, Vector3, Quaternion } from "three";
import { INKS, createDeck, place } from "../web3d/src/deck.js";
import { INK } from "../web3d/src/materials.js";

function createMockTextures() {
  const redBack = new Texture();
  redBack.name = "redBack";
  const blueBack = new Texture();
  blueBack.name = "blueBack";

  const faces = {};
  const suits = ["S", "H", "D", "C"];
  const ranks = "A23456789TJQK";
  for (const s of suits) {
    for (const r of ranks) {
      const tex = new Texture();
      tex.name = `${r}${s}`;
      faces[`${r}${s}`] = tex;
    }
  }

  return { redBack, blueBack, faces };
}

function createMockStage() {
  const sceneCards = [];
  const registeredInks = [];
  return {
    scene: {
      add: (mesh) => sceneCards.push(mesh),
      children: sceneCards,
    },
    registerInk: (mat) => registeredInks.push(mat),
    sceneCards,
    registeredInks,
  };
}

test("INKS definition contains plain, hover, hint, and chosen inks", () => {
  assert.equal(INKS.plain.color, INK);
  assert.equal(INKS.hover.heavier, 1.5);
  assert.equal(INKS.hint.color, "#009fb7");
  assert.equal(INKS.hint.heavier, 1.6);
  assert.equal(INKS.chosen.color, "#e8900c");
  assert.equal(INKS.chosen.heavier, 1.6);
});

test("createDeck creates deck manager and registers selection inks with stage", () => {
  const stage = createMockStage();
  const textures = createMockTextures();
  const deck = createDeck(stage, textures);

  assert.equal(typeof deck.card, "function");
  assert.equal(typeof deck.create104, "function");
  assert.equal(typeof deck.reveal, "function");
  assert.equal(typeof deck.decorate, "function");
  assert.equal(typeof deck.setFaces, "function");
  assert.ok(deck.geometry);
  assert.ok(deck.ink);
  assert.equal(stage.registeredInks.length, 4);
});

test("cards support Crapette's two decks: Red deck 0 and Blue deck 1", () => {
  const stage = createMockStage();
  const textures = createMockTextures();
  const deck = createDeck(stage, textures);

  // Deck 0 (Red)
  const redCard = deck.card({ id: 0, deck: 0, code: "AH" });
  assert.equal(redCard.userData.deck, 0);
  assert.equal(redCard.userData.id, 0);
  assert.equal(redCard.userData.code, "AH");
  assert.equal(redCard.material[0].map, textures.faces["AH"]); // face
  assert.equal(redCard.material[1].map, textures.redBack); // back

  // Deck 1 (Blue)
  const blueCard = deck.card({ id: 52, deck: 1, code: "AH" });
  assert.equal(blueCard.userData.deck, 1);
  assert.equal(blueCard.userData.id, 52);
  assert.equal(blueCard.userData.code, "AH");
  assert.equal(blueCard.material[0].map, textures.faces["AH"]); // face
  assert.equal(blueCard.material[1].map, textures.blueBack); // back
});

test("face-down unknown card shows its own deck back on both sides", () => {
  const stage = createMockStage();
  const textures = createMockTextures();
  const deck = createDeck(stage, textures);

  const unknownRed = deck.card({ deck: 0, code: null });
  assert.equal(unknownRed.material[0].map, textures.redBack);
  assert.equal(unknownRed.material[1].map, textures.redBack);

  const unknownBlue = deck.card({ deck: 1, code: null });
  assert.equal(unknownBlue.material[0].map, textures.blueBack);
  assert.equal(unknownBlue.material[1].map, textures.blueBack);
});

test("reveal toggles face visibility on card mesh", () => {
  const stage = createMockStage();
  const textures = createMockTextures();
  const deck = createDeck(stage, textures);

  const card = deck.card({ deck: 0, code: null });
  assert.equal(card.material[0].map, textures.redBack);

  deck.reveal(card, "KS");
  assert.equal(card.material[0].map, textures.faces["KS"]);
  assert.equal(card.userData.code, "KS");

  deck.reveal(card, null);
  assert.equal(card.material[0].map, textures.redBack);
  assert.equal(card.userData.code, null);
});

test("decorate updates ink outline and dims unplayable cards independently of twin", () => {
  const stage = createMockStage();
  const textures = createMockTextures();
  const deck = createDeck(stage, textures);

  const cardA = deck.card({ deck: 0, code: "7D" });
  const cardB = deck.card({ deck: 1, code: "7D" }); // Twin card from Blue deck

  // Outline line changes
  deck.decorate(cardA, { line: "hover" });
  assert.equal(cardA.children[0].material, deck.inks.hover);

  deck.decorate(cardA, { line: "hint" });
  assert.equal(cardA.children[0].material, deck.inks.hint);

  deck.decorate(cardA, { line: "chosen" });
  assert.equal(cardA.children[0].material, deck.inks.chosen);

  // Dim cardA
  deck.decorate(cardA, { dim: true });
  assert.equal(cardA.material[0].color.r, 0.72);

  // cardB (twin) remains undimmed!
  assert.equal(cardB.material[0].color.r, 1.0);

  // Undim cardA
  deck.decorate(cardA, { dim: false });
  assert.equal(cardA.material[0].color.r, 1.0);
});

test("create104 creates exactly 104 cards: 52 red (deck 0) and 52 blue (deck 1)", () => {
  const stage = createMockStage();
  const textures = createMockTextures();
  const deck = createDeck(stage, textures);

  const cards = deck.create104();
  assert.equal(cards.length, 104);

  for (let i = 0; i < 104; i++) {
    const c = cards[i];
    assert.equal(c.userData.id, i);
    const expectedDeck = i < 52 ? 0 : 1;
    assert.equal(c.userData.deck, expectedDeck);
    assert.ok(c.userData.code);
    assert.equal(c.children.length, 1, "outline mesh attached");
  }

  const redCount = cards.filter((c) => c.userData.deck === 0).length;
  const blueCount = cards.filter((c) => c.userData.deck === 1).length;
  assert.equal(redCount, 52);
  assert.equal(blueCount, 52);
});

test("setFaces swaps face textures across meshes", () => {
  const stage = createMockStage();
  const textures = createMockTextures();
  const deck = createDeck(stage, textures);

  const card = deck.card({ deck: 0, code: "AH" });
  const newFace = new Texture();
  newFace.name = "jumbo_AH";

  deck.setFaces({ AH: newFace });
  assert.equal(card.material[0].map, newFace);
});

test("place positions and orients card meshes", () => {
  const mesh = new Mesh();

  // Position + quaternion
  const poseA = {
    position: new Vector3(10, 2, -5),
    quaternion: new Quaternion(0, 0, 0, 1),
  };
  place(mesh, poseA);
  assert.equal(mesh.position.x, 10);
  assert.equal(mesh.position.y, 2);
  assert.equal(mesh.position.z, -5);

  // Crapette coordinates: x, y, z, rotX, rotY, rotZ
  const poseB = {
    x: -12,
    y: 0.5,
    z: 20,
    rotX: -Math.PI / 2,
    rotY: Math.PI,
    rotZ: 0,
  };
  place(mesh, poseB);
  assert.equal(mesh.position.x, -12);
  assert.equal(mesh.position.y, 0.5);
  assert.equal(mesh.position.z, 20);
  assert.equal(mesh.rotation.x, -Math.PI / 2);
  assert.equal(mesh.rotation.y, Math.PI);
});
