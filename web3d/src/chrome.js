// Crapette chrome: top bar, settings, new game, and credits dialogs in Material Design 3
// Styled and arranged following Cassino's chrome architecture (@material/web components)

import "@material/web/button/filled-button.js";
import "@material/web/button/filled-tonal-button.js";
import "@material/web/button/outlined-button.js";
import "@material/web/button/text-button.js";
import "@material/web/dialog/dialog.js";
import "@material/web/iconbutton/icon-button.js";
import "@material/web/select/outlined-select.js";
import "@material/web/select/select-option.js";
import "@material/web/switch/switch.js";
import "@material/web/labs/segmentedbutton/outlined-segmented-button.js";
import "@material/web/labs/segmentedbuttonset/outlined-segmented-button-set.js";
import { PATTERNS } from "./surfaces.js";

// Simple stroked icons matching Cassino & Piquet
const ICONS = {
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  narration: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  hint: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
  undo: '<path d="M3 10h10a5 5 0 0 1 5 5v2"/><path d="M7 6L3 10l4 4"/>',
  redo: '<path d="M21 10H11a5 5 0 0 0-5 5v2"/><path d="M17 6l4 4-4 4"/>',
  mode: '<path d="M16 11V3H8v8H2v10h20V11h-6zM10 5h4v6h-4V5zm-6 8h4v6H4v-6zm16 6h-4v-6h4v6z"/>',
  again: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4 4.5v4h4"/>',
};

// Material Symbols (Outlined, 24px)
const SYMBOLS = {
  back: "m313-440 224 224-57 56-320-320 320-320 57 56-224 224h487v80H313Z",
  forward: "M647-440H160v-80h487L423-744l57-56 320 320-320 320-57-56 224-224Z",
  close: "m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z",
  add: "M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z",
  help: "M478-240q21 0 35.5-14.5T528-290q0-21-14.5-35.5T478-340q-21 0-35.5 14.5T428-290q0 21 14.5 35.5T478-240Zm-36-154h74q0-33 7.5-52t42.5-52q26-26 41-49.5t15-56.5q0-56-41-86t-97-30q-57 0-92.5 30T342-618l66 26q5-18 22.5-39t53.5-21q32 0 48 17.5t16 38.5q0 20-12 37.5T506-526q-44 39-54 59t-10 73Zm38 314q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z",
};

export const FELT_PATTERNS = PATTERNS.map((p) => ({ id: p.id, name: p.name }));

export const AI_SKILL_OPTIONS = [
  { value: "4.0", label: "Master (Strict, optimal play)" },
  { value: "3.0", label: "Advanced (Strong tactical play)" },
  { value: "2.0", label: "Intermediate (Balanced play)" },
  { value: "1.0", label: "Novice (Occasional oversights)" },
];

function getDoc() {
  return typeof document !== "undefined" ? document : globalThis.document;
}

function svg(viewBox, cls) {
  const doc = getDoc();
  const node = doc.createElementNS ? doc.createElementNS("http://www.w3.org/2000/svg", "svg") : doc.createElement("svg");
  node.setAttribute("viewBox", viewBox);
  node.setAttribute("aria-hidden", "true");
  node.setAttribute("class", cls);
  return node;
}

function icon(name) {
  const node = svg("0 0 24 24", "icon");
  node.innerHTML = ICONS[name] || "";
  return node;
}

function symbol(name) {
  const node = svg("0 -960 960 960", "icon symbol");
  const doc = getDoc();
  const path = doc.createElementNS ? doc.createElementNS("http://www.w3.org/2000/svg", "path") : doc.createElement("path");
  path.setAttribute("d", SYMBOLS[name] || "");
  node.append(path);
  return node;
}

export function el(tag, attrs = {}, ...children) {
  const doc = getDoc();
  if (!doc) throw new Error("No document available for DOM creation");
  const node = doc.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key === "value") {
      node.value = value;
      node.setAttribute(key, value);
    }
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
    else if (value === true) node.setAttribute(key, "");
    else if (value !== false && value !== null && value !== undefined) node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    if (typeof child === "string" || typeof child === "number") {
      node.append(doc.createTextNode ? doc.createTextNode(String(child)) : String(child));
    } else {
      node.append(child);
    }
  }
  return node;
}

