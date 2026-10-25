// The 2D overlay layer for Crapette: Cassino-style scorebug slot, aids/trackers panel,
// celebration popups with M3 springs, prominent CALL CRAPETTE! alert, and move chips.

export const SUITS = ["S", "H", "D", "C"];
export const SUIT_NAMES = { S: "Spades", H: "Hearts", D: "Diamonds", C: "Clubs" };
export const SUIT_GLYPHS = { S: "♠", H: "♥", D: "♦", C: "♣" };

export function foundationSuitCounts(foundations = []) {
  const counts = { S: 0, H: 0, D: 0, C: 0 };
  for (const pile of foundations || []) {
    if (pile && pile.length > 0) {
      const top = pile[pile.length - 1];
      if (top && top.suit && counts[top.suit] !== undefined) {
        counts[top.suit] = Math.max(counts[top.suit], top.rank || 0);
      }
    }
  }
  return counts;
}

export function trackers(state) {
  const p0 = state?.players?.[0] || { reserveCount: 13, stockCount: 35, wasteCount: 0 };
  const p1 = state?.players?.[1] || { reserveCount: 13, stockCount: 35, wasteCount: 0 };

  let tableauTotal = 0;
  let youTableau = 0;
  let themTableau = 0;
  if (state?.tableau) {
    state.tableau.forEach((col, idx) => {
      const len = col ? col.length : 0;
      tableauTotal += len;
      if (idx < 4) youTableau += len;
      else themTableau += len;
    });
  }

  const fCounts = foundationSuitCounts(state?.foundations);

  return {
    you: {
      reserve: p0.reserveCount ?? (p0.reserve ? p0.reserve.length : 13),
      stock: p0.stockCount ?? (p0.stock ? p0.stock.length : 35),
      waste: p0.wasteCount ?? (p0.waste ? p0.waste.length : 0),
      tableau: youTableau || tableauTotal,
    },
    them: {
      reserve: p1.reserveCount ?? (p1.reserve ? p1.reserve.length : 13),
      stock: p1.stockCount ?? (p1.stock ? p1.stock.length : 35),
      waste: p1.wasteCount ?? (p1.waste ? p1.waste.length : 0),
      tableau: themTableau || tableauTotal,
    },
    foundations: fCounts,
    tableauTotal,
  };
}

export const COLUMNS = [
  { key: "reserve", head: "Reserve", tip: "Cards remaining in reserve depot (13 down to 0). Emptier is better!" },
  { key: "tableau", head: "Tableau", tip: "Cards currently building descending sequences on the 8 columns." },
  { key: "waste", head: "Waste", tip: "Cards in discard waste pile." },
  { key: "stock", head: "Stock", tip: "Cards remaining in stock draw pile." },
  { key: "spades", head: "♠", tip: "Spades foundation progress (0 to 13, Ace to King)." },
  { key: "hearts", head: "♥", tip: "Hearts foundation progress (0 to 13, Ace to King)." },
  { key: "diamonds", head: "♦", tip: "Diamonds foundation progress (0 to 13, Ace to King)." },
  { key: "clubs", head: "♣", tip: "Clubs foundation progress (0 to 13, Ace to King)." },
];

export function trackerTable(t, { watching = false } = {}) {
  const seats = watching
    ? { you: { name: "Player 1", who: "Player 1" }, them: { name: "Player 2", who: "Player 2" } }
    : { you: { name: "You", who: "You" }, them: { name: "Opponent", who: "Opponent" } };

  const columns = [...COLUMNS];

  const rows = ["them", "you"].map((who) => {
    const p = t[who] || {};
    const info = seats[who];
    const cells = [
      {
        key: "reserve",
        text: String(p.reserve ?? 0),
        look: p.reserve === 0 ? "won" : "",
        tip: `${info.who} has ${p.reserve ?? 0} cards remaining in reserve.`,
      },
      {
        key: "tableau",
        text: String(p.tableau ?? 0),
        look: "",
        tip: `${info.who} tableau cards: ${p.tableau ?? 0}.`,
      },
      {
        key: "waste",
        text: String(p.waste ?? 0),
        look: "",
        tip: `${info.who} waste pile: ${p.waste ?? 0} cards.`,
      },
      {
        key: "stock",
        text: String(p.stock ?? 0),
        look: "",
        tip: `${info.who} stock pile: ${p.stock ?? 0} cards.`,
      },
      {
        key: "spades",
        text: String(t.foundations?.S ?? 0),
        look: t.foundations?.S === 13 ? "won" : "",
        tip: `Spades foundation rank: ${t.foundations?.S ?? 0} of 13.`,
      },
      {
        key: "hearts",
        text: String(t.foundations?.H ?? 0),
        look: t.foundations?.H === 13 ? "won" : "",
        tip: `Hearts foundation rank: ${t.foundations?.H ?? 0} of 13.`,
      },
      {
        key: "diamonds",
        text: String(t.foundations?.D ?? 0),
        look: t.foundations?.D === 13 ? "won" : "",
        tip: `Diamonds foundation rank: ${t.foundations?.D ?? 0} of 13.`,
      },
      {
        key: "clubs",
        text: String(t.foundations?.C ?? 0),
        look: t.foundations?.C === 13 ? "won" : "",
        tip: `Clubs foundation rank: ${t.foundations?.C ?? 0} of 13.`,
      },
    ];
    return { who, name: info.name, cells };
  });

  return { columns, rows };
}

