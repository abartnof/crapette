import test from "node:test";
import assert from "node:assert/strict";
import { CrapetteGame } from "../src/engine/game.js";
import { Card } from "../src/engine/cards.js";
import {
  generateHint,
  generateAllHints,
  formatCard,
  describeMove,
  getZpdRationale,
} from "../src/engine/hints.js";

test("formatCard: formats cards with rank glyphs and names cleanly", () => {
  assert.equal(formatCard(new Card(0, "S", 1)), "A♠");
  assert.equal(formatCard(new Card(0, "D", 10)), "10♦");
  assert.equal(formatCard(new Card(1, "H", 11)), "J♥");
  assert.equal(formatCard(new Card(1, "C", 12)), "Q♣");
  assert.equal(formatCard(new Card(0, "S", 13)), "K♠");
  assert.equal(formatCard(new Card(0, "H", 7)), "7♥");
  assert.equal(formatCard(null), "None");
});

test("Hints: calls Crapette when opponent committed a blunder", () => {
  const game = new CrapetteGame({ seed: 42n });
  game.crapetteBlunder = {
    type: "omitted_compulsory",
    moves: [{ src: "r", dst: "h0", priority: 1 }],
  };

  const hint = generateHint(game);
  assert.ok(hint);
  assert.equal(hint.command, "crapette");
  assert.equal(hint.action, "crapette");
  assert.equal(hint.category, "crapette");
  assert.match(hint.headline, /Call CRAPETTE/i);
  assert.match(hint.what, /Call CRAPETTE/i);
  assert.match(hint.rule, /compulsory move/i);
  assert.match(hint.tension, /forfeits their turn|penalizing/i);
  assert.match(hint.why, /omitted a compulsory move.*forfeits/i);
  assert.match(hint.text, /Call CRAPETTE/i);
});

test("Hints: compulsory Reserve to Foundation takes top priority", () => {
  const game = new CrapetteGame({ seed: 42n });
  game.activePlayer = 0;
  // Place Ace of Spades on player 0's reserve
  const aceOfSpades = new Card(0, "S", 1);
  game.players[0].reserve.push(aceOfSpades);

  const hint = generateHint(game);
  assert.ok(hint);
  assert.equal(hint.action, "m r>h0");
  assert.equal(hint.command, "m r>h0");
  assert.equal(hint.source, "r");
  assert.equal(hint.destination, "h0");
  assert.equal(hint.src, "r");
  assert.equal(hint.category, "compulsory_reserve_foundation");
  assert.equal(hint.priority, 1);
  assert.equal(hint.card.code, "AS");
  assert.match(hint.headline, /Move A♠ from.*Reserve to Foundation/i);
  assert.match(hint.rule, /Foundation piles build/i);
  assert.match(hint.tension, /Reserve cards are your bottleneck|highest priority|permanent/i);
});

test("Hints: compulsory Tableau to Foundation when Reserve cannot play", () => {
  const game = new CrapetteGame({ seed: 42n });
  game.activePlayer = 0;
  // Reserve top is 7 of Hearts (cannot go to empty foundation)
  game.players[0].reserve = [new Card(0, "H", 7)];
  // Tableau 0 top is Ace of Diamonds
  const aceDiamonds = new Card(0, "D", 1);
  game.tableau[0] = [aceDiamonds];

  const hint = generateHint(game);
  assert.ok(hint);
  assert.match(hint.action, /^m t0>h/);
  assert.equal(hint.source, "t0");
  assert.equal(hint.category, "compulsory_tableau_foundation");
  assert.match(hint.headline, /Move A♦ from Tableau 1 to Foundation/i);
  assert.match(hint.rule, /compulsory/i);
  assert.match(hint.tension, /forecloses.*building|clears column|seizure/i);
});

test("Hints: opponent loading from Reserve delays opponent", () => {
  const game = new CrapetteGame({ seed: 42n });
  game.activePlayer = 0;
  // Foundations empty, active player has 8 of Hearts on reserve
  game.players[0].reserve = [new Card(0, "H", 8)];
  // Opponent reserve top is 7 of Hearts
  game.players[1].reserve = [new Card(1, "H", 7)];
  // Ensure no empty tableau spaces so space filling doesn't override
  for (let t = 0; t < 8; t++) {
    game.tableau[t] = [new Card(0, "C", 2)];
  }

  const hint = generateHint(game);
  assert.ok(hint);
  assert.equal(hint.action, "m r>opp_r");
  assert.equal(hint.source, "r");
  assert.equal(hint.destination, "opp_r");
  assert.equal(hint.category, "opponent_load");
  assert.match(hint.headline, /Load 8♥ onto Opponent.*7♥/i);
  assert.match(hint.rule, /same suit.*rank/i);
  assert.match(hint.tension, /burdens their pile and delays them/i);
});

