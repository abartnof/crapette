// Tests for Crapette progressive tutorial engine.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TUTORIAL_PAGES,
  PAGE_KEYS,
  pageDue,
  getTutorialSettings,
  saveTutorialSettings,
  getTutorialPage,
  markPageSeen,
  resetTutorialSettings,
  moveKinds,
} from "../web3d/src/tutorial.js";
import { CrapetteGame } from "../src/engine/game.js";

test("TUTORIAL_PAGES: contains all 7 canonical tutorial pages with expected structure", () => {
  assert.equal(TUTORIAL_PAGES.length, 7);
  const expectedKeys = [
    "intro",
    "foundations",
    "tableau",
    "reserve",
    "dumping",
    "crapette",
    "stock_waste",
  ];
  assert.deepEqual(PAGE_KEYS, expectedKeys);
  assert.deepEqual(TUTORIAL_PAGES.map((p) => p.key), expectedKeys);

  for (const page of TUTORIAL_PAGES) {
    assert.ok(typeof page.key === "string" && page.key.length > 0, `key for ${page.key}`);
    assert.ok(typeof page.title === "string" && page.title.length > 0, `title for ${page.key}`);
    assert.ok(typeof page.summary === "string" && page.summary.length > 0, `summary for ${page.key}`);
    assert.ok(Array.isArray(page.bullets) && page.bullets.length >= 2, `bullets for ${page.key}`);
    for (const bullet of page.bullets) {
      assert.ok(typeof bullet === "string" && bullet.length > 0, `bullet in ${page.key}`);
    }
  }
});

test("TUTORIAL_PAGES: pedagogical content verification for each concept", () => {
  const intro = getTutorialPage("intro");
  assert.match(intro.summary + intro.bullets.join(" "), /Reserve/i);
  assert.match(intro.summary + intro.bullets.join(" "), /Foundation/i);
  assert.match(intro.summary + intro.bullets.join(" "), /Tableau/i);
  assert.match(intro.summary + intro.bullets.join(" "), /13/);

  const foundations = getTutorialPage("foundations");
  assert.match(foundations.summary + foundations.bullets.join(" "), /Ace/i);
  assert.match(foundations.summary + foundations.bullets.join(" "), /King/i);
  assert.match(foundations.summary + foundations.bullets.join(" "), /compulsory/i);

  const tableau = getTutorialPage("tableau");
  assert.match(tableau.summary + tableau.bullets.join(" "), /alternating/i);
  assert.match(tableau.summary + tableau.bullets.join(" "), /color/i);
  assert.match(tableau.summary + tableau.bullets.join(" "), /empty/i);

  const reserve = getTutorialPage("reserve");
  assert.match(reserve.summary + reserve.bullets.join(" "), /13/);
  assert.match(reserve.summary + reserve.bullets.join(" "), /bottleneck/i);

  const dumping = getTutorialPage("dumping");
  assert.match(dumping.summary + dumping.bullets.join(" "), /opponent/i);
  assert.match(dumping.summary + dumping.bullets.join(" "), /±1|same suit/i);

  const crapette = getTutorialPage("crapette");
  assert.match(crapette.summary + crapette.bullets.join(" "), /CRAPETTE/i);
  assert.match(crapette.summary + crapette.bullets.join(" "), /compulsory/i);
  assert.match(crapette.summary + crapette.bullets.join(" "), /turn/i);

  const stockWaste = getTutorialPage("stock_waste");
  assert.match(stockWaste.summary + stockWaste.bullets.join(" "), /stock/i);
  assert.match(stockWaste.summary + stockWaste.bullets.join(" "), /waste/i);
  assert.match(stockWaste.summary + stockWaste.bullets.join(" "), /flip|end/i);
});

test("getTutorialSettings and saveTutorialSettings: store management", () => {
  // Mock store
  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => {
      store[k] = String(v);
    },
    removeItem: (k) => {
      delete store[k];
    },
  };

  // Default settings on empty store
  const defaults = getTutorialSettings(mockStorage);
  assert.equal(defaults.enabled, true);
  assert.deepEqual(defaults.seen, []);

  // Save settings
  saveTutorialSettings(mockStorage, { enabled: false, seen: ["intro", "foundations"] });
  const loaded = getTutorialSettings(mockStorage);
  assert.equal(loaded.enabled, false);
  assert.deepEqual(loaded.seen, ["intro", "foundations"]);

  // markPageSeen
  markPageSeen(mockStorage, "tableau");
  const updated = getTutorialSettings(mockStorage);
  assert.deepEqual(updated.seen, ["intro", "foundations", "tableau"]);

  // markPageSeen idempotent
  markPageSeen(mockStorage, "tableau");
  assert.deepEqual(getTutorialSettings(mockStorage).seen, ["intro", "foundations", "tableau"]);

  // resetTutorialSettings
  resetTutorialSettings(mockStorage);
  assert.deepEqual(getTutorialSettings(mockStorage), { enabled: true, seen: [] });

  // Corrupted store handling
  store["crapette_tutorial"] = "INVALID JSON {";
  const fallback = getTutorialSettings(mockStorage);
  assert.equal(fallback.enabled, true);
  assert.deepEqual(fallback.seen, []);

  // Null store fallback
  assert.deepEqual(getTutorialSettings(null), { enabled: true, seen: [] });
  assert.equal(saveTutorialSettings(null, { enabled: true, seen: [] }), false);
});