export const BURSTS = [
  { angle: -160, reach: 104, rot: -16 },
  { angle: -115, reach: 122, rot: -6 },
  { angle: -65, reach: 120, rot: 6 },
  { angle: -20, reach: 102, rot: 16 },
];

export function celebrate({
  container,
  label = "Foundation!",
  pts = "+1",
  rank = null,
  suit = null,
  x = 0,
  y = 0,
  duration = 1900,
  later = (ms, fn) => setTimeout(fn, ms),
  document = globalThis.document,
} = {}) {
  if (!container || !document) return null;
  const node = document.createElement("div");
  node.className = "cheer";
  if (x || y) {
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
  }

  const disc = document.createElement("div");
  disc.className = "cheer-disc";
  disc.textContent = label;
  node.append(disc);

  BURSTS.forEach(({ angle, reach, rot }, k) => {
    const burst = document.createElement("span");
    burst.className = "cheer-burst";
    burst.textContent = pts;
    const rad = (angle * Math.PI) / 180;
    const dx = Math.round(Math.cos(rad) * reach);
    const dy = Math.round(Math.sin(rad) * reach);
    if (burst.style && typeof burst.style.setProperty === "function") {
      burst.style.setProperty("--dx", `${dx}px`);
      burst.style.setProperty("--dy", `${dy}px`);
      burst.style.setProperty("--rot", `${rot}deg`);
      burst.style.setProperty("--k", String(k));
    }
    node.append(burst);
  });

  container.append(node);
  if (duration > 0) {
    later(duration, () => {
      if (node.parentNode) node.parentNode.removeChild(node);
    });
  }
  return node;
}

export function celebrationOf(eventOrCard) {
  if (!eventOrCard) return null;
  const rank = eventOrCard.rank;
  const suit = eventOrCard.suit;
  const glyph = SUIT_GLYPHS[suit] || suit || "";
  let label = "Foundation!";
  let pts = "+1";

  if (rank === 1) {
    label = `Ace of ${SUIT_NAMES[suit] || suit} (A${glyph})`;
    pts = `A${glyph}`;
  } else if (rank === 13) {
    label = `King Completed (K${glyph})!`;
    pts = `K${glyph}`;
  } else if (rank) {
    const rankGlyph = rank === 11 ? "J" : rank === 12 ? "Q" : String(rank);
    label = `${SUIT_NAMES[suit] || suit} ${rankGlyph}${glyph}`;
    pts = `${rankGlyph}${glyph}`;
  }

  return { label, pts, rank, suit };
}

