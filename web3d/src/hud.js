// HUD interface, Material Design 3 surfaces, and Cassino-style card badges for Crapette

import { AI_SKILLS } from "../../src/engine/ai.js";

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
    this.currentSkill = "4.0"; // numeric or "master" | "novice"
    this.gameMode = "human_vs_ai"; // "human_vs_ai" | "ai_vs_ai"
    this.rulesMode = "competitive"; // "competitive" | "casual"
    this.currentFelt = "slate";
    this.currentTutorialPage = null;

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

    // 1. Top Header: Tournament match ledger & Cassino-style action bar
    const header = this._el("header", { className: "hud-header" });

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

    // 2. Turn Status Banner
    const banner = this._el("div", { className: "hud-banner", id: "status-banner", text: "Your Turn — Make moves or Draw Stock" });
    const bannerBox = this._el("div", { className: "hud-banner-box" }, banner);

    // 3. Card Pile Badges Container (Cassino-style .badge floating discs)
    const badgesContainer = this._el("div", { className: "badges" });

    // Opponent badges
    const badgeOppR = this._el("div", { className: "badge badge-reserve opp", id: "badge-opp-reserve", text: "13" });
    badgeOppR.setAttribute("title", "Opponent Reserve: 13 cards remaining");
    const badgeOppS = this._el("div", { className: "badge badge-stock opp", id: "badge-opp-stock", text: "35" });
    badgeOppS.setAttribute("title", "Opponent Stock: 35 cards remaining");
    const badgeOppW = this._el("div", { className: "badge badge-waste opp", id: "badge-opp-waste", text: "0" });
    badgeOppW.setAttribute("title", "Opponent Waste pile");

    // You badges
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

    // 4. Action Move Bar: prominent "CALL CRAPETTE!" button + action buttons
    const crapetteGlow = this._el("span", { className: "btn-glow" });
    const crapetteText = this._el("span", { className: "btn-text", text: "CALL CRAPETTE!" });
    const crapetteSub = this._el("span", { className: "btn-subtext", text: "Claim Blunder & Seize Turn" });
    const crapetteBtn = this._el("button", { className: "crapette-btn", id: "crapette-btn" }, crapetteGlow, crapetteText, crapetteSub);
    crapetteBtn.addEventListener("click", () => {
      if (this.onCrapette) this.onCrapette();
    });

    const drawBtn = this._el("button", { className: "hud-action-btn", id: "draw-btn", text: "Draw Stock" });
    drawBtn.addEventListener("click", () => {
      if (this.onDraw) this.onDraw();
    });

    const wasteBtn = this._el("button", { className: "hud-action-btn", id: "waste-btn", text: "Discard to Waste" });
    wasteBtn.disabled = true;
    wasteBtn.addEventListener("click", () => {
      if (this.onWaste) this.onWaste();
    });

    const undoBtn = this._el("button", { className: "hud-action-btn", id: "undo-btn", text: "Undo" });
    undoBtn.disabled = true;
    undoBtn.addEventListener("click", () => {
      if (this.onUndo) this.onUndo();
    });

    const subActions = this._el("div", { className: "hud-sub-actions" }, drawBtn, wasteBtn, undoBtn);
    const actionPanel = this._el("div", { className: "hud-action-panel move-bar" }, crapetteBtn, subActions);

    // 5. Toast container
    const toastContainer = this._el("div", { className: "hud-toast-container", id: "toast-container" });

    // 6. Modals
    const rulesModal = this._createRulesModal();
    const newGameModal = this._createNewGameModal();
    const settingsModal = this._createSettingsModal();
    const hintModal = this._createHintModal();
    const tutorialModal = this._createTutorialModal();

    root.append(
      header,
      bannerBox,
      badgesContainer,
      countersOverlay,
      actionPanel,
      toastContainer,
      rulesModal,
      newGameModal,
      settingsModal,
      hintModal,
      tutorialModal
    );
    this.container.append(root);
  }

  // -------------------------------------------------------------
  // New Game Menu (settings that define a new match)
  // -------------------------------------------------------------
  _createNewGameModal() {
    const modal = this._el("div", { className: "hud-modal-backdrop", id: "new-game-modal" });
    modal.style.display = "none";

    const card = this._el("div", { className: "hud-modal-card settings-card" });

    const closeBtn = this._el("button", { className: "modal-close-btn", text: "✕" });
    closeBtn.addEventListener("click", () => this.toggleNewGameModal(false));

    const title = this._el("h2", { text: "New Match Setup" });
    const sub = this._el("p", { className: "modal-sub", text: "Configure match rules, opponent skill, and tutorials before dealing." });

    // 1. Mode select
    const modeLabel = this._el("label", { className: "setting-label", text: "Game Mode:" });
    const modeSelect = this._el("select", { className: "hud-select", id: "new-game-mode" });
    const optPlay = this._el("option", { text: "Play vs Computer" });
    optPlay.value = "human_vs_ai";
    const optWatch = this._el("option", { text: "Watch Computer vs Computer" });
    optWatch.value = "ai_vs_ai";
    modeSelect.append(optPlay, optWatch);
    const modeRow = this._el("div", { className: "setting-row" }, modeLabel, modeSelect);

    // 2. Rules variant
    const ruleLabel = this._el("label", { className: "setting-label", text: "Rule Ruleset:" });
    const ruleSelect = this._el("select", { className: "hud-select", id: "new-game-rules" });
    const optComp = this._el("option", { text: "Strict Russian Bank (Compulsory foundations & Crapette! calls)" });
    optComp.value = "competitive";
    const optCas = this._el("option", { text: "Casual / Solitaire (Relaxed play, no penalty forfeits)" });
    optCas.value = "casual";
    ruleSelect.append(optComp, optCas);
    const ruleRow = this._el("div", { className: "setting-row" }, ruleLabel, ruleSelect);

    // 3. AI Skill Slider (1.0 to 4.0 in steps of 0.5)
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

    // 4. Tutorial toggle
    const tutCheck = this._el("input", { id: "new-game-tutorial" });
    tutCheck.type = "checkbox";
    tutCheck.checked = true;
    const tutLabel = this._el("label", { text: "Show progressive tutorial popups before new features appear" });
    const tutRow = this._el("div", { className: "setting-checkbox-row" }, tutCheck, tutLabel);

    // 5. Strategic hints toggle
    const hintsCheck = this._el("input", { id: "new-game-hints" });
    hintsCheck.type = "checkbox";
    hintsCheck.checked = true;
    const hintsLabel = this._el("label", { text: "Enable Vygotsky ZPD strategic hints during play" });
    const hintsRow = this._el("div", { className: "setting-checkbox-row" }, hintsCheck, hintsLabel);

    // 6. Custom deal seed
    const seedLabel = this._el("label", { className: "setting-label", text: "Deal Seed (optional):" });
    const seedInput = this._el("input", { className: "hud-input", id: "new-game-seed" });
    seedInput.type = "text";
    seedInput.placeholder = "Leave empty for random shuffle";
    const seedRow = this._el("div", { className: "setting-row" }, seedLabel, seedInput);

    // Action button
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

  // -------------------------------------------------------------
  // In-Game Settings Menu (things changed on the fly)
  // -------------------------------------------------------------
  _createSettingsModal() {
    const modal = this._el("div", { className: "hud-modal-backdrop", id: "settings-modal" });
    modal.style.display = "none";

    const card = this._el("div", { className: "hud-modal-card settings-card" });

    const closeBtn = this._el("button", { className: "modal-close-btn", text: "✕" });
    closeBtn.addEventListener("click", () => this.toggleSettingsModal(false));

    const title = this._el("h2", { text: "Game Settings (On the Fly)" });

    // Sound toggle & volume
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

    // Visual drop highlights
    const hlCheck = this._el("input", { id: "settings-highlights" });
    hlCheck.type = "checkbox";
    hlCheck.checked = true;
    const hlLabel = this._el("label", { text: "Highlight legal target slots on card selection" });
    const hlRow = this._el("div", { className: "setting-checkbox-row" }, hlCheck, hlLabel);

    // Table Felt selector
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

    // Card face design
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

    // Reset Tutorial Progress button
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

  // -------------------------------------------------------------
  // ZPD Pedagogical Hint Modal / Card
  // -------------------------------------------------------------
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

  // -------------------------------------------------------------
  // Progressive Tutorial Modal
  // -------------------------------------------------------------
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

  // -------------------------------------------------------------
  // Rules modal
  // -------------------------------------------------------------
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

    // 1. Ledger & scores
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

    // 2. Pile counts
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

    // 3. Cassino-style Card Badges (.badge)
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

    // 4. Active player strip highlight
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

    // 5. Action button states
    const drawBtn = this.container.querySelector("#draw-btn");
    const wasteBtn = this.container.querySelector("#waste-btn");
    const undoBtn = this.container.querySelector("#undo-btn");
    const crapetteBtn = this.container.querySelector("#crapette-btn");

    const isAiVsAi = this.gameMode === "ai_vs_ai";
    const isHumanTurn = !isAiVsAi && state.activePlayer === 0;

    if (drawBtn) {
      drawBtn.disabled = !isHumanTurn || Boolean(state.drawnCard);
    }
    if (wasteBtn) {
      wasteBtn.disabled = !isHumanTurn || !Boolean(state.drawnCard);
    }
    if (undoBtn) {
      undoBtn.disabled = !isHumanTurn || !Boolean(state.undoable);
    }

    // 6. Crapette button glowing state
    if (crapetteBtn) {
      if (!isAiVsAi && state.crapetteEligible) {
        crapetteBtn.classList.add("eligible");
      } else {
        crapetteBtn.classList.remove("eligible");
      }
      crapetteBtn.disabled = isAiVsAi;
    }

    // 7. Turn status banner
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
    }
  }
}
