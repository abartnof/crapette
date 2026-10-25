// HUD interface and control panel for Crapette (Russian Bank)

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
    onVolumeChange,
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
    this.onVolumeChange = onVolumeChange;

    this.isMuted = false;
    this.currentSkill = "master"; // "master" | "novice"

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

    // Outer HUD wrapper
    const root = this._el("div", { className: "hud-root" });

    // 1. Top Header: Tournament match ledger & navigation
    const header = this._el("header", { className: "hud-header" });

    const title = this._el("h1", { className: "hud-title", text: "CRAPETTE" });
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

    // Quick toolbar in header
    const muteBtn = this._el("button", { className: "hud-tool-btn", id: "mute-btn", text: "🔊 Sound" });
    muteBtn.addEventListener("click", () => {
      if (this.onToggleSound) this.onToggleSound();
    });

    const skillBtn = this._el("button", { className: "hud-tool-btn", id: "skill-btn", text: "AI: Master" });
    skillBtn.addEventListener("click", () => {
      if (this.onToggleSkill) this.onToggleSkill();
    });

    const rulesBtn = this._el("button", { className: "hud-tool-btn", id: "rules-btn", text: "Rules & Help" });
    rulesBtn.addEventListener("click", () => this.toggleRulesModal(true));

    const newDealBtn = this._el("button", { className: "hud-tool-btn primary", id: "new-deal-btn", text: "New Deal" });
    newDealBtn.addEventListener("click", () => {
      if (this.onNewGame) this.onNewGame();
    });

    const toolBar = this._el("div", { className: "hud-toolbar" }, muteBtn, skillBtn, rulesBtn, newDealBtn);
    header.append(titleBox, ledgerBox, toolBar);

    // 2. Turn Status Banner
    const banner = this._el("div", { className: "hud-banner", id: "status-banner", text: "Your Turn — Make moves or Draw Stock" });
    const bannerBox = this._el("div", { className: "hud-banner-box" }, banner);

    // 3. Player Card Pile Counters (Sidebar / Overlay strips)
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

    // 4. Bottom Action Panel: prominent "CALL CRAPETTE!" button + action buttons
    const crapetteGlow = this._el("span", { className: "btn-glow" });
    const crapetteText = this._el("span", { className: "btn-text", text: "CALL CRAPETTE!" });
    const crapetteSub = this._el("span", { className: "btn-subtext", text: "Claim Blunder & Seize Turn" });
    const crapetteBtn = this._el("button", { className: "crapette-btn", id: "crapette-btn" }, crapetteGlow, crapetteText, crapetteSub);
    crapetteBtn.addEventListener("click", () => {
      if (this.onCrapette) this.onCrapette();
    });

    // Secondary action buttons
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
    const actionPanel = this._el("div", { className: "hud-action-panel" }, crapetteBtn, subActions);

    // 5. Toast container
    const toastContainer = this._el("div", { className: "hud-toast-container", id: "toast-container" });

    // 6. Rules modal
    const rulesModal = this._createRulesModal();

    root.append(header, bannerBox, countersOverlay, actionPanel, toastContainer, rulesModal);
    this.container.append(root);
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
        <li><strong>Reserve (Depot):</strong> 13 cards on your right; top card face up.</li>
        <li><strong>Foundations:</strong> 8 center piles built upward by suit (A to K). Communal!</li>
        <li><strong>Tableau (Houses):</strong> 8 slots built downward in strictly alternating colors (e.g. Red 9 on Black 10).</li>
        <li><strong>Opponent Loading:</strong> Load cards onto opponent's exposed Reserve or Waste card in the exact same suit and adjacent rank (±1).</li>
      </ul>
      <hr>
      <h3>Compulsory Moves & "CALL CRAPETTE!"</h3>
      <p>Under competitive rules, foundation moves are compulsory! If you draw from stock while an available card could build on a foundation, or if you violate reserve priority, your opponent may call <strong>"CALL CRAPETTE!"</strong> to penalize you and seize the turn!</p>
      <hr>
      <h3>Controls</h3>
      <ul>
        <li><strong>Click</strong> a card to highlight legal target slots.</li>
        <li><strong>Click</strong> a highlighted slot to move.</li>
        <li><strong>Double-click</strong> a card to auto-play it to foundation.</li>
        <li><strong>Drag & Drop</strong> cards onto valid destinations.</li>
      </ul>
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
    this.currentSkill = skill;
    const btn = this.container.querySelector("#skill-btn");
    if (btn) {
      btn.textContent = `AI: ${skill === "novice" ? "Novice" : "Master"}`;
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

    // 3. Active player strip highlight
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

    // 4. Action button states
    const drawBtn = this.container.querySelector("#draw-btn");
    const wasteBtn = this.container.querySelector("#waste-btn");
    const undoBtn = this.container.querySelector("#undo-btn");
    const crapetteBtn = this.container.querySelector("#crapette-btn");

    const isHumanTurn = state.activePlayer === 0;

    if (drawBtn) {
      drawBtn.disabled = !isHumanTurn || Boolean(state.drawnCard);
    }
    if (wasteBtn) {
      wasteBtn.disabled = !isHumanTurn || !Boolean(state.drawnCard);
    }
    if (undoBtn) {
      undoBtn.disabled = !isHumanTurn || !Boolean(state.undoable);
    }

    // 5. Crapette button glowing state
    if (crapetteBtn) {
      if (state.crapetteEligible) {
        crapetteBtn.classList.add("eligible");
      } else {
        crapetteBtn.classList.remove("eligible");
      }
    }

    // 6. Turn status banner
    const banner = this.container.querySelector("#status-banner");
    if (banner) {
      if (state.winner !== null) {
        const winnerName = state.winner === 0 ? "You Win!" : "Opponent Wins!";
        banner.textContent = `Deal Over! ${winnerName}`;
        banner.className = "hud-banner victory";
      } else if (state.crapetteEligible) {
        banner.textContent = "BLUNDER DETECTED! CALL CRAPETTE!";
        banner.className = "hud-banner blunder";
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
