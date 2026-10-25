// Progressive tutorial engine for Crapette (Russian Bank) 3D.
// Inspired by Cassino's tutorial architecture: concise, clear, and pedagogical.

export const TUTORIAL_PAGES = [
  {
    key: "intro",
    title: "Goal & Layout",
    summary: "Empty your Reserve depot and deck before your opponent to win the match.",
    bullets: [
      "Each player has a 13-card Reserve depot on their right, plus a Stock and Waste pile.",
      "The shared center features 8 Foundations (built upward A → K) and 8 Tableau columns.",
      "Goal: be the first player to shed all cards from your Reserve and Deck!",
    ],
  },
  {
    key: "foundations",
    title: "Communal Foundations",
    summary: "Build the 8 shared center foundations upward from Ace to King by suit.",
    bullets: [
      "Any exposed Ace starts a new foundation in the center 8 slots.",
      "Build upward in ascending rank within the same suit (Ace, 2, 3 ... King).",
      "Playing to foundations is compulsory — you MUST play eligible cards to foundations before making any other moves!",
    ],
  },
  {
    key: "tableau",
    title: "Tableau Cascades",
    summary: "Build downward in strictly alternating colors across the 8 shared columns.",
    bullets: [
      "Build downward in strictly alternating colors (e.g. Red 9 on Black 10, or Black Queen on Red King).",
      "Empty columns can take any available card (Reserve cards have priority!).",
      "Both players share and build on the same 8 tableau houses, moving one card at a time.",
    ],
  },
  {
    key: "reserve",
    title: "Reserve Depot",
    summary: "The 13 cards on your right are your primary bottleneck; clearing them is essential to winning.",
    bullets: [
      "Your Reserve depot begins with 13 cards with only the top card face-up and playable.",
      "Clearing your Reserve is the key to unlocking victory and opening up plays from your deck.",
      "Prioritize moving reserve cards into foundations or into empty tableau spaces to expose new cards.",
    ],
  },
  {
    key: "dumping",
    title: "Opponent Loading",
    summary: "Load cards onto your opponent's exposed Reserve or Waste to stall their progress.",
    bullets: [
      "Available cards can be loaded directly onto your opponent's exposed Reserve or Waste pile.",
      "The card must match the same suit and be ±1 rank (e.g. 7♠ on 6♠ or 8♠). No rank wrapping (King cannot go on Ace).",
      "Loading burdens your opponent with additional cards while shedding cards from your own board or hand.",
    ],
  },
  {
    key: "crapette",
    title: "Calling \"CRAPETTE!\"",
    summary: "Seize your opponent's turn immediately if they overlook a compulsory move or commit a blunder.",
    bullets: [
      "If your opponent fails to play an eligible card to a foundation, call \"CRAPETTE!\".",
      "If your opponent draws from stock while an empty tableau column could be filled from their Reserve, call \"CRAPETTE!\".",
      "Calling Crapette immediately halts their turn and passes the initiative directly to you!",
    ],
  },
  {
    key: "stock_waste",
    title: "Stock & Waste",
    summary: "Draw from stock to keep your turn alive, and discard unplayable cards to waste to end your turn.",
    bullets: [
      "When no moves remain on the board, draw a card from your stock pile.",
      "Playable drawn cards keep your turn alive; you may continue playing and drawing.",
      "Unplayable cards discarded to your waste pile immediately end your turn.",
      "When your stock is exhausted, your waste pile flips over to form a fresh stock without reshuffling.",
    ],
  },
];

export const PAGE_KEYS = TUTORIAL_PAGES.map((p) => p.key);

// Order in which pages fall due when multiple conditions might match.
// Intro is always first; Crapette is urgent when a blunder occurs;
// Foundations is the primary compulsory rule.
export const DUE_ORDER = [
  "intro",
  "crapette",
  "foundations",
  "reserve",
  "tableau",
  "dumping",
  "stock_waste",
];

export const TUTORIAL_STORAGE_KEY = "crapette_tutorial";

function getDefaultStorage() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Retrieve tutorial preferences from persistent store.
 * @param {Storage|Object|null} [store]
 * @returns {{ enabled: boolean, seen: string[] }}
 */