test("Hints: opponent loading onto Opponent Waste", () => {
  const game = new CrapetteGame({ seed: 42n });
  game.activePlayer = 0;
  game.players[0].reserve = [new Card(0, "S", 5)];
  game.players[1].reserve = [new Card(1, "D", 10)]; // not matchable
  game.players[1].waste = [new Card(1, "S", 6)]; // 5 can load on 6
  for (let t = 0; t < 8; t++) {
    game.tableau[t] = [new Card(0, "C", 2)];
  }

  const hint = generateHint(game);
  assert.ok(hint);
  assert.equal(hint.action, "m r>opp_w");
  assert.equal(hint.destination, "opp_w");
  assert.equal(hint.category, "opponent_load");
  assert.match(hint.headline, /Load 5♠ onto Opponent.*6♠/i);
  assert.match(hint.tension, /burdens|waste/i);
});

test("Hints: tableau building descending alternating colors", () => {
  const game = new CrapetteGame({ seed: 42n });
  game.activePlayer = 0;
  // Reserve top is 9 of Spades (Black)
  game.players[0].reserve = [new Card(0, "S", 9)];
  // Tableau 0 top is 10 of Diamonds (Red)
  game.tableau[0] = [new Card(0, "D", 10)];
  // Fill other tableau slots
  for (let t = 1; t < 8; t++) {
    game.tableau[t] = [new Card(0, "C", 2)];
  }
  // Opponent has no match
  game.players[1].reserve = [new Card(1, "C", 5)];

  const hint = generateHint(game);
  assert.ok(hint);
  assert.equal(hint.action, "m r>t0");
  assert.equal(hint.source, "r");
  assert.equal(hint.destination, "t0");
  assert.equal(hint.category, "tableau_build");
  assert.match(hint.headline, /Build 9♠ on 10♦/i);
  assert.match(hint.rule, /strictly alternating colors/i);
  assert.match(hint.tension, /Reserve frees up your critical 13-card bottleneck|consolidates the tableau/i);
});

test("Hints: filling empty tableau space from Reserve", () => {
  const game = new CrapetteGame({ seed: 42n });
  game.activePlayer = 0;
  game.players[0].reserve = [new Card(0, "S", 7)];
  // Empty tableau column 3
  game.tableau[3] = [];
  for (let t = 0; t < 8; t++) {
    if (t !== 3) game.tableau[t] = [new Card(0, "S", 2)];
  }
  // Opponent has no match
  game.players[1].reserve = [new Card(1, "C", 11)];

  const hint = generateHint(game);
  assert.ok(hint);
  assert.equal(hint.action, "m r>t3");
  assert.equal(hint.source, "r");
  assert.equal(hint.destination, "t3");
  assert.equal(hint.category, "fill_space");
  assert.match(hint.headline, /Move 7♠ from Reserve to empty Tableau space 4/i);
  assert.match(hint.rule, /empty tableau space/i);
  assert.match(hint.tension, /forecloses your reserve from emptying into it|empty tableau spaces/i);
});

test("Hints: drawn card to Foundation", () => {
  const game = new CrapetteGame({ seed: 42n });
  game.activePlayer = 0;
  game.drawnCard = new Card(0, "S", 1); // Ace of Spades drawn

  const hint = generateHint(game);
  assert.ok(hint);
  assert.match(hint.action, /^m drawn>h/);
  assert.equal(hint.source, "drawn");
  assert.equal(hint.category, "drawn_foundation");
  assert.match(hint.headline, /Move A♠ from Drawn Card to Foundation/i);
  assert.match(hint.tension, /permanently/i);
});

test("Hints: drawn card to Opponent", () => {
  const game = new CrapetteGame({ seed: 42n });
  game.activePlayer = 0;
  game.drawnCard = new Card(0, "H", 8);
  game.players[1].reserve = [new Card(1, "H", 7)];

  const hint = generateHint(game);
  assert.ok(hint);
  assert.equal(hint.action, "m drawn>opp_r");
  assert.equal(hint.source, "drawn");
  assert.equal(hint.destination, "opp_r");
  assert.equal(hint.category, "opponent_load");
  assert.match(hint.headline, /Load 8♥ onto Opponent/i);
  assert.match(hint.tension, /burdens/i);
});