export function createOverlay(root, {
  onDraw,
  onWaste,
  onCrapette,
  onUndo,
  onFold = () => {},
  later = (ms, fn) => setTimeout(fn, ms),
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

  // 1. Info / HUD slot in top-left
  const hudSlot = el("div", { className: "hud-slot" });
  const info = el("div", { className: "info" }, hudSlot);

  // 2. Celebration popups container
  const cheers = el("div", { className: "cheers", "aria-hidden": "true" });

  // 3. Card pile badges container (.badges)
  const badges = el("div", { className: "badges" });

  // 4. Collapsible aids/tracker panel at bottom-left
  const titleSpan = el("span", { className: "aids-title" }, "Cards & Foundations Tracker");
  const foldIcon = el("span", { className: "aids-fold", "aria-hidden": "true" });
  foldIcon.innerHTML = `<svg class="chevron-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"></path></svg>`;

  const headBtn = el("button", {
    type: "button",
    className: "aids-head",
    "aria-controls": "aids-body",
    "aria-expanded": "true",
  }, titleSpan, foldIcon);

  const table = el("table", { className: "tracker-table" });
  const thead = el("thead");
  const theadRow = el("tr");
  thead.append(theadRow);
  const tbody = el("tbody");
  table.append(thead, tbody);

  const aidsBody = el("div", { className: "aids-body", id: "aids-body" }, table);
  const aidsHeading = el("h2", { className: "aids-heading" }, headBtn);
  const aidsPanel = el("section", {
    className: "aids-panel",
    "aria-label": "Game tracker and foundation progress",
  }, aidsHeading, aidsBody);

  let isFolded = false;
  headBtn.addEventListener("click", () => {
    isFolded = !isFolded;
    aidsPanel.classList.toggle("folded", isFolded);
    aidsBody.hidden = isFolded;
    headBtn.setAttribute("aria-expanded", String(!isFolded));
    onFold(isFolded);
  });

  // 5. Prominent "CALL CRAPETTE!" button with pulsing alert
  const crapetteGlow = el("span", { className: "btn-glow" });
  const crapetteText = el("span", { className: "btn-text" }, "CALL CRAPETTE!");
  const crapetteSub = el("span", { className: "btn-subtext" }, "Claim Blunder & Seize Turn");
  const crapetteBtn = el("button", {
    type: "button",
    className: "crapette-btn",
    id: "crapette-btn",
    "aria-label": "Call Crapette! Claim opponent blunder and seize the turn",
  }, crapetteGlow, crapetteText, crapetteSub);

  if (onCrapette) {
    crapetteBtn.addEventListener("click", () => onCrapette());
  }

  // 6. Action selection chips at bottom-center (.move-bar)
  const drawChip = el("button", { type: "button", className: "chip draw-chip", id: "draw-btn" }, "Draw Stock");
  if (onDraw) drawChip.addEventListener("click", () => onDraw());

  const wasteChip = el("button", { type: "button", className: "chip waste-chip", id: "waste-btn" }, "Discard to Waste");
  wasteChip.disabled = true;
  if (onWaste) wasteChip.addEventListener("click", () => onWaste());

  const undoChip = el("button", { type: "button", className: "chip undo-chip", id: "undo-btn" }, "Undo");
  undoChip.disabled = true;
  if (onUndo) undoChip.addEventListener("click", () => onUndo());

  const placeActions = el("div", { className: "place actions-place" }, drawChip, wasteChip, undoChip);
  const placeCrapette = el("div", { className: "place crapette-place" }, crapetteBtn);
  const chipsGroup = el("div", { className: "chips", role: "group", "aria-label": "Player actions" }, placeCrapette, placeActions);
  const moveBar = el("div", { className: "move-bar" }, chipsGroup);

  const controls = el("section", { className: "controls" }, moveBar);

  root.append(badges, cheers, info, aidsPanel, controls);

  function renderTrackers(trackersData, watching = false) {
    const { columns, rows } = trackerTable(trackersData, { watching });
    theadRow.replaceChildren(
      el("th", {}),
      ...columns.map((c) => el("th", { scope: "col", className: c.key, "data-tip": c.tip }, c.head))
    );

    tbody.replaceChildren(
      ...rows.map((r) =>
        el(
          "tr",
          { className: r.who },
          el("th", { scope: "row" }, r.name),
          ...r.cells.map((c) => el("td", { className: [c.key, c.look].filter(Boolean).join(" "), "data-tip": c.tip }, c.text))
        )
      )
    );
  }

  return {
    info,
    hudSlot,
    cheers,
    badges,
    aidsPanel,
    crapetteBtn,
    drawChip,
    wasteChip,
    undoChip,
    moveBar,
    renderTrackers,
    celebrate: (opts) => celebrate({ container: cheers, document, later, ...opts }),
    celebrateFoundation: (card, x, y) => {
      const info = celebrationOf(card);
      if (info) {
        return celebrate({ container: cheers, document, later, ...info, x, y });
      }
      return null;
    },
    setAidsOpen(open) {
      isFolded = !open;
      aidsPanel.classList.toggle("folded", isFolded);
      aidsBody.hidden = isFolded;
      headBtn.setAttribute("aria-expanded", String(open));
    },
    isAidsOpen: () => !isFolded,
  };
}