export function getTutorialSettings(store) {
  const defaultSettings = { enabled: true, seen: [] };
  const target = store ?? getDefaultStorage();
  if (!target) return defaultSettings;

  try {
    let raw = null;
    if (typeof target.getItem === "function") {
      raw = target.getItem(TUTORIAL_STORAGE_KEY);
    } else if (typeof target.get === "function") {
      raw = target.get(TUTORIAL_STORAGE_KEY);
    } else if (target[TUTORIAL_STORAGE_KEY] !== undefined) {
      raw = target[TUTORIAL_STORAGE_KEY];
    }

    if (!raw) return defaultSettings;
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return {
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : true,
      seen: Array.isArray(parsed.seen) ? parsed.seen.filter((x) => typeof x === "string") : [],
    };
  } catch {
    return defaultSettings;
  }
}

/**
 * Save tutorial preferences to persistent store.
 * @param {Storage|Object|null} store
 * @param {{ enabled?: boolean, seen?: string[] }} settings
 * @returns {boolean} True if saved successfully
 */
export function saveTutorialSettings(store, settings = {}) {
  const target = store ?? getDefaultStorage();
  if (!target) return false;

  try {
    const payload = JSON.stringify({
      enabled: settings.enabled !== false,
      seen: Array.isArray(settings.seen) ? settings.seen.filter((x) => typeof x === "string") : [],
    });

    if (typeof target.setItem === "function") {
      target.setItem(TUTORIAL_STORAGE_KEY, payload);
    } else if (typeof target.set === "function") {
      target.set(TUTORIAL_STORAGE_KEY, payload);
    } else {
      target[TUTORIAL_STORAGE_KEY] = payload;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Mark a tutorial page as seen.
 * @param {Storage|Object|null} store
 * @param {string} pageKey
 * @returns {{ enabled: boolean, seen: string[] }}
 */
export function markPageSeen(store, pageKey) {
  const current = getTutorialSettings(store);
  if (!current.seen.includes(pageKey)) {
    current.seen.push(pageKey);
    saveTutorialSettings(store, current);
  }
  return current;
}

/**
 * Reset all seen pages and re-enable the tutorial.
 * @param {Storage|Object|null} store
 * @returns {{ enabled: boolean, seen: string[] }}
 */
export function resetTutorialSettings(store) {
  const reset = { enabled: true, seen: [] };
  saveTutorialSettings(store, reset);
  return reset;
}

/**
 * Find page definition by key.
 * @param {string} key
 * @returns {Object|null}
 */
export function getTutorialPage(key) {
  return TUTORIAL_PAGES.find((p) => p.key === key) ?? null;
}

/**
 * Normalize state from either a CrapetteGame instance or plain state object.
 */
function normalizeState(state) {
  if (!state) return {};
  if (typeof state.state === "function") {
    return state.state();
  }
  return state;
}

/**
 * Classify kinds of moves and state features present in the current position.
 * @param {Object} state
 * @returns {Set<string>} Set of feature kinds: "foundation", "tableau", "reserve", "dumping", "stock", "waste", "crapette"
 */
export function moveKinds(state) {
  const s = normalizeState(state);
  const kinds = new Set();
  const legal = s.legal ?? s.moves ?? [];

  for (const move of legal) {
    if (typeof move !== "string") continue;
    if (move.includes(">h")) kinds.add("foundation");
    if (move.includes(">t")) kinds.add("tableau");
    if (move.startsWith("m r>")) kinds.add("reserve");
    if (move.includes(">opp_r") || move.includes(">opp_w")) kinds.add("dumping");
    if (move === "draw") kinds.add("stock");
    if (move === "waste") kinds.add("waste");
  }

  if (s.crapetteEligible || s.crapetteBlunder) {
    kinds.add("crapette");
  }

  return kinds;
}

/**
 * Determine if an Ace (rank 1) is visible on top of reserve, tableau, or drawnCard.
 */
function hasExposedAce(s) {
  if (s.drawnCard && (s.drawnCard.rank === 1 || s.drawnCard.card?.[0] === "A")) return true;
  for (const p of s.players ?? []) {
    if (p.reserveTop && (p.reserveTop.rank === 1 || p.reserveTop.card?.[0] === "A")) return true;
    if (Array.isArray(p.reserve) && p.reserve.length > 0) {
      const top = p.reserve[p.reserve.length - 1];
      if (top && (top.rank === 1 || top.card?.[0] === "A")) return true;
    }
  }
  for (const col of s.tableau ?? []) {
    if (Array.isArray(col) && col.length > 0) {
      const top = col[col.length - 1];
      if (top && (top.rank === 1 || top.card?.[0] === "A")) return true;
    }
  }
  return false;
}

/**
 * Determine which tutorial page is due next according to progressive disclosure.
 *
 * @param {Object} state - Current CrapetteGame or game state object
 * @param {string[]|Set<string>} seen - List or Set of already seen page keys
 * @param {Object|boolean} [options={}] - Options or boolean enabled flag
 * @returns {string|null} Key of the tutorial page due now, or null if none
 */
export function pageDue(state, seen = [], options = {}) {
  const opts = typeof options === "boolean" ? { enabled: options } : options;
  const { enabled = true, isWatching = false } = opts;

  // Never show tutorial if disabled or in AI vs AI watching mode
  if (!enabled || isWatching) return null;
  if (opts.gameMode === "ai_vs_ai") return null;

  const s = normalizeState(state);
  if (s.watching || s.gameMode === "ai_vs_ai") return null;

  const seenSet = seen instanceof Set ? seen : new Set(Array.isArray(seen) ? seen : [seen]);

  const legal = s.legal ?? s.moves ?? [];
  const compulsory = s.compulsory ?? [];

  for (const key of DUE_ORDER) {
    if (seenSet.has(key)) continue;

    switch (key) {
      case "intro":
        return "intro";

      case "crapette": {
        const hasBlunder =
          Boolean(s.crapetteEligible) ||
          Boolean(s.crapetteBlunder) ||
          (s.events ?? []).some((e) => e.kind === "blunder" || e.crapetteEligible || e.kind === "crapette");
        if (hasBlunder) return "crapette";
        break;
      }

      case "foundations": {
        const canBuild =
          legal.some((m) => typeof m === "string" && m.includes(">h")) ||
          compulsory.some((m) => typeof m === "string" && m.includes(">h")) ||
          (s.foundations ?? []).some((f) => (Array.isArray(f) ? f.length : (f?.count ?? 0)) > 0) ||
          hasExposedAce(s) ||
          (s.events ?? []).some((e) => e.dst?.startsWith?.("h") || e.type === "foundation");
        if (canBuild) return "foundations";
        break;
      }

      case "reserve": {
        const canMoveReserve =
          legal.some((m) => typeof m === "string" && (m.startsWith("m r>") || m === "reserve")) ||
          compulsory.some((m) => typeof m === "string" && m.startsWith("m r>")) ||
          (s.events ?? []).some((e) => e.src === "r" || e.type === "reserve") ||
          ((s.tableau ?? []).some((col) => col.length === 0) &&
            (s.players ?? []).some((p) => (p.reserveCount ?? p.reserve?.length ?? 0) > 0));
        if (canMoveReserve) return "reserve";
        break;
      }

      case "tableau": {
        const canTableau =
          legal.some((m) => typeof m === "string" && m.includes(">t")) ||
          compulsory.some((m) => typeof m === "string" && m.includes(">t")) ||
          (s.tableau ?? []).some((col) => col.length > 1) ||
          (s.tableau ?? []).some((col) => col.length === 0) ||
          (s.events ?? []).some((e) => e.dst?.startsWith?.("t") || e.type === "tableau");
        if (canTableau) return "tableau";
        break;
      }

      case "dumping": {
        const canDump =
          legal.some((m) => typeof m === "string" && (m.includes(">opp_r") || m.includes(">opp_w"))) ||
          (s.events ?? []).some(
            (e) => e.dst === "opp_r" || e.dst === "opp_w" || e.kind === "load" || e.type === "dumping"
          );
        if (canDump) return "dumping";
        break;
      }

      case "stock_waste": {
        const isStockWaste =
          s.drawnCard != null ||
          legal.includes("waste") ||
          (s.players ?? []).some((p) => (p.wasteCount ?? p.waste?.length ?? 0) > 0) ||
          (s.events ?? []).some((e) => e.kind === "draw" || e.kind === "waste") ||
          (legal.includes("draw") && !legal.some((m) => typeof m === "string" && m.startsWith("m ")));
        if (isStockWaste) return "stock_waste";
        break;
      }
    }
  }

  return null;
}
