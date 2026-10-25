import test from "node:test";
import assert from "node:assert/strict";
import { HUD } from "../web3d/src/hud.js";
import { MatchLedger } from "../src/engine/scoring.js";

// Minimal DOM mock for HUD tests
class MockElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = {};
    this.style = {};
    this._textContent = "";
    this._className = "";
    this.eventListeners = {};
    this.disabled = false;
    this.value = "";
  }

  get textContent() {
    return this._textContent;
  }

  set textContent(val) {
    this.children = [];
    this._textContent = String(val);
  }

  get id() {
    return this.attributes["id"] ?? this._id ?? "";
  }

  set id(val) {
    this._id = String(val);
    this.attributes["id"] = String(val);
  }

  set innerHTML(html) {
    this.children = [];
    this._innerHTML = html;
  }

  get innerHTML() {
    return this._innerHTML ?? "";
  }

  get className() {
    return this._className;
  }

  set className(val) {
    this._className = String(val);
  }

  get classList() {
    const el = this;
    return {
      add(...tokens) {
        const set = new Set(el._className.split(/\s+/).filter(Boolean));
        for (const t of tokens) set.add(t);
        el._className = Array.from(set).join(" ");
      },
      remove(...tokens) {
        const set = new Set(el._className.split(/\s+/).filter(Boolean));
        for (const t of tokens) set.delete(t);
        el._className = Array.from(set).join(" ");
      },
      toggle(token, force) {
        const set = new Set(el._className.split(/\s+/).filter(Boolean));
        const shouldAdd = force !== undefined ? Boolean(force) : !set.has(token);
        if (shouldAdd) set.add(token);
        else set.delete(token);
        el._className = Array.from(set).join(" ");
        return shouldAdd;
      },
      contains(token) {
        return el._className.split(/\s+/).filter(Boolean).includes(token);
      },
    };
  }

  setAttribute(k, v) {
    this.attributes[k] = String(v);
  }

  getAttribute(k) {
    return this.attributes[k] ?? null;
  }

  removeAttribute(k) {
    delete this.attributes[k];
  }

  append(...nodes) {
    for (const n of nodes) {
      if (typeof n === "string") {
        const textNode = new MockElement("#text");
        textNode._textContent = n;
        this.children.push(textNode);
      } else if (n) {
        this.children.push(n);
      }
    }
  }

  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
  }

  addEventListener(type, listener) {
    if (!this.eventListeners[type]) this.eventListeners[type] = [];
    this.eventListeners[type].push(listener);
  }

  removeEventListener(type, listener) {
    if (!this.eventListeners[type]) return;
    this.eventListeners[type] = this.eventListeners[type].filter((l) => l !== listener);
  }

  dispatchEvent(event) {
    const list = this.eventListeners[event.type] || [];
    for (const listener of list) {
      listener.call(this, event);
    }
    return true;
  }

  click() {
    this.dispatchEvent({ type: "click", target: this });
  }

  querySelector(selector) {
    return querySelector(this, selector);
  }

  querySelectorAll(selector) {
    const results = [];
    querySelectorAll(this, selector, results);
    return results;
  }
}

function querySelector(node, selector) {
  if (matches(node, selector)) return node;
  for (const c of node.children) {
    const found = querySelector(c, selector);
    if (found) return found;
  }
  return null;
}

function querySelectorAll(node, selector, results = []) {
  if (matches(node, selector)) results.push(node);
  for (const c of node.children) {
    querySelectorAll(c, selector, results);
  }
  return results;
}

function matches(node, selector) {
  if (!node || !node.tagName || node.tagName === "#TEXT") return false;
  if (selector.startsWith("#")) {
    return node.getAttribute("id") === selector.slice(1);
  }
  if (selector.startsWith(".")) {
    return node.classList.contains(selector.slice(1));
  }
  return node.tagName.toLowerCase() === selector.toLowerCase();
}

function createMockGameState({
  activePlayer = 0,
  drawnCard = null,
  crapetteEligible = false,
  undoable = false,
  winner = null,
} = {}) {
  return {
    protocol: 1,
    activePlayer,
    opponent: 1 - activePlayer,
    winner,
    drawnCard,
    crapetteEligible,
    undoable,
    players: [
      { id: 0, name: "You", deck: "red", reserveCount: 11, stockCount: 30, wasteCount: 3, score: 0 },
      { id: 1, name: "Opponent", deck: "blue", reserveCount: 13, stockCount: 35, wasteCount: 0, score: 0 },
    ],
    legal: ["draw", "m r>t1"],
  };
}

test("HUD builds layout with header, actions, and status banner", () => {
  const container = new MockElement("div");
  const hud = new HUD({ container, document: { createElement: (tag) => new MockElement(tag) } });

  assert.ok(container.querySelector("#crapette-btn"), "CALL CRAPETTE button exists");
  assert.ok(container.querySelector("#draw-btn"), "Draw Stock button exists");
  assert.ok(container.querySelector("#waste-btn"), "Discard to Waste button exists");
  assert.ok(container.querySelector("#undo-btn"), "Undo button exists");
  assert.ok(container.querySelector("#status-banner"), "Status banner exists");
  assert.ok(container.querySelector("#deal-count"), "Deal count exists");
  assert.ok(container.querySelector("#score-you"), "Score You exists");
  assert.ok(container.querySelector("#score-opp"), "Score Opponent exists");
});

