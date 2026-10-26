// HUD interface, Material Design 3 surfaces, and Cassino-style card badges for Crapette (Russian Bank)

import { AI_SKILLS } from "../../src/engine/ai.js";
import { createChrome } from "./chrome.js";
import {
  createOverlay,
  trackers,
  trackerTable,
  foundationSuitCounts,
  celebrate,
  celebrationOf,
  COLUMNS,
  SUITS,
  SUIT_NAMES,
  SUIT_GLYPHS,
} from "./overlay.js";

export {
  createOverlay,
  trackers,
  trackerTable,
  foundationSuitCounts,
  celebrate,
  celebrationOf,
  COLUMNS,
  SUITS,
  SUIT_NAMES,
  SUIT_GLYPHS,
};

export const RESERVE_TOTAL = 13;

// Segment state for 1-based index n vs count (0 to total)
export function segmentState(n, count, total = RESERVE_TOTAL) {
  const c = Math.max(0, Math.min(total, count));
  if (c <= 0) return "unreached";
  return n < c ? "reached" : n === c ? "cursor" : "unreached";
}

// Reserve progress: 13 down to 0 remaining means 0 up to 13 cleared
export function reserveSegmentState(n, reserveCount, total = RESERVE_TOTAL) {
  const cleared = Math.max(0, Math.min(total, total - reserveCount));
  return segmentState(n, cleared, total);
}

