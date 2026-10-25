import test from "node:test";
import assert from "node:assert/strict";
import { HUD, segmentState, reserveSegmentState, trackers, trackerTable, celebrate } from "../web3d/src/hud.js";
import { MatchLedger } from "../src/engine/scoring.js";

// Minimal DOM mock for HUD tests
class MockElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = {};
    this.parentNode = null;
    this.style = {
      setProperty: (k, v) => { this.style[k] = String(v); },
      getPropertyValue: (k) => this.style[k] ?? "",
      removeProperty: (k) => { delete this.style[k]; },
    };
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
        textNode.parentNode = this;
        this.children.push(textNode);
      } else if (n) {
        n.parentNode = this;
        this.children.push(n);
      }
    }
  }

  removeChild(node) {
    const idx = this.children.indexOf(node);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      node.parentNode = null;
    }
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  getBoundingClientRect() {
    return { left: 50, top: 50, right: 150, bottom: 150, width: 100, height: 100 };
  }

  get tHead() {
    let th = this.children.find((c) => c.tagName === "THEAD");
    if (!th) {
      th = new MockElement("thead");
      th.append(new MockElement("tr"));
      this.append(th);
    }
    return {
      rows: th.children.filter((c) => c.tagName === "TR"),
    };
  }

  get tBodies() {
    let tb = this.children.find((c) => c.tagName === "TBODY");
    if (!tb) {
      tb = new MockElement("tbody");
      this.append(tb);
    }
    return [tb];
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
    const classes = selector.split(".").filter(Boolean);
    return classes.every((cls) => node.classList.contains(cls));
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

test("HUD model: segmentState and reserveSegmentState correctly compute segment status", () => {
  // segmentState for value 5 out of 13
  assert.equal(segmentState(1, 5, 13), "reached");
  assert.equal(segmentState(4, 5, 13), "reached");
  assert.equal(segmentState(5, 5, 13), "cursor");
  assert.equal(segmentState(6, 5, 13), "unreached");
  assert.equal(segmentState(13, 5, 13), "unreached");

  // 0 value -> all unreached
  assert.equal(segmentState(1, 0, 13), "unreached");

  // reserveSegmentState: 13 cards remaining means 0 cleared -> all unreached
  assert.equal(reserveSegmentState(1, 13), "unreached");
  assert.equal(reserveSegmentState(13, 13), "unreached");

  // 11 cards remaining means 2 cleared
  assert.equal(reserveSegmentState(1, 11), "reached");
  assert.equal(reserveSegmentState(2, 11), "cursor");
  assert.equal(reserveSegmentState(3, 11), "unreached");

  // 0 cards remaining means 13 cleared (depot emptied!)
  assert.equal(reserveSegmentState(1, 0), "reached");
  assert.equal(reserveSegmentState(12, 0), "reached");
  assert.equal(reserveSegmentState(13, 0), "cursor");
});

test("HUD model: trackers extracts reserve, tableau, waste, stock, and foundation suits", () => {
  const state = {
    players: [
      { id: 0, reserveCount: 11, stockCount: 30, wasteCount: 3 },
      { id: 1, reserveCount: 13, stockCount: 35, wasteCount: 0 },
    ],
    tableau: [
      [{ suit: "S", rank: 10 }],
      [{ suit: "H", rank: 9 }],
      [],
      [{ suit: "C", rank: 8 }],
      [{ suit: "D", rank: 7 }],
      [],
      [],
      [{ suit: "S", rank: 6 }],
    ],
    foundations: [
      [{ suit: "S", rank: 1 }, { suit: "S", rank: 2 }], // Spades up to 2
      [],
      [{ suit: "H", rank: 1 }], // Hearts up to 1
      [],
      [{ suit: "D", rank: 1 }, { suit: "D", rank: 2 }, { suit: "D", rank: 3 }], // Diamonds up to 3
      [],
      [],
      [],
    ],
  };

  const t = trackers(state);
  assert.equal(t.you.reserve, 11);
  assert.equal(t.you.stock, 30);
  assert.equal(t.you.waste, 3);
  assert.equal(t.them.reserve, 13);
  assert.equal(t.them.stock, 35);
  assert.equal(t.them.waste, 0);

  // Foundations max rank (0 to 13)
  assert.equal(t.foundations.S, 2);
  assert.equal(t.foundations.H, 1);
  assert.equal(t.foundations.D, 3);
  assert.equal(t.foundations.C, 0);

  // Tableau count
  assert.equal(t.tableauTotal, 5);
});

test("HUD model: trackerTable produces columns and rows with tips and won looks", () => {
  const t = {
    you: { reserve: 0, stock: 10, waste: 2, tableau: 3 },
    them: { reserve: 7, stock: 20, waste: 4, tableau: 2 },
    foundations: { S: 13, H: 4, D: 2, C: 0 },
    tableauTotal: 5,
  };

  const table = trackerTable(t);
  assert.ok(table.columns.length >= 8, "Has at least 8 columns");
  assert.ok(table.columns.some((c) => c.key === "reserve"), "Reserve column exists");
  assert.ok(table.columns.some((c) => c.key === "spades"), "Spades column exists");

  assert.equal(table.rows.length, 2);
  const youRow = table.rows.find((r) => r.who === "you");
  const themRow = table.rows.find((r) => r.who === "them");

  assert.ok(youRow, "You row exists");
  assert.ok(themRow, "Them row exists");

  // Reserve cleared (0) should have won look
  const youReserveCell = youRow.cells.find((c) => c.key === "reserve");
  assert.equal(youReserveCell.text, "0");
  assert.equal(youReserveCell.look, "won");

  // Spades completed (13) should have won look
  const spadesCell = youRow.cells.find((c) => c.key === "spades");
  assert.equal(spadesCell.text, "13");
  assert.equal(spadesCell.look, "won");
});

test("HUD creates Cassino-style floating scorebug in top-left (.info, .hud-slot) with 13 segments", () => {
  const container = new MockElement("div");
  const hud = new HUD({ container, document: { createElement: (tag) => new MockElement(tag) } });

  const info = container.querySelector(".info");
  const slot = container.querySelector(".hud-slot");
  assert.ok(info, ".info top-left container exists");
  assert.ok(slot, ".hud-slot exists");

  const hudEl = slot.querySelector(".hud");
  assert.ok(hudEl, ".hud element exists in slot");

  // Segment lines for You (Crimson) and Opponent (Navy)
  const lineYou = hudEl.querySelector(".hud-line.you");
  const lineOpp = hudEl.querySelector(".hud-line.opp");
  assert.ok(lineYou, "Crimson .hud-line.you exists");
  assert.ok(lineOpp, "Navy .hud-line.opp exists");

  // 13 segments in each line
  const segsYou = lineYou.querySelectorAll(".seg");
  const segsOpp = lineOpp.querySelectorAll(".seg");
  assert.equal(segsYou.length, 13, "You line has 13 segments");
  assert.equal(segsOpp.length, 13, "Opponent line has 13 segments");

  // Active player badge
  const badgeYou = hudEl.querySelector(".active-badge.you");
  const badgeOpp = hudEl.querySelector(".active-badge.opp");
  assert.ok(badgeYou, "You active badge exists");
  assert.ok(badgeOpp, "Opponent active badge exists");

  // Render state with activePlayer = 0 and reserve counts
  const state = createMockGameState({ activePlayer: 0 });
  state.players[0].reserveCount = 10; // 3 cleared
  state.players[1].reserveCount = 12; // 1 cleared

  hud.render(state, new MatchLedger());

  const numYou = hudEl.querySelector("#reserve-num-you");
  const numOpp = hudEl.querySelector("#reserve-num-opp");
  assert.equal(numYou.textContent, "10", "You reserve number shows 10");
  assert.equal(numOpp.textContent, "12", "Opponent reserve number shows 12");

  // Active side badge spring state
  const sideYou = hudEl.querySelector("#hud-side-you");
  const sideOpp = hudEl.querySelector("#hud-side-opp");
  assert.ok(sideYou.classList.contains("active"), "You side is active");
  assert.ok(!sideOpp.classList.contains("active"), "Opponent side is inactive");
});

test("HUD creates collapsible aids/tracker panel at bottom-left", () => {
  const container = new MockElement("div");
  const hud = new HUD({ container, document: { createElement: (tag) => new MockElement(tag) } });

  const panel = container.querySelector(".aids-panel");
  assert.ok(panel, ".aids-panel exists at bottom-left");

  const headBtn = panel.querySelector(".aids-head");
  assert.ok(headBtn, "Aids heading button exists");

  const table = panel.querySelector(".tracker-table");
  assert.ok(table, ".tracker-table exists inside aids-panel");

  // Click heading toggles fold
  assert.equal(panel.classList.contains("folded"), false);
  headBtn.click();
  assert.equal(panel.classList.contains("folded"), true);
  headBtn.click();
  assert.equal(panel.classList.contains("folded"), false);
});

test("HUD celebration popups with M3 spring entrance and foundation celebrations", () => {
  const container = new MockElement("div");
  const doc = { createElement: (tag) => new MockElement(tag) };
  const hud = new HUD({ container, document: doc });

  const cheersContainer = container.querySelector(".cheers");
  assert.ok(cheersContainer, ".cheers container exists for celebrations");

  // Trigger celebration popup
  const cheerNode = hud.celebrate({
    label: "Ace of Spades (A♠)",
    pts: "+1",
    rank: 1,
    suit: "S",
  });

  assert.ok(cheerNode, "Cheer popup node created");
  assert.ok(cheerNode.classList.contains("cheer"), "Cheer node has .cheer class");
  assert.ok(cheerNode.querySelector(".cheer-disc"), "Has .cheer-disc element");
  assert.equal(cheerNode.querySelector(".cheer-disc").textContent, "Ace of Spades (A♠)");
  assert.ok(cheerNode.querySelector(".cheer-burst"), "Has .cheer-burst element");
  assert.equal(cheerNode.querySelector(".cheer-burst").textContent, "+1");
});

test("HUD move chips at bottom-center are formatted like Cassino selection chips", () => {
  const container = new MockElement("div");
  const hud = new HUD({ container, document: { createElement: (tag) => new MockElement(tag) } });

  const moveBar = container.querySelector(".move-bar");
  assert.ok(moveBar, ".move-bar exists");

  const chips = moveBar.querySelector(".chips");
  assert.ok(chips, ".chips container exists");

  const places = moveBar.querySelectorAll(".place");
  assert.ok(places.length >= 1, ".place groups exist inside .chips");

  const drawChip = moveBar.querySelector("#draw-btn");
  const wasteChip = moveBar.querySelector("#waste-btn");
  const undoChip = moveBar.querySelector("#undo-btn");

  assert.ok(drawChip, "Draw stock chip exists");
  assert.ok(wasteChip, "Discard to waste chip exists");
  assert.ok(undoChip, "Undo chip exists");
});