test("pageDue: initial state yields intro first", () => {
  const game = new CrapetteGame({ seed: 42n });
  assert.equal(pageDue(game, []), "intro");
  assert.equal(pageDue(game.state(), []), "intro");
  assert.equal(pageDue({}, []), "intro");
});

test("pageDue: never returns already seen page", () => {
  const s = {
    legal: ["m r>h0"],
    compulsory: ["m r>h0"],
  };
  assert.equal(pageDue(s, []), "intro");
  assert.equal(pageDue(s, ["intro"]), "foundations");
  assert.equal(pageDue(s, ["intro", "foundations"]), "reserve");
  assert.equal(pageDue(s, ["intro", "foundations", "reserve"]), null);
});

test("pageDue: disabled via options returns null", () => {
  const game = new CrapetteGame({ seed: 42n });
  assert.equal(pageDue(game, [], { enabled: false }), null);
  assert.equal(pageDue(game, [], false), null);
});

test("pageDue: watching mode returns null", () => {
  const game = new CrapetteGame({ seed: 42n });
  // Via options
  assert.equal(pageDue(game, [], { isWatching: true }), null);
  assert.equal(pageDue(game, [], { gameMode: "ai_vs_ai" }), null);

  // Via state
  assert.equal(pageDue({ watching: true, legal: ["m r>h0"] }, []), null);
  assert.equal(pageDue({ gameMode: "ai_vs_ai", legal: ["m r>h0"] }, []), null);
});

test("pageDue: triggers foundations when foundation move is available", () => {
  const stateWithFoundation = {
    legal: ["m r>h0", "m t0>t1"],
    compulsory: ["m r>h0"],
  };
  assert.equal(pageDue(stateWithFoundation, ["intro"]), "foundations");

  // Also triggered if foundations already have cards
  const stateWithBuiltFoundation = {
    foundations: [[{ rank: 1, suit: "H" }]],
    legal: ["draw"],
  };
  assert.equal(pageDue(stateWithBuiltFoundation, ["intro"]), "foundations");
});

test("pageDue: triggers reserve when reserve card can be played", () => {
  const stateWithReserve = {
    legal: ["m r>t3"],
    compulsory: [],
    tableau: [[], [], [], []],
  };
  assert.equal(pageDue(stateWithReserve, ["intro", "foundations"]), "reserve");
});

test("pageDue: triggers tableau when tableau move is available", () => {
  const stateWithTableau = {
    legal: ["m t2>t5"],
    compulsory: [],
    tableau: Array.from({ length: 8 }, () => [{ rank: 8, suit: "C" }]),
  };
  assert.equal(pageDue(stateWithTableau, ["intro", "foundations", "reserve"]), "tableau");
});

test("pageDue: triggers dumping when opponent loading is legal", () => {
  const stateWithDumping = {
    legal: ["m t1>opp_r"],
    compulsory: [],
  };
  assert.equal(pageDue(stateWithDumping, ["intro", "foundations", "reserve", "tableau"]), "dumping");

  const stateWithWasteDumping = {
    legal: ["m drawn>opp_w"],
    compulsory: [],
  };
  assert.equal(pageDue(stateWithWasteDumping, ["intro", "foundations", "reserve", "tableau"]), "dumping");
});

test("pageDue: triggers crapette when crapetteEligible is true", () => {
  const stateBlunder = {
    crapetteEligible: true,
    legal: ["draw"],
  };
  // Crapette is urgent: once intro is seen, crapette triggers immediately upon blunder
  assert.equal(pageDue(stateBlunder, ["intro"]), "crapette");
  assert.equal(pageDue(stateBlunder, ["intro", "crapette", "stock_waste"]), null);
});

