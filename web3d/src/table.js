// The Three.js 3D table for Crapette (Russian Bank)
//
// Features:
// - 104 cel-shaded card meshes (Deck 0: Royal Crimson, Deck 1: Midnight Navy)
// - Cel shading with MeshToonMaterial and ink line inverted-hull outlines
// - Felt table mesh, mahogany wood rim, soft shadows, directional & hemisphere lights
// - Canvas 2D generated dual deck card backs (Red for Player 0, Blue for Player 1)
// - Smooth kinematic card animation using parabolic hops and minimum jerk easing
// - Raycasting for card picking and slot drop target detection
// - Slot and card highlight & hover states

import {
  BoxGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  Euler,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  Quaternion,
  Raycaster,
  Scene,
  ShadowMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";

import { cardGeometry } from "../../kit/js/cards.js";
import { CARD, LIFT, RISE, layout, slotPositions, hitSlot } from "./layout.js";
import { cardMaterials, cardTexture, inkMaterial, INK, RAMPS } from "../../kit/js/materials.js";
import { jumboTextures } from "../../kit/js/faces.js";
import { minimumJerk } from "../../kit/js/easing.js";

export const SUITS = ["S", "H", "D", "C"];
export const RANKS = "A23456789TJQK";
export const CODES = SUITS.flatMap((s) => [...RANKS].map((r) => r + s));

export const COLORS = Object.freeze({
  redBack: "#9c1b26",    // Royal Crimson (Player 0)
  blueBack: "#1e3a68",   // Midnight Navy (Player 1)
  felt: "#1c5634",       // Classic Casino Felt Green
  wood: "#4a2c11",       // Polished Walnut Rail
  slotDefault: "#ffffff",
  slotHighlight: "#38bdf8", // Sky blue highlight
  hoverInk: "#38bdf8",
});

// Canvas 2D dual deck back generator
export function drawCardBack(g, width, height, color = COLORS.redBack) {
  const u = width / 7;
  // Outer paper/cream border
  g.fillStyle = "#fbfaf6";
  g.fillRect(0, 0, width, height);

  // Colored inner field
  const m = 0.45 * u;
  g.fillStyle = color;
  g.fillRect(m, m, width - 2 * m, height - 2 * m);

  // Fine diamond lattice
  if (g.save && g.clip) {
    g.save();
    g.beginPath();
    g.rect(m, m, width - 2 * m, height - 2 * m);
    g.clip();

    g.strokeStyle = "rgba(255, 255, 255, 0.4)";
    g.lineWidth = Math.max(1, 0.06 * u);
    const gap = 0.65 * u;
    for (let k = -height; k < width + height; k += gap) {
      g.beginPath();
      g.moveTo(k, 0);
      g.lineTo(k + height, height);
      g.moveTo(k, height);
      g.lineTo(k + height, 0);
      g.stroke();
    }
    g.restore();
  }

  // Thin inner cream border
  g.strokeStyle = "#fbfaf6";
  g.lineWidth = 0.16 * u;
  g.strokeRect(m * 1.7, m * 1.7, width - 3.4 * m, height - 3.4 * m);
}

export function createDeckBackTexture(color, width = 256, anisotropy = 1) {
  if (typeof document === "undefined" || !document.createElement) {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.round((width * 9.8) / 7);
  const ctx = canvas.getContext("2d");
  drawCardBack(ctx, canvas.width, canvas.height, color);
  const texture = new CanvasTexture(canvas);
  return cardTexture(texture, anisotropy);
}

export class Table {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.options = options;
    this.aspect = canvas ? (canvas.clientWidth || 800) / Math.max(1, canvas.clientHeight || 600) : 16 / 9;

    this.activeAnimations = new Map();
    this.cardMeshes = [];
    this.slotMeshes = {};
    this.slotMeshList = [];
    this.slots = slotPositions(this.aspect);

    this.initScene();
    this.initTextures();
    this.initTable();
    this.initSlots();
    this.initCards();

    this.boundTick = this.tick.bind(this);
    this.animating = false;
  }

  initScene() {
    this.scene = new Scene();
    this.scene.background = new Color("#0f172a");

    // Camera: positioned high facing table slightly inclined
    this.camera = new PerspectiveCamera(35, this.aspect, 10, 400);
    this.camera.position.set(0, 92, 34);
    this.camera.lookAt(0, 0, 2);

    // Renderer (only if WebGL is available)
    if (this.canvas) {
      try {
        this.renderer = new WebGLRenderer({
          canvas: this.canvas,
          antialias: true,
          powerPreference: "high-performance",
        });
        this.renderer.outputColorSpace = SRGBColorSpace;
        this.renderer.shadowMap.enabled = true;
        this.renderer.setSize(this.canvas.clientWidth || 800, this.canvas.clientHeight || 600, false);
      } catch (e) {
        // Fallback for headless tests
        this.renderer = null;
      }
    }

    // Lights
    const hemiLight = new HemisphereLight("#ffffff", "#94a3b8", 1.4);
    this.scene.add(hemiLight);

    const dirLight = new DirectionalLight("#ffffff", 1.8);
    dirLight.position.set(-35, 85, 45);
    dirLight.castShadow = true;
    if (dirLight.shadow) {
      dirLight.shadow.mapSize.width = 1024;
      dirLight.shadow.mapSize.height = 1024;
      dirLight.shadow.camera.near = 10;
      dirLight.shadow.camera.far = 250;
      const reach = 60;
      dirLight.shadow.camera.left = -reach;
      dirLight.shadow.camera.right = reach;
      dirLight.shadow.camera.top = reach;
      dirLight.shadow.camera.bottom = -reach;
      dirLight.shadow.bias = -0.0005;
    }
    this.scene.add(dirLight);
    this.keyLight = dirLight;
  }

  initTextures() {
    const anisotropy = this.renderer ? Math.min(8, this.renderer.capabilities.getMaxAnisotropy()) : 1;
    this.redBack = createDeckBackTexture(COLORS.redBack, 256, anisotropy);
    this.blueBack = createDeckBackTexture(COLORS.blueBack, 256, anisotropy);

    // Jumbo card face textures
    try {
      this.faces = jumboTextures(CODES, { width: 256, anisotropy });
    } catch {
      this.faces = {};
    }
  }

  initTable() {
    // 1. Felt table surface
    const feltGeom = new PlaneGeometry(140, 100);
    const feltMat = new MeshToonMaterial({
      color: COLORS.felt,
      gradientMap: RAMPS.table(),
    });
    this.feltMesh = new Mesh(feltGeom, feltMat);
    this.feltMesh.rotation.x = -Math.PI / 2;
    this.feltMesh.position.set(0, -0.015, 0);
    this.feltMesh.receiveShadow = true;
    this.scene.add(this.feltMesh);

    // 2. Soft shadow receiver plane
    const shadeMat = new ShadowMaterial({ color: "#09140e", opacity: 0.35 });
    this.shadeMesh = new Mesh(feltGeom, shadeMat);
    this.shadeMesh.rotation.x = -Math.PI / 2;
    this.shadeMesh.position.set(0, 0.002, 0);
    this.shadeMesh.receiveShadow = true;
    this.scene.add(this.shadeMesh);

    // 3. Wood rim
    const woodGeom = new BoxGeometry(143, 3.5, 103);
    const woodMat = new MeshToonMaterial({
      color: COLORS.wood,
      gradientMap: RAMPS.table(),
    });
    this.woodMesh = new Mesh(woodGeom, woodMat);
    this.woodMesh.position.set(0, -1.78, 0);
    this.scene.add(this.woodMesh);
  }

  initSlots() {
    const planeGeom = new PlaneGeometry(CARD.width + 0.3, CARD.height + 0.3);

    for (const [id, slot] of Object.entries(this.slots)) {
      const mat = new MeshBasicMaterial({
        color: new Color(COLORS.slotDefault),
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      });
      const mesh = new Mesh(planeGeom, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(slot.x, 0.006, slot.z);
      mesh.userData = { id, slot };
      this.scene.add(mesh);

      this.slotMeshes[id] = mesh;
      this.slotMeshList.push(mesh);
    }
  }

  initCards() {
    const geom = cardGeometry();
    const ramp = RAMPS.card();

    // Exactly 104 cards: Deck 0 (0..51, Red), Deck 1 (52..103, Blue)
    for (let id = 0; id < 104; id++) {
      const deckId = Math.floor(id / 52);
      const suitIdx = Math.floor((id % 52) / 13);
      const rankIdx = (id % 52) % 13;
      const suit = SUITS[suitIdx];
      const rank = rankIdx + 1;
      const code = `${RANKS[rankIdx]}${suit}`;
      const backTex = deckId === 0 ? this.redBack : this.blueBack;
      const faceTex = this.faces?.[code] ?? backTex;

      const materials = cardMaterials({
        face: faceTex,
        back: backTex,
        ramp,
      });

      const mesh = new Mesh(geom, materials);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Ink line outline
      const inkMat = inkMaterial({ color: INK, width: 2.5 });
      const outlineMesh = new Mesh(geom, inkMat);
      mesh.add(outlineMesh);

      mesh.userData = { id, deck: deckId, suit, rank, code };
      mesh.visible = false;
      mesh.placed = false;

      this.scene.add(mesh);
      this.cardMeshes.push(mesh);
    }
  }

  update(state, { animated = true } = {}) {
    this.slots = slotPositions(this.aspect);
    const lay = layout(state, this.aspect);

    for (let id = 0; id < 104; id++) {
      const mesh = this.cardMeshes[id];
      const target = lay.poses[id];

      if (!target) {
        mesh.visible = false;
        continue;
      }

      mesh.visible = true;

      // Update face visibility
      const backTex = mesh.userData.deck === 0 ? this.redBack : this.blueBack;
      const faceTex = this.faces?.[mesh.userData.code] ?? backTex;
      if (mesh.material && mesh.material[0]) {
        mesh.material[0].map = target.faceUp ? faceTex : backTex;
        mesh.material[0].needsUpdate = true;
      }

      const targetPos = new Vector3(target.x, target.y, target.z);
      const targetQuat = new Quaternion().setFromEuler(
        new Euler(target.rotX, target.rotY, target.rotZ, "YXZ")
      );

      if (animated && mesh.placed) {
        const startPos = mesh.position.clone();
        const startQuat = mesh.quaternion.clone();
        const dist = startPos.distanceTo(targetPos);
        const rotDiff = startQuat.angleTo(targetQuat);

        if (dist > 0.05 || rotDiff > 0.05) {
          const hopHeight = Math.min(5.5, Math.max(2.0, dist * 0.12));
          this.activeAnimations.set(id, {
            mesh,
            startTime: performance.now(),
            duration: 380, // ms
            startPos,
            targetPos,
            startQuat,
            targetQuat,
            hopHeight,
          });
          this.startAnimationLoop();
          continue;
        }
      }

      // Snap immediately
      mesh.position.copy(targetPos);
      mesh.quaternion.copy(targetQuat);
      mesh.placed = true;
    }

    if (!animated) {
      this.render();
    }
  }

  startAnimationLoop() {
    if (this.animating) return;
    this.animating = true;
    if (typeof requestAnimationFrame !== "undefined") {
      requestAnimationFrame(this.boundTick);
    }
  }

  tick() {
    const now = performance.now();
    let remaining = 0;

    for (const [id, anim] of this.activeAnimations.entries()) {
      const elapsed = now - anim.startTime;
      const u = Math.min(1, elapsed / anim.duration);
      const t = minimumJerk(u);

      const x = anim.startPos.x + (anim.targetPos.x - anim.startPos.x) * t;
      const z = anim.startPos.z + (anim.targetPos.z - anim.startPos.z) * t;
      const baseChordY = anim.startPos.y + (anim.targetPos.y - anim.startPos.y) * t;
      const hop = 4 * anim.hopHeight * u * (1 - u);
      const y = baseChordY + hop;

      anim.mesh.position.set(x, y, z);
      anim.mesh.quaternion.copy(anim.startQuat).slerp(anim.targetQuat, t);

      if (u >= 1) {
        anim.mesh.position.copy(anim.targetPos);
        anim.mesh.quaternion.copy(anim.targetQuat);
        anim.mesh.placed = true;
        this.activeAnimations.delete(id);
      } else {
        remaining++;
      }
    }

    this.render();

    if (remaining > 0 && typeof requestAnimationFrame !== "undefined") {
      requestAnimationFrame(this.boundTick);
    } else {
      this.animating = false;
    }
  }

  render() {
    if (this.renderer) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  getCardAt(raycaster) {
    if (!raycaster) return null;
    const hits = raycaster.intersectObjects(this.cardMeshes, true);
    if (!hits || hits.length === 0) return null;

    // Filter to visible card meshes
    const cardHits = [];
    for (const hit of hits) {
      let obj = hit.object;
      while (obj && !obj.userData?.code && obj.parent) {
        obj = obj.parent;
      }
      if (obj && obj.visible && typeof obj.userData?.id === "number") {
        cardHits.push({ hit, mesh: obj, id: obj.userData.id, card: obj.userData });
      }
    }

    if (cardHits.length === 0) return null;

    // Highest y position is top-most card
    cardHits.sort((a, b) => b.mesh.position.y - a.mesh.position.y);
    return cardHits[0];
  }

  getSlotAt(raycaster) {
    if (!raycaster) return null;

    // 1. Raycast direct slot meshes
    const hits = raycaster.intersectObjects(this.slotMeshList, false);
    if (hits && hits.length > 0) {
      return hits[0].object.userData.slot;
    }

    // 2. Raycast ground plane
    const groundPlane = new Plane(new Vector3(0, 1, 0), 0);
    const hitPoint = new Vector3();
    if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
      return hitSlot(this.slots, hitPoint.x, hitPoint.z);
    }

    return null;
  }

  highlightSlot(slot, active) {
    const slotId = typeof slot === "string" ? slot : slot?.id;
    const mesh = this.slotMeshes[slotId];
    if (!mesh) return;

    if (active) {
      mesh.material.color.set(COLORS.slotHighlight);
      mesh.material.opacity = 0.65;
    } else {
      mesh.material.color.set(COLORS.slotDefault);
      mesh.material.opacity = 0.16;
    }
  }

  setCardHover(cardId, hovered) {
    const mesh = this.cardMeshes[cardId];
    if (!mesh || !mesh.children[0]) return;

    const inkMesh = mesh.children[0];
    if (inkMesh.material?.uniforms) {
      if (hovered) {
        inkMesh.material.uniforms.inkColor.value.set(COLORS.hoverInk);
        inkMesh.material.uniforms.inkWidth.value = 3.8;
      } else {
        inkMesh.material.uniforms.inkColor.value.set(INK);
        inkMesh.material.uniforms.inkWidth.value = 2.5;
      }
    }
  }
}

export function createTable(canvas, options) {
  return new Table(canvas, options);
}
