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

test("HUD top toolbar contains Cassino-style action buttons including Hint, Settings, and New Deal", () => {
  const container = new MockElement("div");
  let hintRequested = false;
  let settingsOpened = false;

  const hud = new HUD({
    container,
    document: { createElement: (tag) => new MockElement(tag) },
    onHint: () => { hintRequested = true; },
    onOpenSettings: () => { settingsOpened = true; },
  });

  const hintBtn = container.querySelector("#hint-btn");
  const settingsBtn = container.querySelector("#settings-btn");
  assert.ok(hintBtn, "Hint button exists in toolbar");
  assert.ok(settingsBtn, "Settings button exists in toolbar");

  hintBtn.click();
  assert.equal(hintRequested, true, "onHint fired when hint button clicked");

  settingsBtn.click();
  assert.equal(settingsOpened, true, "onOpenSettings fired when settings button clicked");
});

test("HUD renders Cassino-style card badges over card piles in .badges container", () => {
  const container = new MockElement("div");
  const hud = new HUD({ container, document: { createElement: (tag) => new MockElement(tag) } });

  const state = createMockGameState();
  hud.render(state, null);

  const badgesContainer = container.querySelector(".badges");
  assert.ok(badgesContainer, ".badges container exists");

  const rBadge = container.querySelector("#badge-you-reserve");
  const sBadge = container.querySelector("#badge-you-stock");
  const oppRBadge = container.querySelector("#badge-opp-reserve");

  assert.ok(rBadge, "You reserve badge exists");
  assert.ok(sBadge, "You stock badge exists");
  assert.ok(oppRBadge, "Opponent reserve badge exists");

  assert.equal(rBadge.textContent, "11");
  assert.equal(sBadge.textContent, "30");
  assert.equal(oppRBadge.textContent, "13");
});

test("HUD New Game Menu allows configuring mode, rules, AI skill, tutorial, and starting a new deal", () => {
  const container = new MockElement("div");
  let startedConfig = null;

  const hud = new HUD({
    container,
    document: { createElement: (tag) => new MockElement(tag) },
    onStartNewGame: (cfg) => { startedConfig = cfg; },
  });

  const modal = container.querySelector("#new-game-modal");
  assert.ok(modal, "New game modal exists");

  hud.toggleNewGameModal(true);
  assert.equal(modal.style.display, "flex");

  // Check form controls in New Game Menu
  const modeSelect = container.querySelector("#new-game-mode");
  const ruleSelect = container.querySelector("#new-game-rules");
  const skillSlider = container.querySelector("#new-game-skill");
  const tutorialCheck = container.querySelector("#new-game-tutorial");
  const hintsCheck = container.querySelector("#new-game-hints");
  const startBtn = container.querySelector("#new-game-start-btn");

  assert.ok(modeSelect, "Mode selector exists");
  assert.ok(ruleSelect, "Rule selector exists");
  assert.ok(skillSlider, "Skill slider exists");
  assert.ok(tutorialCheck, "Tutorial checkbox exists");
  assert.ok(hintsCheck, "Hints checkbox exists");
  assert.ok(startBtn, "Start deal button exists");

  startBtn.click();
  assert.ok(startedConfig, "onStartNewGame fired with config");
  assert.ok(typeof startedConfig.skill === "number" || typeof startedConfig.skill === "string");
});

test("HUD In-Game Settings Menu allows changing audio, surface felt, and resetting tutorials on the fly", () => {
  const container = new MockElement("div");
  let soundToggled = false;
  let feltChanged = null;
  let tutorialReset = false;

  const hud = new HUD({
    container,
    document: { createElement: (tag) => new MockElement(tag) },
    onToggleSound: () => { soundToggled = true; },
    onChangeFelt: (felt) => { feltChanged = felt; },
    onResetTutorial: () => { tutorialReset = true; },
  });

  const settingsModal = container.querySelector("#settings-modal");
  assert.ok(settingsModal, "In-game settings modal exists");

  hud.toggleSettingsModal(true);
  assert.equal(settingsModal.style.display, "flex");

  const soundBtn = container.querySelector("#settings-sound-toggle");
  const feltSelect = container.querySelector("#settings-felt-select");
  const resetTutorialBtn = container.querySelector("#settings-reset-tutorial");

  assert.ok(soundBtn, "Sound toggle button exists in settings");
  assert.ok(feltSelect, "Felt selector exists in settings");
  assert.ok(resetTutorialBtn, "Reset tutorial button exists");

  soundBtn.click();
  assert.equal(soundToggled, true);

  if (feltSelect) {
    feltSelect.value = "slate";
    feltSelect.dispatchEvent({ type: "change", target: feltSelect });
  }

  resetTutorialBtn.click();
  assert.equal(tutorialReset, true);
});

test("HUD displays ZPD hint modal with action headline, rule reminder, and strategic tension", () => {
  const container = new MockElement("div");
  const hud = new HUD({ container, document: { createElement: (tag) => new MockElement(tag) } });

  const hintObj = {
    action: "m r>h0",
    headline: "Move Ace of Spades (A♠) to Foundation",
    rule: "Compulsory Foundation Move: Under Russian Bank rules, aces and valid builds to foundations must be played immediately.",
    tension: "Direct scoring: Playing from your reserve unlocks the card beneath it, directly accelerating your bottleneck.",
  };

  hud.showHintModal(hintObj);

  const hintModal = container.querySelector("#hint-modal");
  assert.ok(hintModal, "Hint modal exists");
  assert.equal(hintModal.style.display, "flex");

  const headlineEl = container.querySelector("#hint-headline");
  const ruleEl = container.querySelector("#hint-rule");
  const tensionEl = container.querySelector("#hint-tension");

  assert.equal(headlineEl.textContent, hintObj.headline);
  assert.equal(ruleEl.textContent, hintObj.rule);
  assert.equal(tensionEl.textContent, hintObj.tension);

  hud.hideHintModal();
  assert.equal(hintModal.style.display, "none");
});

test("HUD displays progressive tutorial modal with step, title, summary, bullets, and Got It button", () => {
  const container = new MockElement("div");
  let pageDismissed = false;
  let neverShowAgain = false;

  const hud = new HUD({
    container,
    document: { createElement: (tag) => new MockElement(tag) },
    onDismissTutorial: ({ pageKey, disableAll }) => {
      pageDismissed = true;
      neverShowAgain = disableAll;
    },
  });

  const page = {
    key: "foundations",
    tag: "Step 2 of 7",
    title: "Communal Foundations",
    summary: "Foundations in the center build upward by suit from Ace to King.",
    bullets: [
      "Any Ace starts an empty foundation slot.",
      "Build in ascending sequence within the exact same suit (e.g. 2♠ on A♠).",
      "Foundation moves are compulsory under strict competitive rules!",
    ],
  };

  hud.showTutorialModal(page);

  const tutorialModal = container.querySelector("#tutorial-modal");
  assert.ok(tutorialModal, "Tutorial modal exists");
  assert.equal(tutorialModal.style.display, "flex");

  const titleEl = container.querySelector("#tutorial-title");
  const summaryEl = container.querySelector("#tutorial-summary");
  assert.equal(titleEl.textContent, page.title);
  assert.equal(summaryEl.textContent, page.summary);

  const gotItBtn = container.querySelector("#tutorial-got-it-btn");
  assert.ok(gotItBtn, "Got It button exists");
  gotItBtn.click();
  assert.equal(pageDismissed, true, "onDismissTutorial called");
});