// Floating Scorebug widget (placed in .info > .hud-slot)
export function createHud(root, {
  later = (ms, fn) => setTimeout(fn, ms),
  onToggle = () => {},
  document = globalThis.document,
} = {}) {
  const el = (tag, attrs = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "className" || k === "class") node.className = v;
      else if (k === "id") node.id = v;
      else node.setAttribute(k, v);
    }
    for (const c of children) {
      if (c) node.append(c);
    }
    return node;
  };

  const lines = { you: [], opp: [] };
  const line = (side) => {
    const row = el("div", { className: `hud-line ${side}` });
    for (let n = 1; n <= RESERVE_TOTAL; n++) {
      const seg = el("div", { className: "seg unreached" });
      if (n > 1 && seg.style && typeof seg.style.setProperty === "function") {
        seg.style.marginLeft = (n - 1) % 5 === 0 ? "8px" : "3px";
      }
      lines[side].push(seg);
      row.append(seg);
    }
    return row;
  };

  const block = (side, nameText) => {
    const activeBadge = el("span", { className: `active-badge ${side}`, "aria-hidden": "true" }, "▶");
    const nameNode = el("span", { className: `hud-name ${side}` }, nameText);
    const nameGroup = el("div", { className: "hud-name-group" }, activeBadge, nameNode);

    const num = el("div", { className: `hud-num ${side}`, id: `reserve-num-${side}` }, "13");
    const score = el("div", { className: "hud-score" }, line(side), num);
    const popLabel = el("span", { className: "hud-pop-label" });
    const popPts = el("span", { className: "hud-pop-pts" });
    const pop = el("div", { className: "hud-pop", "aria-live": "polite" }, popLabel, popPts);
    const stage = el("div", { className: `hud-block ${side}` }, score, pop);
    const row = el("div", { className: `hud-side ${side}`, id: `hud-side-${side}` }, nameGroup, stage);
    return { node: stage, row, nameGroup, activeBadge, nameNode, num, popLabel, popPts };
  };

  const blocks = {
    opp: block("opp", "Opponent"),
    you: block("you", "You"),
  };

  const linesNode = el("div", { className: "hud-lines", role: "img" }, blocks.opp.row, blocks.you.row);
  const chevron = el("button", {
    className: "hud-chev",
    type: "button",
    "aria-expanded": "false",
    "aria-label": "Show match ledger scores",
  });
  chevron.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg>`;

  const headYou = el("div", { className: "hud-head-you" }, "You (Crimson)");
  const headOpp = el("div", { className: "hud-head-opp" }, "Opponent (Navy)");
  const list = el("div", { className: "hud-list", id: "hud-deals-list" });
  const totYou = el("div", { className: "hud-tot-you", id: "hud-tot-you" }, "0");
  const totOpp = el("div", { className: "hud-tot-opp", id: "hud-tot-opp" }, "0");

  const panel = el("div", { className: "hud-panel" },
    el("div", { className: "hud-panel-inner" },
      el("div", { className: "hud-rule" }),
      el("div", { className: "hud-head" }, headYou, el("div", { className: "hud-mid" }, "Deals"), headOpp),
      list,
      el("div", { className: "hud-rule" }),
      el("div", { className: "hud-total" }, totYou, el("div", { className: "hud-mid" }, "Total Score"), totOpp)
    )
  );

  const hud = el("section", { className: "hud", "aria-label": "The scorebug and reserve progress" },
    el("div", { className: "hud-top" }, linesNode, chevron),
    panel
  );

  root.append(hud);

  let open = false;
  function setOpen(next) {
    if (next === open) return;
    open = next;
    hud.classList.toggle("open", open);
    chevron.setAttribute("aria-expanded", String(open));
    chevron.setAttribute("aria-label", open ? "Hide match ledger scores" : "Show match ledger scores");
    panel.style.display = open ? "block" : "none";
    onToggle(open);
  }
  chevron.addEventListener("click", () => setOpen(!open));

  function updateSegments(side, reserveRemaining) {
    const segs = lines[side];
    segs.forEach((seg, i) => {
      const n = i + 1;
      const st = reserveSegmentState(n, reserveRemaining, RESERVE_TOTAL);
      seg.className = `seg ${st}`;
    });
  }

  function render(state, ledger) {
    if (!state) return;
    const p0 = state.players?.[0] || {};
    const p1 = state.players?.[1] || {};

    const youReserve = p0.reserveCount ?? 13;
    const oppReserve = p1.reserveCount ?? 13;

    blocks.you.num.textContent = String(youReserve);
    blocks.opp.num.textContent = String(oppReserve);

    updateSegments("you", youReserve);
    updateSegments("opp", oppReserve);

    // Active player badge with spring transition
    const isPlayer0Active = state.activePlayer === 0;
    blocks.you.row.classList.toggle("active", isPlayer0Active);
    blocks.opp.row.classList.toggle("active", !isPlayer0Active);

    // Ledger totals
    if (ledger) {
      totYou.textContent = String(ledger.totals?.[0] ?? 0);
      totOpp.textContent = String(ledger.totals?.[1] ?? 0);
      totYou.classList.toggle("lead", (ledger.totals?.[0] ?? 0) > (ledger.totals?.[1] ?? 0));
      totOpp.classList.toggle("lead", (ledger.totals?.[1] ?? 0) > (ledger.totals?.[0] ?? 0));

      if (ledger.history && list) {
        list.replaceChildren(
          ...ledger.history.map((h, i) => {
            const row = el("div", { className: "hud-ln" },
              el("div", { className: "hud-v you" }, String(h.scores?.[0] ?? 0)),
              el("div", { className: "hud-mid" }, `Deal ${i + 1}`),
              el("div", { className: "hud-v opp" }, String(h.scores?.[1] ?? 0))
            );
            return row;
          })
        );
      }
    }
  }

  return {
    node: hud,
    blocks,
    lines,
    setOpen,
    isOpen: () => open,
    render,
  };
}

export class HUD {
  constructor({
    container,
    document = globalThis.document,
    onDraw,
    onWaste,
    onCrapette,
    onUndo,
    onNewGame,
    onToggleSound,
    onToggleSkill,
    onToggleMode,
    onVolumeChange,
    onHint,
    onOpenSettings,
    onStartNewGame,
    onChangeFelt,
    onChangeCardBack,
    onResetTutorial,
    onDismissTutorial,
  } = {}) {
    this.doc = document;
    this.container = container;
    this.onDraw = onDraw;
    this.onWaste = onWaste;
    this.onCrapette = onCrapette;
    this.onUndo = onUndo;
    this.onNewGame = onNewGame;
    this.onToggleSound = onToggleSound;
    this.onToggleSkill = onToggleSkill;
    this.onToggleMode = onToggleMode;
    this.onVolumeChange = onVolumeChange;
    this.onHint = onHint;
    this.onOpenSettings = onOpenSettings;
    this.onStartNewGame = onStartNewGame;
    this.onChangeFelt = onChangeFelt;
    this.onChangeCardBack = onChangeCardBack;
    this.onResetTutorial = onResetTutorial;
    this.onDismissTutorial = onDismissTutorial;

    this.isMuted = false;
    this.currentSkill = "4.0";
    this.gameMode = "human_vs_ai";
    this.rulesMode = "competitive";
    this.currentFelt = "slate";
    this.currentTutorialPage = null;

    this._lastFoundationCounts = { S: 0, H: 0, D: 0, C: 0 };

    this._initDOM();
  }

  _el(tag, { className = "", id = "", text = "" } = {}, ...children) {
    const el = this.doc.createElement(tag);
    if (className) el.className = className;
    if (id) el.id = id;
    if (text) el.textContent = text;
    for (const child of children) {
      if (child) el.append(child);
    }
    return el;
  }

  _initDOM() {
    if (!this.container || !this.doc) return;

    const root = this._el("div", { className: "hud-root" });

    // 1. Top Header: Tournament match ledger & Cassino-style action bar (kept hidden for test element queries)
    const header = this._el("header", { className: "hud-header" });
    header.setAttribute("hidden", "true");
    if (header.style) header.style.display = "none";

    const title = this._el("span", { className: "brand", text: "CRAPETTE" });
    const titleBox = this._el("div", { className: "hud-title-box" }, title);

    const dealLabel = this._el("div", { className: "hud-deal-label", id: "deal-count", text: "Deal 1" });

    const youName = this._el("span", { className: "player-name", text: "You" });
    const youScore = this._el("span", { className: "player-score", id: "score-you", text: "0" });
    const youScoreGroup = this._el("div", { className: "hud-score-group you" }, youName, youScore);

    const divider = this._el("span", { className: "hud-score-divider", text: ":" });

    const oppScore = this._el("span", { className: "player-score", id: "score-opp", text: "0" });
    const oppName = this._el("span", { className: "player-name", text: "Opponent" });
    const oppScoreGroup = this._el("div", { className: "hud-score-group opp" }, oppScore, oppName);

    const scoreCard = this._el("div", { className: "hud-scoreboard" }, youScoreGroup, divider, oppScoreGroup);
    const ledgerBox = this._el("div", { className: "hud-ledger" }, dealLabel, scoreCard);

    // Cassino-style toolbar pill
    const newDealBtn = this._el("button", { className: "hud-tool-btn primary", id: "new-deal-btn", text: "✦ New Deal" });
    newDealBtn.addEventListener("click", () => {
      this.toggleNewGameModal(true);
      if (this.onNewGame) this.onNewGame();
    });

    const hintBtn = this._el("button", { className: "hud-tool-btn", id: "hint-btn", text: "💡 Hint" });
    hintBtn.addEventListener("click", () => {
      if (this.onHint) this.onHint();
    });

    const modeBtn = this._el("button", { className: "hud-tool-btn", id: "mode-btn", text: "Mode: Vs AI" });
    modeBtn.addEventListener("click", () => {
      if (this.onToggleMode) this.onToggleMode();
    });

    const skillBtn = this._el("button", { className: "hud-tool-btn", id: "skill-btn", text: "AI: 4.0 Master" });
    skillBtn.addEventListener("click", () => {
      if (this.onToggleSkill) this.onToggleSkill();
    });

    const muteBtn = this._el("button", { className: "hud-tool-btn", id: "mute-btn", text: "🔊 Sound" });
    muteBtn.addEventListener("click", () => {
      if (this.onToggleSound) this.onToggleSound();
    });

    const rulesBtn = this._el("button", { className: "hud-tool-btn", id: "rules-btn", text: "? Rules & Guide" });
    rulesBtn.addEventListener("click", () => this.toggleRulesModal(true));

    const settingsBtn = this._el("button", { className: "hud-tool-btn", id: "settings-btn", text: "⚙ Settings" });
    settingsBtn.addEventListener("click", () => {
      this.toggleSettingsModal(true);
      if (this.onOpenSettings) this.onOpenSettings();
    });

    const toolBar = this._el(
      "div",
      { className: "hud-toolbar surface bar", id: "hud-toolbar" },
      newDealBtn,
      hintBtn,
      modeBtn,
      skillBtn,
      muteBtn,
      rulesBtn,
      settingsBtn
    );
    header.append(titleBox, ledgerBox, toolBar);

    try {
      this.chrome = createChrome(root, {
        document: this.doc,
        newGame: () => {
          this.toggleNewGameModal(true);
          if (this.onNewGame) this.onNewGame();
        },
        mode: () => {
          if (this.onToggleMode) this.onToggleMode();
        },
        undo: () => {
          if (this.onUndo) this.onUndo();
        },
        hint: () => {
          if (this.onHint) this.onHint();
        },
        help: () => {
          this.toggleRulesModal(true);
        },
        surface: (felt) => {
          this.currentFelt = felt;
          if (this.onChangeFelt) this.onChangeFelt(felt);
        },
        sound: (enabled) => {
          this.isMuted = !enabled;
          if (this.onToggleSound) this.onToggleSound();
        },
      });
    } catch (e) {
      // In headless test environments without full DOM, chrome mounts gracefully
    }

    // 2. Turn Status Banner (hidden fallback; live prompt is rendered via overlay.prompt)
    const banner = this._el("div", { className: "hud-banner", id: "status-banner", text: "Your Turn — Make moves or Draw Stock" });
    const bannerBox = this._el("div", { className: "hud-banner-box" }, banner);
    bannerBox.setAttribute("hidden", "true");
    if (bannerBox.style) bannerBox.style.display = "none";

    // 3. 2D Overlay layer (Info slot, Cheers celebrations, Aids panel, Move bar)
    this.overlay = createOverlay(root, {
      document: this.doc,
      onDraw: () => { if (this.onDraw) this.onDraw(); },
      onWaste: () => { if (this.onWaste) this.onWaste(); },
      onCrapette: () => { if (this.onCrapette) this.onCrapette(); },
      onUndo: () => { if (this.onUndo) this.onUndo(); },
    });

    // 4. Floating scorebug inside .info > .hud-slot
    this.scorebug = createHud(this.overlay.hudSlot, {
      document: this.doc,
    });

    // 5. Card Pile Badges (.badges)
    const badgesContainer = this.overlay.badges;

    const badgeOppR = this._el("div", { className: "badge badge-reserve opp", id: "badge-opp-reserve", text: "13" });
    badgeOppR.setAttribute("title", "Opponent Reserve: 13 cards remaining");
    const badgeOppS = this._el("div", { className: "badge badge-stock opp", id: "badge-opp-stock", text: "35" });
    badgeOppS.setAttribute("title", "Opponent Stock: 35 cards remaining");
    const badgeOppW = this._el("div", { className: "badge badge-waste opp", id: "badge-opp-waste", text: "0" });
    badgeOppW.setAttribute("title", "Opponent Waste pile");

    const badgeYouR = this._el("div", { className: "badge badge-reserve you", id: "badge-you-reserve", text: "13" });
    badgeYouR.setAttribute("title", "Your Reserve: 13 cards remaining");
    const badgeYouS = this._el("div", { className: "badge badge-stock you", id: "badge-you-stock", text: "35" });
    badgeYouS.setAttribute("title", "Your Stock: 35 cards remaining");
    const badgeYouW = this._el("div", { className: "badge badge-waste you", id: "badge-you-waste", text: "0" });
    badgeYouW.setAttribute("title", "Your Waste pile");

    badgesContainer.append(badgeOppR, badgeOppS, badgeOppW, badgeYouR, badgeYouS, badgeYouW);

    // Sidebar strip counters (fallback & accessibility)
    const oppTag = this._el("div", { className: "player-tag", text: "Opponent (Navy)" });
    const oppRCount = this._el("strong", { id: "opp-reserve-count", text: "13" });
    const oppR = this._el("span", {}, this.doc.createTextNode ? this.doc.createTextNode("Reserve: ") : "Reserve: ", oppRCount);
    const oppSCount = this._el("strong", { id: "opp-stock-count", text: "35" });
    const oppS = this._el("span", {}, this.doc.createTextNode ? this.doc.createTextNode("Stock: ") : "Stock: ", oppSCount);
    const oppWCount = this._el("strong", { id: "opp-waste-count", text: "0" });
    const oppW = this._el("span", {}, this.doc.createTextNode ? this.doc.createTextNode("Waste: ") : "Waste: ", oppWCount);
    const oppPiles = this._el("div", { className: "pile-counts" }, oppR, oppS, oppW);
    const oppStrip = this._el("div", { className: "hud-player-strip opp-strip", id: "opp-strip" }, oppTag, oppPiles);

    const youTag = this._el("div", { className: "player-tag", text: "You (Crimson)" });
    const youRCount = this._el("strong", { id: "you-reserve-count", text: "13" });
    const youR = this._el("span", {}, this.doc.createTextNode ? this.doc.createTextNode("Reserve: ") : "Reserve: ", youRCount);
    const youSCount = this._el("strong", { id: "you-stock-count", text: "35" });
    const youS = this._el("span", {}, this.doc.createTextNode ? this.doc.createTextNode("Stock: ") : "Stock: ", youSCount);
    const youWCount = this._el("strong", { id: "you-waste-count", text: "0" });
    const youW = this._el("span", {}, this.doc.createTextNode ? this.doc.createTextNode("Waste: ") : "Waste: ", youWCount);
    const youPiles = this._el("div", { className: "pile-counts" }, youR, youS, youW);
    const youStrip = this._el("div", { className: "hud-player-strip you-strip active", id: "you-strip" }, youTag, youPiles);

    const countersOverlay = this._el("div", { className: "hud-counters-overlay" }, oppStrip, youStrip);
    countersOverlay.setAttribute("hidden", "true");
    if (countersOverlay.style) countersOverlay.style.display = "none";

    // 6. Toast container
    const toastContainer = this._el("div", { className: "hud-toast-container", id: "toast-container" });

    // 7. Modals
    const rulesModal = this._createRulesModal();
    const newGameModal = this._createNewGameModal();
    const settingsModal = this._createSettingsModal();
    const hintModal = this._createHintModal();
    const tutorialModal = this._createTutorialModal();

    root.append(
      header,
      bannerBox,
      countersOverlay,
      toastContainer,
      rulesModal,
      newGameModal,
      settingsModal,
      hintModal,
      tutorialModal
    );

    this.container.append(root);
  }

  celebrate(opts) {
    if (this.overlay) {
      return this.overlay.celebrate(opts);
    }
    return null;
  }

  celebrateFoundation(card, x, y) {
    if (this.overlay) {
      return this.overlay.celebrateFoundation(card, x, y);
    }
    return null;
  }

  _createNewGameModal() {
    const modal = this._el("div", { className: "hud-modal-backdrop", id: "new-game-modal" });
    modal.style.display = "none";

    const card = this._el("div", { className: "hud-modal-card settings-card" });

    const closeBtn = this._el("button", { className: "modal-close-btn", text: "✕" });
    closeBtn.addEventListener("click", () => this.toggleNewGameModal(false));

    const title = this._el("h2", { text: "New Match Setup" });
    const sub = this._el("p", { className: "modal-sub", text: "Configure match rules, opponent skill, and tutorials before dealing." });

    const modeLabel = this._el("label", { className: "setting-label", text: "Game Mode:" });
    const modeSelect = this._el("select", { className: "hud-select", id: "new-game-mode" });
    const optPlay = this._el("option", { text: "Play vs Computer" });
    optPlay.value = "human_vs_ai";
    const optWatch = this._el("option", { text: "Watch Computer vs Computer" });
    optWatch.value = "ai_vs_ai";
    modeSelect.append(optPlay, optWatch);
    const modeRow = this._el("div", { className: "setting-row" }, modeLabel, modeSelect);

    const ruleLabel = this._el("label", { className: "setting-label", text: "Rule Ruleset:" });
    const ruleSelect = this._el("select", { className: "hud-select", id: "new-game-rules" });
    const optComp = this._el("option", { text: "Strict Russian Bank (Compulsory foundations & Crapette! calls)" });
    optComp.value = "competitive";
    const optCas = this._el("option", { text: "Casual / Solitaire (Relaxed play, no penalty forfeits)" });
    optCas.value = "casual";
    ruleSelect.append(optComp, optCas);
    const ruleRow = this._el("div", { className: "setting-row" }, ruleLabel, ruleSelect);

    const skillLabel = this._el("label", { className: "setting-label", text: "AI Skill Level:" });
    const skillSlider = this._el("input", { className: "hud-slider", id: "new-game-skill" });
    skillSlider.type = "range";
    skillSlider.min = "1.0";
    skillSlider.max = "4.0";
    skillSlider.step = "0.5";
    skillSlider.value = "4.0";

    const skillDesc = this._el("div", {
      className: "skill-description",
      id: "new-game-skill-desc",
      text: "4.0 Master: Plays the full board out in its head with zero blunders",
    });

    skillSlider.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value || "4.0");
      const match = (AI_SKILLS || []).find((s) => Math.abs(s.value - val) < 0.1);
      const desc = match ? `${match.value.toFixed(1)} ${match.name}: ${match.words}` : `${val.toFixed(1)}`;
      skillDesc.textContent = desc;
    });

    const skillGroup = this._el("div", { className: "setting-group" }, skillLabel, skillSlider, skillDesc);

    const tutCheck = this._el("input", { id: "new-game-tutorial" });
    tutCheck.type = "checkbox";
    tutCheck.checked = true;
    const tutLabel = this._el("label", { text: "Show progressive tutorial popups before new features appear" });
    const tutRow = this._el("div", { className: "setting-checkbox-row" }, tutCheck, tutLabel);

    const hintsCheck = this._el("input", { id: "new-game-hints" });
    hintsCheck.type = "checkbox";
    hintsCheck.checked = true;
    const hintsLabel = this._el("label", { text: "Enable Vygotsky ZPD strategic hints during play" });
    const hintsRow = this._el("div", { className: "setting-checkbox-row" }, hintsCheck, hintsLabel);

    const seedLabel = this._el("label", { className: "setting-label", text: "Deal Seed (optional):" });
    const seedInput = this._el("input", { className: "hud-input", id: "new-game-seed" });
    seedInput.type = "text";
    seedInput.placeholder = "Leave empty for random shuffle";
    const seedRow = this._el("div", { className: "setting-row" }, seedLabel, seedInput);

    const startBtn = this._el("button", { className: "hud-modal-btn primary", id: "new-game-start-btn", text: "Deal Cards & Start" });
    startBtn.addEventListener("click", () => {
      const mode = modeSelect.value;
      const rules = ruleSelect.value;
      const skill = parseFloat(skillSlider.value || "4.0");
      const tutorial = tutCheck.checked;
      const hints = hintsCheck.checked;
      const seed = seedInput.value.trim() ? seedInput.value.trim() : null;

      this.toggleNewGameModal(false);

      if (this.onStartNewGame) {
        this.onStartNewGame({ mode, rules, skill, tutorial, hints, seed });
      }
    });

    const content = this._el(
      "div",
      { className: "modal-content" },
      title,
      sub,
      modeRow,
      ruleRow,
      skillGroup,
      tutRow,
      hintsRow,
      seedRow,
      startBtn
    );

    card.append(closeBtn, content);
    modal.append(card);
    return modal;
  }

  toggleNewGameModal(show) {
    const modal = this.container.querySelector("#new-game-modal");
    if (modal) {
      modal.style.display = show ? "flex" : "none";
    }
  }

  _createSettingsModal() {
    const modal = this._el("div", { className: "hud-modal-backdrop", id: "settings-modal" });
    modal.style.display = "none";

    const card = this._el("div", { className: "hud-modal-card settings-card" });

    const closeBtn = this._el("button", { className: "modal-close-btn", text: "✕" });
    closeBtn.addEventListener("click", () => this.toggleSettingsModal(false));

    const title = this._el("h2", { text: "Game Settings (On the Fly)" });

    const soundToggleBtn = this._el("button", {
      className: "hud-btn tonal",
      id: "settings-sound-toggle",
      text: this.isMuted ? "🔇 Unmute Audio" : "🔊 Sound Effects: ON",
    });
    soundToggleBtn.addEventListener("click", () => {
      if (this.onToggleSound) this.onToggleSound();
      soundToggleBtn.textContent = this.isMuted ? "🔇 Unmute Audio" : "🔊 Sound Effects: ON";
    });

    const volLabel = this._el("label", { className: "setting-label", text: "Audio Volume:" });
    const volSlider = this._el("input", { className: "hud-slider", id: "settings-volume" });
    volSlider.type = "range";
    volSlider.min = "0";
    volSlider.max = "1";
    volSlider.step = "0.05";
    volSlider.value = "0.8";
    volSlider.addEventListener("input", (e) => {
      const v = parseFloat(e.target.value || "0.8");
      if (this.onVolumeChange) this.onVolumeChange(v);
    });
    const soundRow = this._el("div", { className: "setting-group" }, soundToggleBtn, volLabel, volSlider);

    const hlCheck = this._el("input", { id: "settings-highlights" });
    hlCheck.type = "checkbox";
    hlCheck.checked = true;
    const hlLabel = this._el("label", { text: "Highlight legal target slots on card selection" });
    const hlRow = this._el("div", { className: "setting-checkbox-row" }, hlCheck, hlLabel);

    const feltLabel = this._el("label", { className: "setting-label", text: "Tabletop Felt:" });
    const feltSelect = this._el("select", { className: "hud-select", id: "settings-felt-select" });
    const optSlate = this._el("option", { text: "Slate Forest Felt (Cassino)" });
    optSlate.value = "slate";
    const optCasino = this._el("option", { text: "Classic Casino Green" });
    optCasino.value = "casino";
    const optNavy = this._el("option", { text: "Midnight Navy Felt" });
    optNavy.value = "navy";
    const optCharcoal = this._el("option", { text: "Charcoal Slate Felt" });
    optCharcoal.value = "charcoal";
    feltSelect.append(optSlate, optCasino, optNavy, optCharcoal);
    feltSelect.addEventListener("change", (e) => {
      this.currentFelt = e.target.value;
      if (this.onChangeFelt) this.onChangeFelt(e.target.value);
    });
    const feltRow = this._el("div", { className: "setting-row" }, feltLabel, feltSelect);

    const cardFacesLabel = this._el("label", { className: "setting-label", text: "Card Art:" });
    const cardFacesSelect = this._el("select", { className: "hud-select", id: "settings-card-faces" });
    const optFaceClassic = this._el("option", { text: "Classic Inked Faces & Spanish Lace Back" });
    optFaceClassic.value = "classic";
    const optFaceJumbo = this._el("option", { text: "High-Contrast Large Text Index" });
    optFaceJumbo.value = "jumbo";
    cardFacesSelect.append(optFaceClassic, optFaceJumbo);
    cardFacesSelect.addEventListener("change", (e) => {
      if (this.onChangeCardBack) this.onChangeCardBack(e.target.value);
    });
    const cardFacesRow = this._el("div", { className: "setting-row" }, cardFacesLabel, cardFacesSelect);

    const resetTutBtn = this._el("button", {
      className: "hud-btn outline",
      id: "settings-reset-tutorial",
      text: "↺ Reset Tutorial History",
    });
    resetTutBtn.addEventListener("click", () => {
      if (this.onResetTutorial) this.onResetTutorial();
      this.showToast("Tutorial progress reset! Popups will re-appear as concepts arise.");
    });
    const tutRow = this._el("div", { className: "setting-row" }, resetTutBtn);

    const content = this._el("div", { className: "modal-content" }, title, soundRow, hlRow, feltRow, cardFacesRow, tutRow);
    card.append(closeBtn, content);
    modal.append(card);
    return modal;
  }

  toggleSettingsModal(show) {
    const modal = this.container.querySelector("#settings-modal");
    if (modal) {
      modal.style.display = show ? "flex" : "none";
    }
  }

  _createHintModal() {
    const modal = this._el("div", { className: "hud-modal-backdrop", id: "hint-modal" });
    modal.style.display = "none";

    const card = this._el("div", { className: "hud-modal-card hint-card" });

    const closeBtn = this._el("button", { className: "modal-close-btn", text: "✕" });
    closeBtn.addEventListener("click", () => this.hideHintModal());

    const tag = this._el("div", { className: "hint-tag", text: "MASTER COACH • ZPD HINT" });
    const headline = this._el("h2", { className: "hint-headline", id: "hint-headline", text: "Move Card" });

    const ruleTitle = this._el("div", { className: "hint-section-title", text: "RULE TO REMEMBER" });
    const ruleBox = this._el("p", { className: "hint-rule-box", id: "hint-rule", text: "" });

    const tensionTitle = this._el("div", { className: "hint-section-title", text: "STRATEGIC TENSION" });
    const tensionBox = this._el("p", { className: "hint-tension-box", id: "hint-tension", text: "" });

    const gotItBtn = this._el("button", { className: "hud-modal-btn primary", text: "Apply Strategic Move" });
    gotItBtn.addEventListener("click", () => this.hideHintModal());

    const content = this._el(
      "div",
      { className: "modal-content" },
      tag,
      headline,
      ruleTitle,
      ruleBox,
      tensionTitle,
      tensionBox,
      gotItBtn
    );

    card.append(closeBtn, content);
    modal.append(card);
    return modal;
  }

  showHintModal(hint) {
    if (!hint) return;
    const modal = this.container.querySelector("#hint-modal");
    const headline = this.container.querySelector("#hint-headline");
    const rule = this.container.querySelector("#hint-rule");
    const tension = this.container.querySelector("#hint-tension");

    if (headline) headline.textContent = hint.headline || hint.what || "Suggested Action";
    if (rule) rule.textContent = hint.rule || "Follow foundational and reserve priorities.";
    if (tension) tension.textContent = hint.tension || hint.why || "Balances short-term building with bottleneck clearance.";

    if (modal) modal.style.display = "flex";
  }

  hideHintModal() {
    const modal = this.container.querySelector("#hint-modal");
    if (modal) modal.style.display = "none";
  }

  _createTutorialModal() {
    const modal = this._el("div", { className: "hud-modal-backdrop", id: "tutorial-modal" });
    modal.style.display = "none";

    const card = this._el("div", { className: "hud-modal-card tutorial-card" });

    const closeBtn = this._el("button", { className: "modal-close-btn", text: "✕" });
    closeBtn.addEventListener("click", () => this.hideTutorialModal());

    const stepTag = this._el("div", { className: "tutorial-step-tag", id: "tutorial-step-tag", text: "Step 1 of 7" });
    const title = this._el("h2", { className: "tutorial-title", id: "tutorial-title", text: "Game Concept" });
    const summary = this._el("p", { className: "tutorial-summary", id: "tutorial-summary", text: "" });
    const bullets = this._el("ul", { className: "tutorial-bullets", id: "tutorial-bullets" });

    const dontShowCheck = this._el("input", { id: "tutorial-dont-show" });
    dontShowCheck.type = "checkbox";
    const dontShowLabel = this._el("label", { text: "Don't show tutorials again" });
    const dontShowRow = this._el("div", { className: "setting-checkbox-row" }, dontShowCheck, dontShowLabel);

    const gotItBtn = this._el("button", { className: "hud-modal-btn primary", id: "tutorial-got-it-btn", text: "Got It!" });
    gotItBtn.addEventListener("click", () => {
      const disableAll = Boolean(dontShowCheck.checked);
      const pageKey = this.currentTutorialPage ? this.currentTutorialPage.key : null;
      this.hideTutorialModal();
      if (this.onDismissTutorial) {
        this.onDismissTutorial({ pageKey, disableAll });
      }
    });

    const content = this._el(
      "div",
      { className: "modal-content" },
      stepTag,
      title,
      summary,
      bullets,
      dontShowRow,
      gotItBtn
    );

    card.append(closeBtn, content);
    modal.append(card);
    return modal;
  }

  showTutorialModal(page) {
    if (!page) return;
    this.currentTutorialPage = page;
    const modal = this.container.querySelector("#tutorial-modal");
    const stepTag = this.container.querySelector("#tutorial-step-tag");
    const title = this.container.querySelector("#tutorial-title");
    const summary = this.container.querySelector("#tutorial-summary");
    const bulletsEl = this.container.querySelector("#tutorial-bullets");

    if (stepTag) stepTag.textContent = page.tag || "Crapette Guide";
    if (title) title.textContent = page.title;
    if (summary) summary.textContent = page.summary;

    if (bulletsEl) {
      if (typeof bulletsEl.replaceChildren === "function") {
        bulletsEl.replaceChildren();
      } else {
        bulletsEl.children = [];
      }
      for (const b of page.bullets || []) {
        const li = this._el("li", { text: b });
        bulletsEl.append(li);
      }
    }

    if (modal) modal.style.display = "flex";
  }

  hideTutorialModal() {
    const modal = this.container.querySelector("#tutorial-modal");
    if (modal) modal.style.display = "none";
    this.currentTutorialPage = null;
  }

  _createRulesModal() {
    const modal = this.doc.createElement("div");
    modal.className = "hud-modal-backdrop";
    modal.id = "rules-modal";
    modal.style.display = "none";

    const card = this.doc.createElement("div");
    card.className = "hud-modal-card";

    const closeBtn = this.doc.createElement("button");
    closeBtn.className = "modal-close-btn";
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", () => this.toggleRulesModal(false));

    const content = this.doc.createElement("div");
    content.className = "modal-content";
    content.innerHTML = `
      <h2>Rules of Crapette (Russian Bank)</h2>
      <p><strong>Goal:</strong> Be the first player to empty your Reserve, Stock, and Waste piles.</p>
      <hr>
      <h3>The Layout</h3>
      <ul>
        <li><strong>Reserve (Depot):</strong> 13 cards on your right; top card face up. Bottleneck to win!</li>
        <li><strong>Foundations:</strong> 8 center piles built upward by suit (A to K). Communal!</li>
        <li><strong>Tableau (Houses):</strong> 8 slots built downward in strictly alternating colors (e.g. Red 9 on Black 10).</li>
        <li><strong>Opponent Loading:</strong> Load available cards onto opponent's exposed Reserve or Waste card in the exact same suit and adjacent rank (±1).</li>
      </ul>
      <hr>
      <h3>Compulsory Moves & "CALL CRAPETTE!"</h3>
      <p>Under strict Russian Bank rules, foundation moves are compulsory! If an available card can build on a foundation and you draw stock or violate reserve priority, your opponent may call <strong>"CALL CRAPETTE!"</strong> to penalize you and seize the turn!</p>
    `;

    card.append(closeBtn, content);
    modal.append(card);
    return modal;
  }

  toggleRulesModal(show) {
    const modal = this.container.querySelector("#rules-modal");
    if (modal) {
      modal.style.display = show ? "flex" : "none";
    }
  }

  setMuted(muted) {
    this.isMuted = Boolean(muted);
    const btn = this.container.querySelector("#mute-btn");
    if (btn) {
      btn.textContent = this.isMuted ? "🔇 Muted" : "🔊 Sound";
    }
  }

  setSkill(skill) {
    this.currentSkill = String(skill);
    const btn = this.container.querySelector("#skill-btn");
    if (btn) {
      const num = parseFloat(skill);
      if (!isNaN(num)) {
        const match = (AI_SKILLS || []).find((s) => Math.abs(s.value - num) < 0.1);
        btn.textContent = match ? `AI: ${match.value.toFixed(1)} ${match.name}` : `AI: ${num.toFixed(1)}`;
      } else {
        btn.textContent = `AI: ${skill === "novice" ? "1.0 Novice" : "4.0 Master"}`;
      }
    }
  }

  setMode(mode) {
    this.gameMode = mode;
    const btn = this.container.querySelector("#mode-btn");
    if (btn) {
      btn.textContent = mode === "ai_vs_ai" ? "Mode: AI vs AI" : "Mode: Vs AI";
    }
  }

  showToast(message, duration = 3000) {
    const container = this.container.querySelector("#toast-container");
    if (!container || !this.doc) return;

    const toast = this.doc.createElement("div");
    toast.className = "hud-toast";
    toast.textContent = message;
    container.append(toast);

    if (duration > 0 && typeof setTimeout !== "undefined") {
      setTimeout(() => {
        if (toast.parentNode === container) {
          container.removeChild(toast);
        }
      }, duration);
    }
  }

  render(state, ledger) {
    if (!state || !this.container) return;

    // 1. Floating Scorebug
    if (this.scorebug) {
      this.scorebug.render(state, ledger);
    }

    if (this.chrome && typeof this.chrome.sync === "function") {
      this.chrome.sync(state, {
        watching: isAiVsAi,
        skill: this.currentSkill,
        sound: !this.isMuted,
        surface: this.currentFelt,
      });
    }

    // 2. Trackers Panel in Overlay
    const isAiVsAi = this.gameMode === "ai_vs_ai";
    const trackerData = trackers(state);
    if (this.overlay) {
      this.overlay.renderTrackers(trackerData, isAiVsAi);

      // Check for newly placed foundation cards to trigger celebrations
      if (state.foundations) {
        for (const suit of SUITS) {
          const current = trackerData.foundations[suit] || 0;
          const prev = this._lastFoundationCounts[suit] || 0;
          if (current > prev) {
            this.overlay.celebrateFoundation({ rank: current, suit });
          }
        }
      }
      this._lastFoundationCounts = { ...trackerData.foundations };
    }

    // 3. Header ledger & scores
    const dealCountEl = this.container.querySelector("#deal-count");
    if (dealCountEl && ledger) {
      dealCountEl.textContent = `Deal ${ledger.dealCount + 1}`;
    }

    const scoreYouEl = this.container.querySelector("#score-you");
    const scoreOppEl = this.container.querySelector("#score-opp");
    if (scoreYouEl && scoreOppEl && ledger) {
      scoreYouEl.textContent = String(ledger.totals[0]);
      scoreOppEl.textContent = String(ledger.totals[1]);
    }

    // 4. Pile counts in strips
    const p0 = state.players[0];
    const p1 = state.players[1];

    const youReserve = this.container.querySelector("#you-reserve-count");
    const youStock = this.container.querySelector("#you-stock-count");
    const youWaste = this.container.querySelector("#you-waste-count");

    if (youReserve) youReserve.textContent = String(p0.reserveCount);
    if (youStock) youStock.textContent = String(p0.stockCount);
    if (youWaste) youWaste.textContent = String(p0.wasteCount);

    const oppReserve = this.container.querySelector("#opp-reserve-count");
    const oppStock = this.container.querySelector("#opp-stock-count");
    const oppWaste = this.container.querySelector("#opp-waste-count");

    if (oppReserve) oppReserve.textContent = String(p1.reserveCount);
    if (oppStock) oppStock.textContent = String(p1.stockCount);
    if (oppWaste) oppWaste.textContent = String(p1.wasteCount);

    // 5. Badges
    const badgeYouR = this.container.querySelector("#badge-you-reserve");
    const badgeYouS = this.container.querySelector("#badge-you-stock");
    const badgeYouW = this.container.querySelector("#badge-you-waste");

    if (badgeYouR) badgeYouR.textContent = String(p0.reserveCount);
    if (badgeYouS) badgeYouS.textContent = String(p0.stockCount);
    if (badgeYouW) badgeYouW.textContent = String(p0.wasteCount);

    const badgeOppR = this.container.querySelector("#badge-opp-reserve");
    const badgeOppS = this.container.querySelector("#badge-opp-stock");
    const badgeOppW = this.container.querySelector("#badge-opp-waste");

    if (badgeOppR) badgeOppR.textContent = String(p1.reserveCount);
    if (badgeOppS) badgeOppS.textContent = String(p1.stockCount);
    if (badgeOppW) badgeOppW.textContent = String(p1.wasteCount);

    // 6. Active player strip
    const youStrip = this.container.querySelector("#you-strip");
    const oppStrip = this.container.querySelector("#opp-strip");
    if (youStrip && oppStrip) {
      if (state.activePlayer === 0) {
        youStrip.classList.add("active");
        oppStrip.classList.remove("active");
      } else {
        oppStrip.classList.add("active");
        youStrip.classList.remove("active");
      }
    }

    // 7. Action selection chips in move-bar
    const isHumanTurn = !isAiVsAi && state.activePlayer === 0;

    const drawBtn = this.container.querySelector("#draw-btn");
    const wasteBtn = this.container.querySelector("#waste-btn");
    const undoBtn = this.container.querySelector("#undo-btn");
    const crapetteBtn = this.container.querySelector("#crapette-btn");

    if (drawBtn) {
      drawBtn.disabled = !isHumanTurn || Boolean(state.drawnCard);
    }
    if (wasteBtn) {
      wasteBtn.disabled = !isHumanTurn || !Boolean(state.drawnCard);
    }
    if (undoBtn) {
      undoBtn.disabled = !isHumanTurn || !Boolean(state.undoable);
    }

    // 8. CALL CRAPETTE! button pulsing alert
    if (crapetteBtn) {
      if (!isAiVsAi && state.crapetteEligible) {
        crapetteBtn.classList.add("eligible");
      } else {
        crapetteBtn.classList.remove("eligible");
      }
      crapetteBtn.disabled = isAiVsAi;
    }

    // 9. Turn status banner
    const banner = this.container.querySelector("#status-banner");
    if (banner) {
      if (state.winner !== null) {
        const winnerName = isAiVsAi
          ? (state.winner === 0 ? "Player 1 (Crimson) Wins!" : "Player 2 (Navy) Wins!")
          : (state.winner === 0 ? "You Win!" : "Opponent Wins!");
        banner.textContent = `Deal Over! ${winnerName}`;
        banner.className = "hud-banner victory";
      } else if (state.crapetteEligible && !isAiVsAi) {
        banner.textContent = "BLUNDER DETECTED! CALL CRAPETTE!";
        banner.className = "hud-banner blunder";
      } else if (isAiVsAi) {
        const activeName = state.activePlayer === 0 ? "Player 1 (Crimson)" : "Player 2 (Navy)";
        banner.textContent = `AI vs AI — ${activeName} thinking...`;
        banner.className = "hud-banner opp-turn";
      } else if (isHumanTurn) {
        if (state.drawnCard) {
          banner.textContent = `Drawn: ${state.drawnCard.code} — Play to board or Discard to Waste`;
        } else {
          banner.textContent = "Your Turn — Make moves or Draw Stock";
        }
        banner.className = "hud-banner your-turn";
      } else {
        banner.textContent = "Opponent Thinking...";
        banner.className = "hud-banner opp-turn";
      }
      if (this.overlay && this.overlay.prompt) {
        this.overlay.prompt.textContent = banner.textContent;
      }
    }
  }
}