test("HUD renders match ledger and player counters correctly", () => {
  const container = new MockElement("div");
  const hud = new HUD({ container, document: { createElement: (tag) => new MockElement(tag) } });

  const ledger = new MatchLedger();
  const state = createMockGameState({ activePlayer: 0 });

  hud.render(state, ledger);

  assert.equal(container.querySelector("#deal-count").textContent, "Deal 1");
  assert.equal(container.querySelector("#score-you").textContent, "0");
  assert.equal(container.querySelector("#score-opp").textContent, "0");
  assert.equal(container.querySelector("#you-reserve-count").textContent, "11");
  assert.equal(container.querySelector("#you-stock-count").textContent, "30");
  assert.equal(container.querySelector("#you-waste-count").textContent, "3");
});

test("HUD updates button states and crapette call button pulse", () => {
  const container = new MockElement("div");
  const hud = new HUD({ container, document: { createElement: (tag) => new MockElement(tag) } });

  // Human turn with no drawn card, eligible for crapette blunder
  const state = createMockGameState({
    activePlayer: 0,
    drawnCard: null,
    crapetteEligible: true,
    undoable: true,
  });

  hud.render(state, null);

  const crapetteBtn = container.querySelector("#crapette-btn");
  const drawBtn = container.querySelector("#draw-btn");
  const wasteBtn = container.querySelector("#waste-btn");
  const undoBtn = container.querySelector("#undo-btn");

  assert.ok(crapetteBtn.classList.contains("eligible"), "Crapette button pulses when eligible");
  assert.equal(drawBtn.disabled, false, "Draw button is enabled");
  assert.equal(wasteBtn.disabled, true, "Waste button is disabled without drawn card");
  assert.equal(undoBtn.disabled, false, "Undo button is enabled");

  const banner = container.querySelector("#status-banner");
  assert.ok(banner.textContent.includes("BLUNDER DETECTED"), "Banner alerts blunder");
});

test("HUD emits action callbacks on user interactions", () => {
  const container = new MockElement("div");
  let drawn = false;
  let wasted = false;
  let crapetteCalled = false;
  let undid = false;
  let newGamed = false;
  let soundToggled = false;
  let skillToggled = false;

  const hud = new HUD({
    container,
    document: { createElement: (tag) => new MockElement(tag) },
    onDraw: () => { drawn = true; },
    onWaste: () => { wasted = true; },
    onCrapette: () => { crapetteCalled = true; },
    onUndo: () => { undid = true; },
    onNewGame: () => { newGamed = true; },
    onToggleSound: () => { soundToggled = true; },
    onToggleSkill: () => { skillToggled = true; },
  });

  container.querySelector("#draw-btn").click();
  assert.equal(drawn, true);

  container.querySelector("#waste-btn").click();
  assert.equal(wasted, true);

  container.querySelector("#crapette-btn").click();
  assert.equal(crapetteCalled, true);

  container.querySelector("#undo-btn").click();
  assert.equal(undid, true);

  container.querySelector("#new-deal-btn").click();
  assert.equal(newGamed, true);

  container.querySelector("#mute-btn").click();
  assert.equal(soundToggled, true);

  container.querySelector("#skill-btn").click();
  assert.equal(skillToggled, true);
});

test("HUD supports toggling between Human vs AI and AI vs AI modes", () => {
  const container = new MockElement("div");
  let modeToggled = false;

  const hud = new HUD({
    container,
    document: { createElement: (tag) => new MockElement(tag) },
    onToggleMode: () => { modeToggled = true; },
  });

  const modeBtn = container.querySelector("#mode-btn");
  assert.ok(modeBtn, "Mode button exists in toolbar");
  assert.equal(modeBtn.textContent, "Mode: Vs AI");

  modeBtn.click();
  assert.equal(modeToggled, true, "onToggleMode callback called");

  hud.setMode("ai_vs_ai");
  assert.equal(modeBtn.textContent, "Mode: AI vs AI");

  // Verify banner reflects AI vs AI mode during render
  const state = createMockGameState({ activePlayer: 0 });
  hud.render(state, null);
  const banner = container.querySelector("#status-banner");
  assert.ok(banner.textContent.includes("AI vs AI"), "Banner indicates AI vs AI mode");
});

test("HUD displays toast notifications", () => {
  const container = new MockElement("div");
  const hud = new HUD({ container, document: { createElement: (tag) => new MockElement(tag) } });

  hud.showToast("CRAPETTE! Turn forfeited!");
  const toast = container.querySelector(".hud-toast");
  assert.ok(toast, "Toast container exists");
  assert.equal(toast.textContent, "CRAPETTE! Turn forfeited!");
});