test("Hints: drawn card to Tableau building", () => {
  const game = new CrapetteGame({ seed: 42n });
  game.activePlayer = 0;
  game.drawnCard = new Card(0, "C", 5); // 5 of Clubs (Black)
  game.tableau[2] = [new Card(0, "H", 6)]; // 6 of Hearts (Red)

  const hint = generateHint(game);
  assert.ok(hint);
  assert.equal(hint.action, "m drawn>t2");
  assert.equal(hint.source, "drawn");
  assert.equal(hint.destination, "t2");
  assert.equal(hint.category, "drawn_tableau");
  assert.match(hint.headline, /Build 5♣ on 6♥/i);
  assert.match(hint.tension, /drawn card|turn alive/i);
});

test("Hints: discard drawn card to Waste when no board moves exist", () => {
  const game = new CrapetteGame({ seed: 42n });
  game.activePlayer = 0;
  game.drawnCard = new Card(0, "D", 10);
  // Ensure board cannot accept 10 of Diamonds
  for (let t = 0; t < 8; t++) {
    game.tableau[t] = [new Card(0, "D", 5)];
  }
  game.players[1].reserve = [new Card(1, "S", 2)];
  game.players[1].waste = [new Card(1, "S", 2)];

  const hint = generateHint(game);
  assert.ok(hint);
  assert.equal(hint.action, "waste");
  assert.equal(hint.source, "drawn");
  assert.equal(hint.destination, "waste");
  assert.equal(hint.category, "waste");
  assert.match(hint.headline, /Discard 10♦ to Waste/i);
  assert.match(hint.rule, /waste pile/i);
  assert.match(hint.tension, /no legal board plays.*waste ends your turn/i);
});

test("Hints: draw from stock when no moves and stock has cards", () => {
  const game = new CrapetteGame({ seed: 42n });
  game.activePlayer = 0;
  game.drawnCard = null;
  // Deadlock board where no moves exist
  for (let t = 0; t < 8; t++) {
    game.tableau[t] = [new Card(0, "D", 5)];
  }
  game.players[0].reserve = [new Card(0, "D", 5)];
  game.players[1].reserve = [new Card(1, "D", 8)];
  game.players[0].stock = [new Card(0, "S", 2)];

  const hint = generateHint(game);
  assert.ok(hint);
  assert.equal(hint.action, "draw");
  assert.equal(hint.source, "stock");
  assert.equal(hint.destination, "drawn");
  assert.equal(hint.category, "draw");
  assert.match(hint.headline, /Draw from Stock/i);
  assert.match(hint.tension, /fresh opportunities|Drawing stock ends your flexibility/i);
});

test("Hints: pass turn when stock and waste are exhausted and no moves exist", () => {
  const game = new CrapetteGame({ seed: 42n });
  game.activePlayer = 0;
  game.drawnCard = null;
  game.players[0].stock = [];
  game.players[0].waste = [];
  game.players[0].reserve = [new Card(0, "D", 5)];
  for (let t = 0; t < 8; t++) {
    game.tableau[t] = [new Card(0, "D", 5)];
  }
  game.players[1].reserve = [new Card(1, "D", 8)];

  const hint = generateHint(game);
  assert.ok(hint);
  assert.equal(hint.action, "pass");
  assert.equal(hint.category, "pass");
  assert.match(hint.headline, /Pass Turn/i);
  assert.match(hint.tension, /exhausted/i);
});

test("Hints: supports serialized state object as well as CrapetteGame instance", () => {
  const game = new CrapetteGame({ seed: 42n });
  const state = game.state();

  const hintFromGame = generateHint(game);
  const hintFromState = generateHint(state);

  assert.ok(hintFromGame);
  assert.ok(hintFromState);
  assert.equal(hintFromGame.action, hintFromState.action);
  assert.equal(hintFromGame.category, hintFromState.category);
});

test("Hints: generateAllHints returns prioritized list of all valid candidate hints", () => {
  const game = new CrapetteGame({ seed: 42n });
  game.activePlayer = 0;
  game.drawnCard = null;
  game.players[0].reserve = [new Card(0, "S", 1)]; // Ace to foundation
  game.tableau[0] = [new Card(0, "D", 1)]; // Ace to foundation as well

  const allHints = generateAllHints(game);
  assert.ok(Array.isArray(allHints));
  assert.ok(allHints.length >= 2);
  // Reserve Ace to foundation must come before tableau Ace to foundation
  const resIdx = allHints.findIndex((h) => h.category === "compulsory_reserve_foundation");
  const tabIdx = allHints.findIndex((h) => h.category === "compulsory_tableau_foundation");
  assert.ok(resIdx !== -1 && tabIdx !== -1);
  assert.ok(resIdx < tabIdx, "Reserve foundation hint comes before tableau foundation hint");
});