test("pageDue: triggers stock_waste when drawing or discarding to waste", () => {
  // Drawn card in hand
  const stateDrawn = {
    drawnCard: { rank: 5, suit: "D" },
    legal: ["m drawn>t1", "waste"],
  };
  assert.equal(
    pageDue(stateDrawn, ["intro", "foundations", "reserve", "tableau", "dumping"]),
    "stock_waste"
  );

  // Waste discard available
  const stateWaste = {
    legal: ["waste"],
  };
  assert.equal(
    pageDue(stateWaste, ["intro", "foundations", "reserve", "tableau", "dumping"]),
    "stock_waste"
  );

  // Only draw remaining
  const stateOnlyDraw = {
    legal: ["draw"],
  };
  assert.equal(
    pageDue(stateOnlyDraw, ["intro", "foundations", "reserve", "tableau", "dumping"]),
    "stock_waste"
  );
});

test("moveKinds: identifies move types from legal move commands", () => {
  const kinds1 = moveKinds({
    legal: ["m r>h0", "m t1>t2", "m t3>opp_r", "draw"],
    crapetteEligible: false,
  });
  assert.ok(kinds1.has("foundation"));
  assert.ok(kinds1.has("tableau"));
  assert.ok(kinds1.has("reserve"));
  assert.ok(kinds1.has("dumping"));
  assert.ok(kinds1.has("stock"));
  assert.ok(!kinds1.has("waste"));
  assert.ok(!kinds1.has("crapette"));

  const kinds2 = moveKinds({
    legal: ["waste"],
    crapetteEligible: true,
  });
  assert.ok(kinds2.has("waste"));
  assert.ok(kinds2.has("crapette"));
});

test("pageDue: full deal progressive sequence with CrapetteGame", () => {
  const game = new CrapetteGame({ seed: 100n });
  const seen = [];

  // Step 1: intro is due
  assert.equal(pageDue(game, seen), "intro");
  seen.push("intro");

  // Step 2: Next due page depends on board state (compulsory moves or legal moves)
  const due = pageDue(game, seen);
  assert.ok(due === "foundations" || due === "reserve" || due === "tableau" || due === null);

  // Mark all pages seen: nothing more due
  const allSeen = [...PAGE_KEYS];
  assert.equal(pageDue(game, allSeen), null);
});

test("pageDue: supports seen as a Set", () => {
  const seenSet = new Set(["intro", "foundations"]);
  const s = {
    legal: ["m t0>t1"],
  };
  assert.equal(pageDue(s, seenSet), "tableau");
});

test("pageDue: events can trigger pages progressively", () => {
  // Opponent made a blunder recorded in events
  const stateBlunderEvent = {
    events: [{ kind: "blunder", player: 1 }],
  };
  assert.equal(pageDue(stateBlunderEvent, ["intro"]), "crapette");

  // Opponent made a loading move in events
  const stateLoadEvent = {
    events: [{ kind: "load", dst: "opp_r", player: 1 }],
  };
  assert.equal(pageDue(stateLoadEvent, ["intro", "foundations", "reserve", "tableau"]), "dumping");

  // Stock draw event
  const stateDrawEvent = {
    events: [{ kind: "draw", player: 0 }],
  };
  assert.equal(pageDue(stateDrawEvent, ["intro", "foundations", "reserve", "tableau", "dumping"]), "stock_waste");
});

test("pageDue: exposed Ace on tableau triggers foundations", () => {
  const stateAceTableau = {
    tableau: [[{ rank: 1, suit: "S" }]],
    legal: ["draw"],
  };
  assert.equal(pageDue(stateAceTableau, ["intro"]), "foundations");
});

test("pageDue: empty tableau space with cards in reserve triggers reserve", () => {
  const stateEmptySpace = {
    tableau: [[], [{ rank: 8, suit: "C" }]],
    players: [
      { id: 0, reserveCount: 10, reserve: [{ rank: 4, suit: "H" }] },
      { id: 1, reserveCount: 10, reserve: [] },
    ],
    legal: [],
  };
  assert.equal(pageDue(stateEmptySpace, ["intro", "foundations"]), "reserve");
});

test("getTutorialPage: returns null for invalid key", () => {
  assert.equal(getTutorialPage("non_existent_page"), null);
  assert.equal(getTutorialPage(""), null);
  assert.equal(getTutorialPage(null), null);
});

test("saveTutorialSettings and getTutorialSettings: plain object store", () => {
  const plainObj = {};
  assert.ok(saveTutorialSettings(plainObj, { enabled: false, seen: ["intro"] }));
  const loaded = getTutorialSettings(plainObj);
  assert.equal(loaded.enabled, false);
  assert.deepEqual(loaded.seen, ["intro"]);
});

