import test from "node:test";
import assert from "node:assert/strict";
import { createChrome, el } from "../web3d/src/chrome.js";

// Mock DOM environment for Node testing
class MockElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = {};
    this.style = {
      setProperty: (k, v) => { this.style[k] = v; },
      getPropertyValue: (k) => this.style[k] || "",
    };
    this._textContent = "";
    this._className = "";
    this.eventListeners = {};
    this.disabled = false;
    this.hidden = false;
    this.selected = false;
    this.open = false;
    this._value = "";
    this.nodeType = 1;
  }

  get value() {
    return this._value || this.attributes["value"] || "";
  }

  set value(v) {
    this._value = String(v);
    this.attributes["value"] = String(v);
  }

  get textContent() {
    if (this.children.length > 0) {
      return this.children.map((c) => c.textContent).join("");
    }
    return this._textContent;
  }

  set textContent(val) {
    this.children = [];
    this._textContent = String(val);
  }

  get id() {
    return this.attributes["id"] ?? "";
  }

  set id(val) {
    this.attributes["id"] = String(val);
  }

  get className() {
    return this._className;
  }

  set className(val) {
    this._className = String(val);
  }

  get classList() {
    const self = this;
    return {
      add(...tokens) {
        const set = new Set(self._className.split(/\s+/).filter(Boolean));
        for (const t of tokens) set.add(t);
        self._className = Array.from(set).join(" ");
      },
      remove(...tokens) {
        const set = new Set(self._className.split(/\s+/).filter(Boolean));
        for (const t of tokens) set.delete(t);
        self._className = Array.from(set).join(" ");
      },
      toggle(token, force) {
        const set = new Set(self._className.split(/\s+/).filter(Boolean));
        const shouldAdd = force !== undefined ? Boolean(force) : !set.has(token);
        if (shouldAdd) set.add(token);
        else set.delete(token);
        self._className = Array.from(set).join(" ");
        return shouldAdd;
      },
      contains(token) {
        return self._className.split(/\s+/).filter(Boolean).includes(token);
      },
    };
  }

  setAttribute(k, v) {
    this.attributes[k] = String(v);
    if (k.startsWith("data-")) {
      if (!this.dataset) this.dataset = {};
      const camel = k.slice(5).replace(/-([a-z])/g, (_, g) => g.toUpperCase());
      this.dataset[camel] = String(v);
    }
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
        const t = new MockElement("#text");
        t._textContent = n;
        this.children.push(t);
      } else if (n) {
        this.children.push(n);
      }
    }
  }

  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
  }

  addEventListener(type, listener, options) {
    if (!this.eventListeners[type]) this.eventListeners[type] = [];
    this.eventListeners[type].push({ listener, once: options?.once ?? false });
  }

  removeEventListener(type, listener) {
    if (!this.eventListeners[type]) return;
    this.eventListeners[type] = this.eventListeners[type].filter((l) => l.listener !== listener);
  }

  dispatchEvent(event) {
    const list = [...(this.eventListeners[event.type] || [])];
    for (const item of list) {
      item.listener.call(this, event);
      if (item.once) {
        this.removeEventListener(event.type, item.listener);
      }
    }
    return true;
  }

  click() {
    this.dispatchEvent({ type: "click", target: this });
  }

  show() {
    this.open = true;
    this.dispatchEvent({ type: "opened", target: this });
  }

  close() {
    this.open = false;
    this.dispatchEvent({ type: "closed", target: this });
  }

  querySelector(selector) {
    return querySelector(this, selector);
  }

  querySelectorAll(selector) {
    const res = [];
    querySelectorAll(this, selector, res);
    return res;
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
  if (selector.includes(".")) {
    const parts = selector.split(".");
    const tag = parts[0];
    if (tag && node.tagName.toLowerCase() !== tag.toLowerCase()) return false;
    for (let i = 1; i < parts.length; i++) {
      if (!node.classList.contains(parts[i])) return false;
    }
    return true;
  }
  if (selector.includes("[")) {
    const tag = selector.split("[")[0];
    const attrMatch = selector.match(/\[([a-zA-Z0-9_-]+)(?:="([^"]+)")?\]/);
    if (tag && node.tagName.toLowerCase() !== tag.toLowerCase()) return false;
    if (attrMatch) {
      const attr = attrMatch[1];
      const val = attrMatch[2];
      if (val !== undefined) {
        return node.getAttribute(attr) === val;
      }
      return node.getAttribute(attr) !== null;
    }
  }
  return node.tagName.toLowerCase() === selector.toLowerCase();
}

// Global document mock
const mockDocument = {
  createElement: (tag) => new MockElement(tag),
  createElementNS: (ns, tag) => new MockElement(tag),
  createTextNode: (text) => {
    const t = new MockElement("#text");
    t._textContent = text;
    return t;
  },
  addEventListener: () => {},
  removeEventListener: () => {},
};

globalThis.document = mockDocument;

test("createChrome creates top chrome bar with brand, icons and buttons", () => {
  const root = new MockElement("div");
  const calls = [];
  const on = {
    newGame: () => calls.push("newGame"),
    mode: () => calls.push("mode"),
    undo: () => calls.push("undo"),
    redo: () => calls.push("redo"),
    hint: () => calls.push("hint"),
    log: (sel) => calls.push(`log_${sel}`),
    help: () => calls.push("help"),
    pref: (k, v) => calls.push(`pref_${k}_${v}`),
  };

  const chrome = createChrome(root, on);

  assert.ok(chrome);
  assert.ok(chrome.bar);

  // Verify brand
  const brand = root.querySelector(".brand");
  assert.ok(brand);
  assert.equal(brand.textContent, "Crapette");

  // Verify top chrome action buttons
  const newGameBtn = root.querySelector("md-icon-button.new-game");
  const modeBtn = root.querySelector("md-icon-button.mode-switch");
  const undoBtn = root.querySelector("md-icon-button.undo");
  const redoBtn = root.querySelector("md-icon-button.redo");
  const hintBtn = root.querySelector("md-icon-button.hint");
  const logBtn = root.querySelector("md-icon-button.log-toggle");
  const helpBtn = root.querySelector("md-icon-button.help");
  const gearBtn = root.querySelector("md-icon-button.settings-open");

  assert.ok(newGameBtn, "New Game button exists");
  assert.ok(modeBtn, "Mode switch button exists");
  assert.ok(undoBtn, "Undo button exists");
  assert.ok(redoBtn, "Redo button exists");
  assert.ok(hintBtn, "Hint button exists");
  assert.ok(logBtn, "Log button exists");
  assert.ok(helpBtn, "Help button exists");
  assert.ok(gearBtn, "Settings button exists");

  // Trigger clicks
  newGameBtn.click();
  assert.ok(calls.includes("newGame"));

  modeBtn.click();
  assert.ok(calls.includes("mode"));

  undoBtn.click();
  assert.ok(calls.includes("undo"));

  redoBtn.click();
  assert.ok(calls.includes("redo"));

  hintBtn.click();
  assert.ok(calls.includes("hint"));

  logBtn.selected = true;
  logBtn.dispatchEvent({ type: "change", target: logBtn });
  assert.ok(calls.includes("log_true"));

  helpBtn.click();
  assert.ok(calls.includes("help"));
});

test("createChrome creates and populates the Settings dialog", () => {
  const root = new MockElement("div");
  const prefsChanged = {};
  const on = {
    newGame: () => {},
    mode: () => {},
    undo: () => {},
    redo: () => {},
    hint: () => {},
    log: () => {},
    help: () => {},
    pref: (k, v) => { prefsChanged[k] = v; },
    aid: (k, v) => { prefsChanged[`aid_${k}`] = v; },
    resetTutorial: () => { prefsChanged.tutorialReset = true; },
  };

  const chrome = createChrome(root, on);
  const settings = chrome.settings;
  assert.ok(settings, "Settings dialog element exists");

  // Surface selector
  const surfaceSelect = settings.querySelector('[data-pref="surface"]');
  assert.ok(surfaceSelect, "Surface selector exists");
  surfaceSelect.value = "casino";
  surfaceSelect.dispatchEvent({ type: "change", target: surfaceSelect });
  assert.equal(prefsChanged["surface"], "casino");

  // Faces / Jumbo index selector or toggle
  const facesSelect = settings.querySelector('[data-pref="faces"]');
  assert.ok(facesSelect, "Card faces / jumbo selector exists");
  facesSelect.value = "jumbo";
  facesSelect.dispatchEvent({ type: "change", target: facesSelect });
  assert.equal(prefsChanged["faces"], "jumbo");

  // AI Difficulty select
  const skillSelect = settings.querySelector('[data-pref="skill"]');
  assert.ok(skillSelect, "AI difficulty selector exists");
  skillSelect.value = "2.0";
  skillSelect.dispatchEvent({ type: "change", target: skillSelect });
  assert.equal(prefsChanged["skill"], "2.0");

  // Sound toggles
  const soundSwitch = settings.querySelector('[data-pref="sound"]');
  assert.ok(soundSwitch, "Sound switch exists");
  soundSwitch.selected = false;
  soundSwitch.dispatchEvent({ type: "change", target: soundSwitch });
  assert.equal(prefsChanged["sound"], false);

  // Rule switches
  const compulsorySwitch = settings.querySelector('[data-rule="compulsory"]');
  assert.ok(compulsorySwitch, "Compulsory move rule switch exists");
  compulsorySwitch.selected = false;
  compulsorySwitch.dispatchEvent({ type: "change", target: compulsorySwitch });
  assert.equal(prefsChanged["compulsory"], false);

  // Reset tutorial
  const resetTutBtn = settings.querySelector(".reset-tutorial-btn");
  assert.ok(resetTutBtn, "Reset tutorial button exists");
  resetTutBtn.click();
  assert.equal(prefsChanged.tutorialReset, true);

  // Credits button
  const creditsBtn = settings.querySelector(".credits-open");
  assert.ok(creditsBtn, "Credits open button exists");
  creditsBtn.click();
  assert.equal(chrome.credits.open, true, "Credits dialog opened on click");
});

test("createChrome creates and opens the New Game dialog with options", () => {
  const root = new MockElement("div");
  const chrome = createChrome(root, {});

  let chosenResult = null;
  chrome.showNewGame(
    { mode: "ai_vs_ai", skill: "3.0", rules: "casual", seed: "98765", tutorial: false },
    (res) => { chosenResult = res; },
    { opening: false, canContinue: true }
  );

  const dialog = chrome.newGameDialog;
  assert.ok(dialog);
  assert.equal(dialog.open, true);

  // Check controls in new game dialog
  const modeSet = dialog.querySelector(".mode-set");
  assert.ok(modeSet, "Game mode selector set exists");

  const seedInput = dialog.querySelector(".seed-input");
  assert.ok(seedInput, "Seed input exists");
  assert.equal(seedInput.value, "98765");

  const rulesSelect = dialog.querySelector(".new-game-rules");
  assert.ok(rulesSelect, "Rule variant select exists");
  assert.equal(rulesSelect.value, "casual");

  const dealBtn = dialog.querySelector(".deal");
  assert.ok(dealBtn, "Deal button exists");

  const continueBtn = dialog.querySelector(".continue");
  assert.ok(continueBtn, "Continue button exists");

  dealBtn.click();
  assert.ok(chosenResult, "Deal action triggered callback");
  assert.equal(chosenResult.kind, "deal");
  assert.equal(chosenResult.mode, "ai_vs_ai");
  assert.equal(chosenResult.rules, "casual");
  assert.equal(chosenResult.seed, "98765");
  assert.equal(chosenResult.tutorial, false);
});

test("createChrome creates Credits dialog with attribution items", () => {
  const root = new MockElement("div");
  const chrome = createChrome(root, {});
  const credits = chrome.credits;
  assert.ok(credits);

  const creditItems = credits.querySelectorAll(".credit");
  assert.ok(creditItems.length >= 4, "Includes attribution items for history, 3D card architecture, RNG, and Three.js");

  const closeBtn = credits.querySelector(".credits-close");
  assert.ok(closeBtn, "Close button exists in credits");
  chrome.credits.show();
  assert.equal(chrome.credits.open, true);
  closeBtn.click();
  assert.equal(chrome.credits.open, false);
});

test("chrome.sync updates button states from game state", () => {
  const root = new MockElement("div");
  const chrome = createChrome(root, {});

  const hintBtn = root.querySelector("md-icon-button.hint");
  const undoBtn = root.querySelector("md-icon-button.undo");
  const logBtn = root.querySelector("md-icon-button.log-toggle");

  // Active player turn with hint available and undoable
  chrome.sync({
    activePlayer: 0,
    watching: false,
    undoable: true,
    busy: false,
  });

  assert.equal(hintBtn.disabled, false);
  assert.equal(undoBtn.disabled, false);

  // Opponent / AI turn or watching mode
  chrome.sync({
    activePlayer: 1,
    watching: true,
    undoable: false,
    busy: false,
  });

  assert.equal(hintBtn.disabled, true);
  assert.equal(undoBtn.disabled, true);
});
