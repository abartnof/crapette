// 3D Table view and card spatial rendering for Crapette (Russian Bank)

import {
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  BoxGeometry,
  Raycaster,
  Scene,
  Vector2,
  WebGLRenderer,
  CanvasTexture,
  SRGBColorSpace,
} from "three";
import { CARD, TABLE } from "./units.js";

const SUIT_SYMBOLS = { S: "♠", H: "♥", D: "♦", C: "♣" };
const SUIT_COLORS = { S: "#15171c", H: "#c8202c", D: "#c8202c", C: "#15171c" };

export class Table3D {
  constructor({ canvas, headless = false } = {}) {
    this.canvas = canvas;
    this.headless = headless;
    this.activeHighlights = [];
    this.lastSyncedState = null;

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

  _initThree() {
    try {
      this.renderer = new WebGLRenderer({ canvas: this.canvas, antialias: true });
      this.renderer.outputColorSpace = SRGBColorSpace;
      this.renderer.setSize(this.canvas.clientWidth || 800, this.canvas.clientHeight || 600, false);
      this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));

      this.scene = new Scene();
      this.scene.background = new Color("#164529");
      this.scene.fog = new Fog("#164529", 80, 220);

      // Camera positioned high, looking down at table
      this.camera = new PerspectiveCamera(35, (this.canvas.clientWidth || 800) / (this.canvas.clientHeight || 600), 10, 400);
      this.camera.position.set(0, 95, 45);
      this.camera.lookAt(0, 0, -2);

      // Lights
      const hemiLight = new HemisphereLight("#ffffff", "#98a89e", 1.4);
      this.scene.add(hemiLight);

      const dirLight = new DirectionalLight("#ffffff", 1.5);
      dirLight.position.set(-30, 80, 40);
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
      };
      if (typeof window !== "undefined") {
        window.addEventListener("resize", this._onResize);
      }
    } catch (e) {
      // Fallback gracefully to headless if WebGL fails
      this.headless = true;
    }
  }

  _animate() {
    if (this.headless || !this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
    this._animationId = requestAnimationFrame(this._animate);
  }

  _createTableSurface() {
    const tableGeom = new PlaneGeometry(TABLE.width, TABLE.depth);
    const tableMat = new MeshStandardMaterial({
      color: "#18221c",
      roughness: 0.85,
      metalness: 0.1,
    });
    this.tableMesh = new Mesh(tableGeom, tableMat);
    this.tableMesh.rotation.x = -Math.PI / 2;
    this.tableMesh.position.y = -0.05;
    this.scene.add(this.tableMesh);
  }

  setFelt(felt) {
    this.felt = felt;
    if (this.headless || !this.scene) return;
    const feltColors = {
      slate: { felt: "#18221c", bg: "#0e1511" },
      casino: { felt: "#1c5233", bg: "#164529" },
      navy: { felt: "#16253b", bg: "#0d1726" },
      charcoal: { felt: "#24282c", bg: "#171a1d" },
    };
    const c = feltColors[felt] || feltColors.slate;
    if (this.tableMesh && this.tableMesh.material) {
      this.tableMesh.material.color.set(c.felt);
    }
    this.scene.background = new Color(c.bg);
    if (this.scene.fog) {
      this.scene.fog.color.set(c.bg);
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
        color: "#184028",
        transparent: true,
        opacity: 0.7,
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
        mesh.material.color.set("#ffbe0b");
        mesh.material.opacity = 0.95;
      } else {
        mesh.material.color.set("#184028");
        mesh.material.opacity = 0.7;
      }
    }
  }

  clearHighlights() {
    this.activeHighlights = [];
    if (this.headless) return;

    for (const mesh of this.slotMeshes.values()) {
      mesh.material.color.set("#184028");
      mesh.material.opacity = 0.7;
    }
  }

  _getCardFaceTexture(code) {
    if (this.textureCache.has(code)) {
      return this.textureCache.get(code);
    }
    if (typeof document === "undefined") return null;

    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 180;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Card white background
    ctx.fillStyle = "#faf8f2";
    ctx.fillRect(0, 0, 128, 180);

    // Border
    ctx.strokeStyle = "#22252a";
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, 120, 172);

    const rank = code.slice(0, -1);
    const suit = code.slice(-1);
    const color = SUIT_COLORS[suit] || "#15171c";
    const symbol = SUIT_SYMBOLS[suit] || suit;

    ctx.fillStyle = color;
    ctx.font = "bold 24px -apple-system, sans-serif";
    ctx.fillText(rank, 12, 32);

    ctx.font = "26px sans-serif";
    ctx.fillText(symbol, 12, 60);

    // Center big suit
    ctx.font = "52px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(symbol, 64, 105);

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
      if (mesh.geometry) mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else if (mesh.material) {
        mesh.material.dispose();
      }
    }
    this.cardMeshes = [];

    const geom = new BoxGeometry(CARD.width, CARD.thickness, CARD.height);

    const addCardMesh = (card, slotKey, x, y, z, faceUp = true) => {
      const faceTex = this._getCardFaceTexture(card.code);
      const backTex = this._getCardBackTexture(card.deck ?? 0);

      const faceMat = new MeshStandardMaterial({ map: faceTex || undefined, color: faceTex ? "#ffffff" : "#faf8f2" });
      const backMat = new MeshStandardMaterial({ map: backTex || undefined, color: card.deck === 0 ? "#c8202c" : "#1d3557" });
      const edgeMat = new MeshStandardMaterial({ color: "#f3efe6" });

      // Materials order: +x, -x, +y (top face), -y (bottom back), +z, -z
      const materials = [edgeMat, edgeMat, faceUp ? faceMat : backMat, faceUp ? backMat : faceMat, edgeMat, edgeMat];

      const mesh = new Mesh(geom, materials);
      mesh.position.set(x, y, z);
      mesh.userData = {
        cardCode: card.code,
        sourceSlot: slotKey,
        isTop: true,
        isMovable: true,
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
      return {
        card: topHit.object.userData,
        slot: topHit.object.userData.sourceSlot,
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
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
