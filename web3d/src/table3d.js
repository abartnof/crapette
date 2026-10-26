// 3D Table view and card spatial rendering for Crapette (Russian Bank)

import {
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  ShadowMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  BoxGeometry,
  Raycaster,
  RepeatWrapping,
  Scene,
  Vector2,
  VSMShadowMap,
  WebGLRenderer,
  CanvasTexture,
  SRGBColorSpace,
} from "three";
import { CARD, TABLE } from "./units.js";
import { cardGeometry } from "./cards.js";
import { cardMaterials, inkMaterial, INK, RAMPS } from "./materials.js";
import { lying } from "./kinematics.js";
import { PATTERNS, drawSurface, chooseSurface, BASE } from "./surfaces.js";
import { drawJumbo } from "./faces.js";

const SUIT_SYMBOLS = { S: "♠", H: "♥", D: "♦", C: "♣" };
const SUIT_COLORS = { S: "#15171c", H: "#c8202c", D: "#c8202c", C: "#15171c" };

export class Table3D {
  constructor({ canvas, headless = false, textures = null } = {}) {
    this.canvas = canvas;
    this.headless = headless;
    this.textures = textures;
    this.facesMode = "jumbo"; // High-viz Jumbo Index cards by default
    this.activeHighlights = [];
    this.lastSyncedState = null;
    this.surfaceId = "dot-grid";

    this.cardGeom = cardGeometry();
    this.ramp = RAMPS.card();
    this.inkMaterials = new Set();
    this.inks = {
      plain: inkMaterial({ color: INK, width: 2.5 }),
      hover: inkMaterial({ color: INK, width: 3.75 }),
      hint: inkMaterial({ color: "#009fb7", width: 4.0 }),
      chosen: inkMaterial({ color: "#e8900c", width: 4.0 }),
    };
    for (const ink of Object.values(this.inks)) {
      this.registerInk(ink);
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.raycaster = new Raycaster();
    this.pointer = new Vector2();
    this.slotMeshes = new Map(); // key -> mesh
    this.cardMeshes = []; // array of interactive card meshes
    this.textureCache = new Map();

    if (!this.headless && this.canvas) {
      this._initThree();
    }
  }

  setFaces(mode) {
    this.facesMode = mode === "classic" ? "classic" : "jumbo";
    this.textureCache.clear();
    if (this.lastSyncedState) {
      this.sync(this.lastSyncedState);
    }
  }

  setTextures(textures) {
    this.textures = textures;
    if (this.lastSyncedState) {
      this.sync(this.lastSyncedState);
    }
  }

  _initThree() {
    try {
      this.renderer = new WebGLRenderer({ canvas: this.canvas, antialias: true });
      this.renderer.outputColorSpace = SRGBColorSpace;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = VSMShadowMap;
      this.renderer.setSize(this.canvas.clientWidth || 800, this.canvas.clientHeight || 600, false);
      this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));

      this.scene = new Scene();
      this.scene.background = new Color(BASE);
      this.scene.fog = new Fog(BASE, 80, 220);

      // Camera positioned high, looking down at table (near 20 prevents depth precision z-fighting)
      this.camera = new PerspectiveCamera(31, (this.canvas.clientWidth || 800) / (this.canvas.clientHeight || 600), 20, 400);
      this.camera.position.set(0, 95, 45);
      this.camera.lookAt(0, 0, -2);

      // Lights matching Cassino
      const hemiLight = new HemisphereLight("#ffffff", "#d8dbe3", 1.7);
      this.scene.add(hemiLight);

      const dirLight = new DirectionalLight("#ffffff", 1.6);
      dirLight.position.set(-34, 70, 46);
      dirLight.castShadow = true;
      const REACH = 115;
      Object.assign(dirLight.shadow.camera, { left: -REACH, right: REACH, top: REACH, bottom: -REACH, near: 1, far: 320 });
      dirLight.shadow.mapSize.set(512, 512);
      dirLight.shadow.bias = -0.0004;
      dirLight.shadow.normalBias = 0.02;
      const SOFTNESS = 0.8;
      dirLight.shadow.radius = (SOFTNESS * 512) / (2 * REACH);
      dirLight.shadow.blurSamples = 8;
      dirLight.shadow.intensity = 0.8;
      this.scene.add(dirLight);

      this._createTableSurface();
      this._createSlots();

      this._animate = this._animate.bind(this);
      this._animationId = requestAnimationFrame(this._animate);

      this._onResize = () => {
        if (!this.canvas || !this.renderer || !this.camera) return;
        const w = this.canvas.clientWidth;
        const h = this.canvas.clientHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h, false);
        this._updateInkResolution();
      };
      if (typeof window !== "undefined") {
        window.addEventListener("resize", this._onResize);
      }
      this._updateInkResolution();
    } catch (e) {
      // Fallback gracefully to headless if WebGL fails
      this.headless = true;
    }
  }

  fitInk(mat) {
    if (!mat || !mat.uniforms || !this.renderer) return;
    if (mat.uniforms.resolution?.value) {
      this.renderer.getDrawingBufferSize(mat.uniforms.resolution.value);
    }
    if (mat.uniforms.inkWidth?.value !== undefined) {
      mat.userData ??= {};
      const cssWidth = mat.userData.cssWidth ?? mat.uniforms.inkWidth.value;
      mat.userData.cssWidth = cssWidth;
      mat.uniforms.inkWidth.value = cssWidth * this.renderer.getPixelRatio();
    }
  }

  registerInk(mat) {
    if (!mat || !mat.uniforms) return;
    mat.userData ??= {};
    mat.userData.cssWidth ??= mat.uniforms.inkWidth?.value ?? 2.5;
    this.inkMaterials.add(mat);
    if (this.renderer) {
      this.fitInk(mat);
    }
  }

  unregisterInk(mat) {
    if (!mat) return;
    this.inkMaterials.delete(mat);
    if (mat.dispose) mat.dispose();
  }

  _updateInkResolution() {
    if (!this.renderer) return;
    for (const mat of this.inkMaterials) {
      this.fitInk(mat);
    }
  }

  _animate() {
    if (this.headless || !this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
    this._animationId = requestAnimationFrame(this._animate);
  }

  _createTableSurface() {
    const WIDE = TABLE.width || 140;
    const DEEP = TABLE.depth || 100;
    const tableGeom = new PlaneGeometry(WIDE, DEEP);

    let canvas = null;
    if (typeof document !== "undefined") {
      canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 1024;
      this.surfaceTexture = new CanvasTexture(canvas);
      this.surfaceTexture.wrapS = RepeatWrapping;
      this.surfaceTexture.wrapT = RepeatWrapping;
      this.surfaceTexture.colorSpace = SRGBColorSpace;
      const TILE_CM = 48;
      this.surfaceTexture.repeat.set(WIDE / TILE_CM, DEEP / TILE_CM);
    }

    const tableMat = new MeshBasicMaterial({
      map: this.surfaceTexture || null,
    });
    this.tableMesh = new Mesh(tableGeom, tableMat);
    this.tableMesh.rotation.x = -Math.PI / 2;
    this.tableMesh.position.set(0, 0, 0);
    this.scene.add(this.tableMesh);

    // Cassino soft shadow receiver plane
    const shadeMat = new ShadowMaterial({ color: "#14161a", opacity: 0.3 });
    const shade = new Mesh(new PlaneGeometry(WIDE, DEEP), shadeMat);
    shade.rotation.x = -Math.PI / 2;
    shade.position.set(0, 0.005, 0);
    shade.receiveShadow = true;
    this.scene.add(shade);

    // Wood trim underneath
    const woodMat = new MeshToonMaterial({ color: "#9a6b43" });
    const wood = new Mesh(new BoxGeometry(WIDE, 2.5, DEEP), woodMat);
    wood.position.set(0, -2.5 / 2 - 0.02, 0);
    this.scene.add(wood);

    this.setSurface(this.surfaceId || "dot-grid");
  }

  setFelt(felt) {
    this.setSurface(felt);
  }

  setSurface(id) {
    this.surfaceId = id;
    if (this.headless || !this.scene) return;
    const pattern = PATTERNS.find((p) => p.id === id) || PATTERNS.find((p) => p.id === "dot-grid") || PATTERNS[0];
    if (pattern && typeof document !== "undefined" && this.surfaceTexture) {
      let canvas = this.surfaceTexture.image;
      if (!canvas || !canvas.getContext) {
        canvas = document.createElement("canvas");
      }
      drawSurface(canvas, pattern);
      this.surfaceTexture.image = canvas;
      this.surfaceTexture.needsUpdate = true;
      this.scene.background = new Color(BASE);
      if (this.scene.fog) this.scene.fog.color.set(BASE);
    }
  }

  decorateCard(mesh, { line = "plain", dim = false } = {}) {
    if (!mesh || !mesh.children) return;
    const inkChild = mesh.children.find((c) => c.userData?.isInkOutline);
    if (inkChild) {
      inkChild.material = this.inks[line] || this.inks.plain;
    }
    if (Array.isArray(mesh.material) && mesh.material[0]) {
      mesh.material[0].color.setScalar(dim ? 0.72 : 1.0);
    }
  }

  _getSlotCoordinates(slotKey) {
    const cw = CARD.width;
    const ch = CARD.height;
    const gapX = 1.6;
    const gapZ = 2.0;

    // Center foundations: 2 columns of 4 in the middle
    if (slotKey.startsWith("h")) {
      const idx = parseInt(slotKey.slice(1), 10);
      const col = idx < 4 ? 0 : 1;
      const row = idx % 4;
      const x = (col === 0 ? -1 : 1) * ((cw / 2) + 0.8);
      const z = (row - 1.5) * (ch + 1.2);
      return { x, y: 0.01, z };
    }

    // Tableau: 4 columns left, 4 columns right
    if (slotKey.startsWith("t")) {
      const idx = parseInt(slotKey.slice(1), 10);
      const side = idx < 4 ? -1 : 1;
      const col = idx % 4;
      const x = side * ((cw * 1.8) + (col * (cw + gapX)));
      const z = -2;
      return { x, y: 0.01, z };
    }

    // Player 0 (Bottom / You)
    if (slotKey === "r" || slotKey === "r0") {
      return { x: 32, y: 0.01, z: 22 };
    }
    if (slotKey === "s" || slotKey === "s0") {
      return { x: -32, y: 0.01, z: 22 };
    }
    if (slotKey === "w" || slotKey === "w0") {
      return { x: -22, y: 0.01, z: 22 };
    }
    if (slotKey === "drawn") {
      return { x: -22, y: 0.05, z: 12 };
    }

    // Player 1 (Top / Opponent)
    if (slotKey === "opp_r" || slotKey === "r1") {
      return { x: -32, y: 0.01, z: -26 };
    }
    if (slotKey === "opp_s" || slotKey === "s1") {
      return { x: 32, y: 0.01, z: -26 };
    }
    if (slotKey === "opp_w" || slotKey === "w1") {
      return { x: 22, y: 0.01, z: -26 };
    }

    return { x: 0, y: 0.01, z: 0 };
  }

  _createSlots() {
    const allSlots = [
      // Foundations
      "h0", "h1", "h2", "h3", "h4", "h5", "h6", "h7",
      // Tableau
      "t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7",
      // Player 0
      "r", "s", "w",
      // Player 1
      "opp_r", "opp_s", "opp_w",
    ];

    const geom = new PlaneGeometry(CARD.width, CARD.height);

    for (const key of allSlots) {
      const pos = this._getSlotCoordinates(key);
      const mat = new MeshBasicMaterial({
        color: "#1d2433",
        transparent: true,
        opacity: 0.08,
      });
      const mesh = new Mesh(geom, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(pos.x, pos.y, pos.z);
      mesh.userData = { slot: key };

      this.scene.add(mesh);
      this.slotMeshes.set(key, mesh);
    }
  }

  highlightSlots(slotKeys = []) {
    this.activeHighlights = [...slotKeys];
    if (this.headless) return;

    for (const [key, mesh] of this.slotMeshes.entries()) {
      const isHighlighted = slotKeys.includes(key) || (key.startsWith("h") && slotKeys.includes("h"));
      if (isHighlighted) {
        mesh.material.color.set("#009fb7");
        mesh.material.opacity = 0.35;
      } else {
        mesh.material.color.set("#1d2433");
        mesh.material.opacity = 0.08;
      }
    }
  }

  clearHighlights() {
    this.activeHighlights = [];
    if (this.headless) return;

    for (const mesh of this.slotMeshes.values()) {
      mesh.material.color.set("#1d2433");
      mesh.material.opacity = 0.08;
    }
  }

  _getCardFaceTexture(code) {
    if (this.textureCache.has(code)) {
      return this.textureCache.get(code);
    }
    if (typeof document === "undefined") return null;

    const width = 512;
    const height = Math.round(width * (7 / 5));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Use Cassino's High-Viz Jumbo Index renderer
    drawJumbo(ctx, width, code);

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    this.textureCache.set(code, texture);
    return texture;
  }

  _getCardBackTexture(deckId) {
    const key = `back_${deckId}`;
    if (this.textureCache.has(key)) return this.textureCache.get(key);
    if (typeof document === "undefined") return null;

    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 180;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = deckId === 0 ? "#c8202c" : "#1d3557";
    ctx.fillRect(0, 0, 128, 180);

    ctx.strokeStyle = "#f5a623";
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, 116, 168);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 2;
    for (let y = 20; y < 160; y += 20) {
      for (let x = 20; x < 110; x += 20) {
        ctx.strokeRect(x, y, 12, 12);
      }
    }

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    this.textureCache.set(key, texture);
    return texture;
  }

  sync(state) {
    this.lastSyncedState = state;
    if (this.headless || !this.scene) return;

    // Clear old card meshes
    for (const mesh of this.cardMeshes) {
      this.scene.remove(mesh);
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else if (mesh.material) {
        mesh.material.dispose();
      }
    }
    this.cardMeshes = [];

    const addCardMesh = (card, slotKey, x, y, z, faceUp = true) => {
      let faceTex = null;
      let backTex = null;

      if (this.facesMode === "classic" && this.textures && this.textures.faces?.[card.code]) {
        faceTex = this.textures.faces[card.code];
      } else {
        faceTex = this._getCardFaceTexture(card.code);
      }

      if (this.textures) {
        if (card.deck === 0) {
          backTex = this.textures.backs?.red || this.textures.backRed || this.textures.back || null;
        } else {
          backTex = this.textures.backs?.blue || this.textures.backBlue || this.textures.back || null;
        }
      }

      if (!backTex) backTex = this._getCardBackTexture(card.deck ?? 0);

      const materials = cardMaterials({
        face: faceTex,
        back: backTex,
        ramp: this.ramp,
      });

      const mesh = new Mesh(this.cardGeom, materials);
      mesh.castShadow = true;
      mesh.receiveShadow = false;

      const p = lying({ x, z, height: y, faceUp });
      mesh.position.copy(p.position);
      mesh.quaternion.copy(p.quaternion);

      // Inverted-hull ink line outline child mesh using shared plain ink
      const outlineMesh = new Mesh(this.cardGeom, this.inks.plain);
      outlineMesh.userData = { isInkOutline: true };
      mesh.add(outlineMesh);

      mesh.userData = {
        cardCode: card.code,
        sourceSlot: slotKey,
        isTop: true,
        isMovable: true,
        deck: card.deck ?? 0,
      };

      this.scene.add(mesh);
      this.cardMeshes.push(mesh);
      return mesh;
    };

    // Render Foundations (top card of each)
    for (let f = 0; f < 8; f++) {
      const pile = state.foundations[f];
      if (pile && pile.length > 0) {
        const top = pile[pile.length - 1];
        const pos = this._getSlotCoordinates(`h${f}`);
        addCardMesh(top, `h${f}`, pos.x, pos.y + 0.02 * pile.length, pos.z, true);
      }
    }

    // Render Tableau columns (fan downward)
    for (let t = 0; t < 8; t++) {
      const col = state.tableau[t];
      if (col && col.length > 0) {
        const pos = this._getSlotCoordinates(`t${t}`);
        for (let i = 0; i < col.length; i++) {
          const card = col[i];
          const isTop = i === col.length - 1;
          const zOffset = i * 2.2;
          const mesh = addCardMesh(card, `t${t}`, pos.x, pos.y + 0.02 * (i + 1), pos.z + zOffset, true);
          mesh.userData.isTop = isTop;
          mesh.userData.isMovable = isTop;
        }
      }
    }

    // Render Player 0 Reserve (top card face up)
    const p0 = state.players[0];
    if (p0 && p0.reserve && p0.reserve.length > 0) {
      const rTop = p0.reserve[p0.reserve.length - 1];
      const pos = this._getSlotCoordinates("r");
      addCardMesh(rTop, "r", pos.x, pos.y + 0.02 * p0.reserve.length, pos.z, true);
    }

    // Render Player 0 Stock (face down)
    if (p0 && p0.stockCount > 0) {
      const pos = this._getSlotCoordinates("s");
      addCardMesh({ code: "BACK", deck: 0 }, "s", pos.x, pos.y + 0.02 * Math.min(p0.stockCount, 15), pos.z, false);
    }

    // Render Player 0 Waste (top card face up)
    if (p0 && p0.waste && p0.waste.length > 0) {
      const wTop = p0.waste[p0.waste.length - 1];
      const pos = this._getSlotCoordinates("w");
      addCardMesh(wTop, "w", pos.x, pos.y + 0.02 * p0.waste.length, pos.z, true);
    }

    // Render Drawn Card
    if (state.drawnCard) {
      const pos = this._getSlotCoordinates("drawn");
      addCardMesh(state.drawnCard, "drawn", pos.x, pos.y + 0.4, pos.z, true);
    }

    // Render Player 1 Reserve (top card face up)
    const p1 = state.players[1];
    if (p1 && p1.reserve && p1.reserve.length > 0) {
      const rTop = p1.reserve[p1.reserve.length - 1];
      const pos = this._getSlotCoordinates("opp_r");
      addCardMesh(rTop, "opp_r", pos.x, pos.y + 0.02 * p1.reserve.length, pos.z, true);
    }

    // Render Player 1 Stock (face down)
    if (p1 && p1.stockCount > 0) {
      const pos = this._getSlotCoordinates("opp_s");
      addCardMesh({ code: "BACK", deck: 1 }, "opp_s", pos.x, pos.y + 0.02 * Math.min(p1.stockCount, 15), pos.z, false);
    }

    // Render Player 1 Waste (top card face up)
    if (p1 && p1.waste && p1.waste.length > 0) {
      const wTop = p1.waste[p1.waste.length - 1];
      const pos = this._getSlotCoordinates("opp_w");
      addCardMesh(wTop, "opp_w", pos.x, pos.y + 0.02 * p1.waste.length, pos.z, true);
    }
  }

  raycast(normalizedCoords) {
    if (this.headless || !this.camera || !this.scene) return null;

    this.pointer.x = normalizedCoords.x;
    this.pointer.y = normalizedCoords.y;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    // Check cards first
    const cardHits = this.raycaster.intersectObjects(this.cardMeshes);
    if (cardHits.length > 0) {
      const topHit = cardHits[0];
      const hitObj = topHit.object.userData?.isInkOutline ? topHit.object.parent : topHit.object;
      return {
        card: hitObj.userData,
        slot: hitObj.userData.sourceSlot,
      };
    }

    // Check slots
    const slotHits = this.raycaster.intersectObjects(Array.from(this.slotMeshes.values()));
    if (slotHits.length > 0) {
      const topSlot = slotHits[0];
      return {
        card: null,
        slot: topSlot.object.userData.slot,
      };
    }

    return null;
  }

  destroy() {
    if (this._animationId) {
      cancelAnimationFrame(this._animationId);
    }
    if (typeof window !== "undefined" && this._onResize) {
      window.removeEventListener("resize", this._onResize);
    }
    if (this.inks) {
      for (const mat of Object.values(this.inks)) {
        if (mat?.dispose) mat.dispose();
      }
    }
    if (this.cardGeom?.dispose) {
      this.cardGeom.dispose();
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