export function createChrome(root, on = {}) {
  // ---- 1. Top Chrome Bar ----------------------------------------------------
  const fresh = el("md-icon-button", {
    id: "new-deal-btn",
    class: "new-game hud-tool-btn primary",
    title: "New game",
    "aria-label": "New game",
    onclick: () => on.newGame?.(),
  }, symbol("add"));

  const modeSwitch = el("md-icon-button", {
    id: "mode-btn",
    class: "mode-switch hud-tool-btn",
    title: "Switch game mode (Human vs AI / AI vs AI)",
    "aria-label": "Switch game mode",
    onclick: () => on.mode?.(),
  }, icon("mode"));

  const undo = el("md-icon-button", {
    id: "undo-btn",
    class: "undo hud-tool-btn",
    title: "Undo last move",
    "aria-label": "Undo last move",
    onclick: () => on.undo?.(),
  }, icon("undo"));

  const redo = el("md-icon-button", {
    id: "redo-btn",
    class: "redo hud-tool-btn",
    title: "Redo move",
    "aria-label": "Redo move",
    onclick: () => on.redo?.(),
  }, icon("redo"));

  const hint = el("md-icon-button", {
    id: "hint-btn",
    class: "hint hud-tool-btn",
    title: "Get tactical hint",
    "aria-label": "Get tactical hint",
    onclick: () => on.hint?.(),
  }, icon("hint"));

  const log = el("md-icon-button", {
    id: "log-btn",
    class: "log-toggle hud-tool-btn",
    title: "Game narration and action log",
    "aria-label": "Game log",
    toggle: true,
  }, icon("narration"));
  log.addEventListener("change", () => on.log?.(log.selected));

  const help = el("md-icon-button", {
    id: "rules-btn",
    class: "help hud-tool-btn",
    title: "How to play Crapette (Rules & Tutorial)",
    "aria-label": "How to play",
    onclick: () => on.help?.(),
  }, symbol("help"));

  const gear = el("md-icon-button", {
    id: "settings-btn",
    class: "settings-open hud-tool-btn",
    title: "Settings",
    "aria-label": "Settings",
    onclick: () => settings.show(),
  }, icon("settings"));

  const bar = el(
    "header",
    { class: "surface bar" },
    el("span", { class: "brand" }, "Crapette"),
    fresh,
    modeSwitch,
    undo,
    redo,
    hint,
    log,
    help,
    gear
  );

  const row = (title, words, control) =>
    el(
      "label",
      { class: "setting" },
      el(
        "span",
        { class: "setting-text" },
        el("span", { class: "setting-title" }, title),
        el("span", { class: "setting-words" }, words)
      ),
      control
    );

  const sw = (attrs, onChange) => {
    const s = el("md-switch", attrs);
    s.addEventListener("change", () => onChange?.(s.selected));
    return s;
  };

  // ---- 2. Settings Dialog ---------------------------------------------------
  const surfaceOptions = [
    el("md-select-option", { value: "dot-grid", selected: true }, el("div", { slot: "headline" }, "Dot grid (Cassino default)")),
    ...PATTERNS.filter((p) => p.id !== "dot-grid").map((p) =>
      el("md-select-option", { value: p.id }, el("div", { slot: "headline" }, p.name))
    ),
  ];
  const surface = el("md-outlined-select", { "data-pref": "surface", label: "Tabletop Surface", value: "dot-grid" }, ...surfaceOptions);
  surface.addEventListener("change", () => {
    on.pref?.("surface", surface.value);
    on.surface?.(surface.value);
  });

  const facesOptions = [
    el("md-select-option", { value: "jumbo", selected: true }, el("div", { slot: "headline" }, "High-Viz Jumbo Index (Cassino default)")),
    el("md-select-option", { value: "classic" }, el("div", { slot: "headline" }, "Classic Inked Faces")),
  ];
  const faces = el("md-outlined-select", { "data-pref": "faces", label: "Card Art & Index", value: "jumbo" }, ...facesOptions);
  faces.addEventListener("change", () => {
    on.pref?.("faces", faces.value);
    on.faces?.(faces.value);
  });

  const skillOptions = AI_SKILL_OPTIONS.map((s) =>
    el("md-select-option", { value: s.value, selected: s.value === "4.0" }, el("div", { slot: "headline" }, s.label))
  );
  const skill = el("md-outlined-select", { "data-pref": "skill", label: "AI Opponent Difficulty", value: "4.0" }, ...skillOptions);
  skill.addEventListener("change", () => {
    on.pref?.("skill", skill.value);
    on.skill?.(skill.value);
  });

  const soundSwitch = sw({ "data-pref": "sound", selected: true }, (v) => {
    on.pref?.("sound", v);
    on.sound?.(v);
  });
  const highlightsSwitch = sw({ "data-pref": "highlights", selected: true }, (v) => on.pref?.("highlights", v));
  const compulsorySwitch = sw({ "data-rule": "compulsory", selected: true }, (v) => on.pref?.("compulsory", v));
  const compulsoryTableauSwitch = sw({ "data-rule": "compulsory_tableau", selected: true }, (v) => on.pref?.("compulsory_tableau", v));
  const strictCrapetteSwitch = sw({ "data-rule": "strict_crapette", selected: true }, (v) => on.pref?.("strict_crapette", v));
  const hintsAidSwitch = sw({ "data-aid": "hints", selected: true }, (v) => on.aid?.("hints", v));
  const explainAidSwitch = sw({ "data-aid": "explain", selected: false }, (v) => on.aid?.("explain", v));

  const resetTutBtn = el("md-outlined-button", {
    class: "reset-tutorial-btn",
    onclick: () => on.resetTutorial?.(),
  }, "Reset Tutorial History");

  const creditsBtn = el("md-text-button", {
    class: "credits-open",
    onclick: () => {
      settings.close();
      credits.show();
    },
  }, "Credits & Attribution");

  const settings = el(
    "md-dialog",
    { class: "settings-dialog" },
    el("div", { slot: "headline" }, "Settings"),
    el(
      "div",
      { slot: "content", class: "settings" },
      el("h3", {}, "Assistance & Aids"),
      row("Tactical hints", "Suggest compulsory moves and optimal tableau loading", hintsAidSwitch),
      row("Move explanations", "Narrate game reasons and tactical consequences in game log", explainAidSwitch),
      row("Target highlights", "Highlight legal target tableau and foundation slots", highlightsSwitch),
      el("h3", {}, "Game Rules & Enforcements"),
      row("Compulsory Reserve to Foundation", "Must play reserve cards to foundation before stock drawing", compulsorySwitch),
      row("Compulsory Tableau to Foundation", "Must play tableau cards to foundation before stock drawing", compulsoryTableauSwitch),
      row("Strict Crapette calls", "Penalize player immediately when a compulsory blunder is called", strictCrapetteSwitch),
      el("h3", {}, "Tabletop Presentation & Audio"),
      row("Sound effects", "Auditory feedback for slides, snaps, chimes, and Crapette gong", soundSwitch),
      el("div", { class: "selects" }, surface, faces, skill),
      el("h3", {}, "Tutorial & Learning"),
      el("div", { class: "starts" }, resetTutBtn)
    ),
    el(
      "div",
      { slot: "actions" },
      creditsBtn,
      el("md-filled-tonal-button", { onclick: () => settings.close() }, "Done")
    )
  );

  // ---- 3. New Game Dialog ---------------------------------------------------
  const newGameDialog = el("md-dialog", { class: "new-game-dialog" });
  let newGameOpen = false;

  function showNewGame(from = {}, done = () => {}, { opening = false, canContinue = false } = {}) {
    newGameOpen = true;
    let chosen = null;

    const segment = (value, label, selected = false) =>
      el("md-outlined-segmented-button", { "data-mode": value, label, selected });

    const currentMode = from.mode || "human_vs_ai";
    const modeSet = el(
      "md-outlined-segmented-button-set",
      { class: "mode-set", "aria-label": "Game Mode" },
      segment("human_vs_ai", "Human vs AI", currentMode === "human_vs_ai"),
      segment("ai_vs_ai", "Watch (AI vs AI)", currentMode === "ai_vs_ai"),
      segment("two_player", "Two Player", currentMode === "two_player")
    );

    let selectedMode = currentMode;
    modeSet.addEventListener("segmented-button-set-selection", (e) => {
      selectedMode = e.detail?.button?.dataset?.mode || selectedMode;
    });

    const newGameSkillOptions = AI_SKILL_OPTIONS.map((s) =>
      el("md-select-option", { value: s.value, selected: String(s.value) === String(from.skill || "4.0") }, el("div", { slot: "headline" }, s.label))
    );
    const newGameSkill = el("md-outlined-select", { class: "new-game-skill", label: "Opponent Difficulty", value: String(from.skill || "4.0") }, ...newGameSkillOptions);

    const rulesOptions = [
      el("md-select-option", { value: "competitive", selected: (from.rules || "competitive") === "competitive" }, el("div", { slot: "headline" }, "Competitive (Strict Russian Bank Rules)")),
      el("md-select-option", { value: "casual", selected: from.rules === "casual" }, el("div", { slot: "headline" }, "Casual (Relaxed Crapette Calls)")),
    ];
    const rulesSelect = el("md-outlined-select", { class: "new-game-rules", label: "Rule Variant", value: from.rules || "competitive" }, ...rulesOptions);

    const seedInput = el("input", {
      type: "text",
      class: "seed-input",
      placeholder: "Random shuffle (leave blank)",
      value: from.seed ? String(from.seed) : "",
    });

    const tutorialSwitch = sw({ "data-pref": "tutorial", selected: Boolean(from.tutorial ?? true) }, () => {});

    const pick = (kind) => () => {
      chosen = {
        kind,
        mode: selectedMode,
        rules: rulesSelect.value,
        skill: newGameSkill.value,
        seed: seedInput.value ? seedInput.value.trim() : null,
        tutorial: tutorialSwitch.selected,
      };
      newGameDialog.close();
    };

    const welcome = opening
      ? el("p", { class: "game-welcome" }, canContinue ? "Your match is paused: carry on, or start a new deal." : "Welcome to Crapette (Russian Bank) — Competitive two-pack card duel.")
      : null;

    newGameDialog.replaceChildren(
      el("div", { slot: "headline" }, opening ? "Crapette" : "New Game"),
      el(
        "div",
        { slot: "content", class: "settings new-game" },
        welcome,
        modeSet,
        el("div", { class: "selects" }, newGameSkill, rulesSelect),
        row("Random deal seed", "Reproduce identical deals by providing a numeric seed", seedInput),
        row("Tutorial assistance", "Progressive pedagogical walk-through for first-time moves", tutorialSwitch)
      ),
      el(
        "div",
        { slot: "actions" },
        opening ? null : el("md-text-button", { class: "new-game-cancel", onclick: () => newGameDialog.close() }, "Cancel"),
        canContinue
          ? [
              el("md-filled-tonal-button", { class: "deal", onclick: pick("deal") }, "New Deal"),
              el("md-filled-button", { class: "continue", onclick: pick("continue"), autofocus: true }, "Continue Match"),
            ]
          : el("md-filled-button", { class: "deal", onclick: pick("deal"), autofocus: true }, "Deal Cards")
      )
    );

    newGameDialog.addEventListener(
      "closed",
      () => {
        newGameOpen = false;
        done(chosen);
      },
      { once: true }
    );

    newGameDialog.show();
  }

  // ---- 4. Credits Dialog ----------------------------------------------------
  const credits = el(
    "md-dialog",
    { class: "credits-dialog" },
    el("div", { slot: "headline" }, "Credits & Attribution"),
    el(
      "div",
      { slot: "content", class: "credits" },
      creditItem(
        "Crapette (Russian Bank)",
        "Traditional competitive double-deck patience card game dating to the late 19th century.",
        "Codified rules and variations adapted from John McLeod's research at Pagat.com."
      ),
      creditItem(
        "3D Card Architecture & Animation",
        "Derived from card_toolkit by Abe Ratnofsky (@abartnof): inverted-hull toon ink line shader, 3D card slab geometry, and clock director.",
        "Single-file distribution assembly and canvas-rendered jumbo indices."
      ),
      creditItem(
        "Random Number Generation",
        "SplitMix64 seeding xoshiro256** deterministic PRNG by Sebastiano Vigna and David Blackman.",
        "Independent purpose streams ensuring identical, reproducible game positions."
      ),
      creditItem(
        "Three.js",
        "The 3D tabletop is rendered with three.js: MIT License, © 2010–2026 Ricardo Cabello (Mr.doob) and the Three.js contributors."
      ),
      creditItem(
        "Material Design 3",
        "Surfaces and interactive controls follow Material Design 3 via Material Web (Apache License 2.0, © Google LLC) and Lit (BSD 3-Clause, © Google LLC)."
      )
    ),
    el(
      "div",
      { slot: "actions" },
      el("md-filled-tonal-button", { class: "credits-close", onclick: () => credits.close() }, "Close")
    )
  );

  root.append(bar, settings, newGameDialog, credits);

  // ---- 5. State Synchronization ---------------------------------------------
  function sync(state = {}, prefs = {}) {
    const isBusy = Boolean(state.busy);
    const isWatching = Boolean(state.watching || state.gameMode === "ai_vs_ai");
    const isYourTurn = state.activePlayer === 0 && !isWatching;

    hint.disabled = !isYourTurn || isBusy;
    hint.hidden = isWatching;

    undo.disabled = !Boolean(state.undoable) || isBusy;
    redo.disabled = !Boolean(state.redoable) || isBusy;

    if (prefs.surface && surface.value !== prefs.surface) {
      surface.value = prefs.surface;
    }
    if (prefs.faces && faces.value !== prefs.faces) {
      faces.value = prefs.faces;
    }
    if (prefs.skill && skill.value !== prefs.skill) {
      skill.value = String(prefs.skill);
    }
    if (prefs.sound !== undefined) {
      soundSwitch.selected = Boolean(prefs.sound);
    }
    if (prefs.logOpen !== undefined) {
      log.selected = Boolean(prefs.logOpen);
    }
  }

  return {
    bar,
    settings,
    newGameDialog,
    credits,
    showNewGame,
    showSettings: () => settings.show(),
    showCredits: () => credits.show(),
    sync,
    logOpen(open) {
      log.selected = open;
    },
    isNewGameOpen: () => newGameOpen,
  };
}

function creditItem(title, ...paragraphs) {
  return el(
    "div",
    { class: "credit" },
    el("strong", {}, title),
    ...paragraphs.map((p) => el("p", {}, p))
  );
}