test("describeMove: helper formats engine commands into human-readable actions", () => {
  const game = new CrapetteGame({ seed: 42n });
  game.players[0].reserve = [new Card(0, "S", 7)];
  const desc = describeMove("m r>h0", game);
  assert.match(desc, /Move 7♠ from Reserve to Foundation 1/i);

  const drawDesc = describeMove("draw", game);
  assert.match(drawDesc, /Draw from Stock/i);

  const crapetteDesc = describeMove("crapette", game);
  assert.match(crapetteDesc, /Call CRAPETTE/i);
});

test("getZpdRationale: returns appropriate strategic teaching for any category", () => {
  const cat = getZpdRationale("opponent_load");
  assert.match(cat, /burdens/i);
  const fallback = getZpdRationale("unknown_category");
  assert.ok(fallback.length > 0);
});

test("Hints: returned hint contains full clean structured object matching user specification", () => {
  const game = new CrapetteGame({ seed: 42n });
  game.activePlayer = 0;
  game.players[0].reserve = [new Card(0, "S", 7)];
  game.tableau[2] = [new Card(0, "H", 8)];
  for (let t = 0; t < 8; t++) {
    if (t !== 2) game.tableau[t] = [new Card(0, "C", 2)];
  }

  const hint = generateHint(game);
  assert.ok(hint);
  assert.equal(hint.action, "m r>t2");
  assert.equal(hint.headline, "Build 7♠ on 8♥");
  assert.ok(hint.rule.includes("alternating"));
  assert.ok(hint.tension.includes("Reserve") || hint.tension.includes("bottleneck"));
  assert.equal(hint.source, "r");
  assert.equal(hint.destination, "t2");
  assert.ok(hint.card);
  assert.equal(hint.card.code, "7S");
});

test("Hints: returns null when game is over or winner is declared", () => {
  const game = new CrapetteGame({ seed: 42n });
  game.winner = 0;
  assert.equal(generateHint(game), null);
  assert.deepEqual(generateAllHints(game), []);
  assert.equal(generateHint(null), null);
  assert.deepEqual(generateAllHints(null), []);
});

test("Hints: tableau card loading onto Opponent Reserve", () => {
  const game = new CrapetteGame({ seed: 42n });
  game.activePlayer = 0;
  game.players[0].reserve = []; // Empty reserve
  game.tableau[0] = [new Card(0, "H", 8), new Card(0, "D", 7)]; // column with >1 cards
  game.players[1].reserve = [new Card(1, "D", 6)]; // 7 can load on 6
  for (let t = 1; t < 8; t++) {
    game.tableau[t] = [new Card(0, "C", 2)];
  }

  const hint = generateHint(game);
  assert.ok(hint);
  assert.equal(hint.action, "m t0>opp_r");
  assert.equal(hint.category, "opponent_load");
  assert.match(hint.headline, /Load 7♦ onto Opponent.*6♦/i);
});

test("Hints: drawn card to empty tableau space when no build moves", () => {
  const game = new CrapetteGame({ seed: 42n });
  game.activePlayer = 0;
  game.drawnCard = new Card(0, "S", 7);
  game.tableau[4] = []; // empty space
  for (let t = 0; t < 8; t++) {
    if (t !== 4) game.tableau[t] = [new Card(0, "S", 2)]; // cannot build
  }
  game.players[1].reserve = [new Card(1, "C", 11)];
  game.players[1].waste = [new Card(1, "C", 11)];

  const hint = generateHint(game);
  assert.ok(hint);
  assert.equal(hint.action, "m drawn>t4");
  assert.equal(hint.category, "drawn_tableau");
  assert.match(hint.headline, /Move 7♠ to empty Tableau space 5/i);
});

test("Hints: pure serialized JSON state produces identical hint", () => {
  const game = new CrapetteGame({ seed: 42n });
  game.activePlayer = 0;
  game.drawnCard = new Card(0, "D", 10);
  for (let t = 0; t < 8; t++) {
    game.tableau[t] = [new Card(0, "D", 5)];
  }
  const pureJsonState = JSON.parse(JSON.stringify(game.state()));
  const hint = generateHint(pureJsonState);
  assert.ok(hint);
  assert.equal(hint.action, "waste");
  assert.equal(hint.category, "waste");
});

