// Authoritative Crapette (Russian Bank) rules engine.

import { Rng } from "./rng.js";
import {
  Card,
  deckPack,
  canBuildOnTableau,
  canBuildOnFoundation,
  canLoadOnOpponent,
} from "./cards.js";

export class CrapetteGame {
  constructor({ seed = 12345n, mode = "competitive" } = {}) {
    this.seed = BigInt(seed);
    this.mode = mode; // "competitive" or "cozy"
    this.history = []; // undo history stack for current turn
    this.drawnCard = null;
    this.turnHistory = [];
    this.crapetteBlunder = null; // details if active player made a blunder

    // Initialize players
    this.players = [
      {
        id: 0,
        name: "You",
        deck: "red",
        reserve: [],
        stock: [],
        waste: [],
        score: 0,
      },
      {
        id: 1,
        name: "Opponent",
        deck: "blue",
        reserve: [],
        stock: [],
        waste: [],
        score: 0,
      },
    ];

    // Shared zones
    this.tableau = Array.from({ length: 8 }, () => []);
    this.foundations = Array.from({ length: 8 }, () => []);

    this.deal();
  }

  deal() {
    const rng0 = Rng.stream(this.seed, 0);
    const rng1 = Rng.stream(this.seed, 1);

    const pack0 = rng0.shuffle(deckPack(0));
    const pack1 = rng1.shuffle(deckPack(1));

    // Deal Player 0 Reserve (13 cards: 0..12)
    this.players[0].reserve = pack0.slice(0, 13);
    // Deal 4 cards to Tableau (0..3)
    this.tableau[0] = [pack0[13]];
    this.tableau[1] = [pack0[14]];
    this.tableau[2] = [pack0[15]];
    this.tableau[3] = [pack0[16]];
    // Remaining 35 to Stock
    this.players[0].stock = pack0.slice(17);

    // Deal Player 1 Reserve (13 cards: 0..12)
    this.players[1].reserve = pack1.slice(0, 13);
    // Deal 4 cards to Tableau (4..7)
    this.tableau[4] = [pack1[13]];
    this.tableau[5] = [pack1[14]];
    this.tableau[6] = [pack1[15]];
    this.tableau[7] = [pack1[16]];
    // Remaining 35 to Stock
    this.players[1].stock = pack1.slice(17);

    // Determine first player: lower reserve top card rank plays first
    const r0 = this.players[0].reserve[12].rank;
    const r1 = this.players[1].reserve[12].rank;
    if (r0 < r1) {
      this.activePlayer = 0;
    } else if (r1 < r0) {
      this.activePlayer = 1;
    } else {
      // Tie breaker: compare tableau cards
      let chosen = 0;
      for (let i = 0; i < 4; i++) {
        const t0 = this.tableau[i][0].rank;
        const t1 = this.tableau[i + 4][0].rank;
        if (t0 < t1) {
          chosen = 0;
          break;
        } else if (t1 < t0) {
          chosen = 1;
          break;
        }
      }
      this.activePlayer = chosen;
    }
  }

  get opponent() {
    return 1 - this.activePlayer;
  }

  // Returns list of compulsory moves currently available to active player
  getCompulsoryMoves() {
    const list = [];
    const active = this.players[this.activePlayer];

    // Priority 1: Reserve to Foundation (highest compulsory rule)
    if (active.reserve.length > 0) {
      const topReserve = active.reserve[active.reserve.length - 1];
      for (let f = 0; f < 8; f++) {
        const fTop = this.foundations[f].at(-1) ?? null;
        if (canBuildOnFoundation(topReserve, fTop)) {
          list.push({ src: "r", dst: `h${f}`, priority: 1, card: topReserve });
          break;
        }
      }
    }

    // Priority 2: General Foundation moves (tableau or drawn card to foundation)
    for (let t = 0; t < 8; t++) {
      if (this.tableau[t].length > 0) {
        const card = this.tableau[t].at(-1);
        for (let f = 0; f < 8; f++) {
          const fTop = this.foundations[f].at(-1) ?? null;
          if (canBuildOnFoundation(card, fTop)) {
            list.push({ src: `t${t}`, dst: `h${f}`, priority: 2, card });
            break;
          }
        }
      }
    }

    if (this.drawnCard) {
      for (let f = 0; f < 8; f++) {
        const fTop = this.foundations[f].at(-1) ?? null;
        if (canBuildOnFoundation(this.drawnCard, fTop)) {
          list.push({ src: "drawn", dst: `h${f}`, priority: 2, card: this.drawnCard });
          break;
        }
      }
    }

    // Priority 3: Reserve to empty tableau space
    const emptyTableauIndex = this.tableau.findIndex((col) => col.length === 0);
    if (emptyTableauIndex !== -1 && active.reserve.length > 0) {
      const topReserve = active.reserve.at(-1);
      list.push({
        src: "r",
        dst: `t${emptyTableauIndex}`,
        priority: 3,
        card: topReserve,
      });
    }

    return list;
  }

  // Returns all legally possible moves
  getLegalMoves() {
    const legal = [];
    const active = this.players[this.activePlayer];
    const opp = this.players[this.opponent];

    const sources = [];
    if (this.drawnCard) {
      sources.push({ key: "drawn", card: this.drawnCard });
    } else {
      if (active.reserve.length > 0) {
        sources.push({ key: "r", card: active.reserve.at(-1) });
      }
      for (let t = 0; t < 8; t++) {
        if (this.tableau[t].length > 0) {
          sources.push({ key: `t${t}`, card: this.tableau[t].at(-1) });
        }
      }
    }

    for (const { key, card } of sources) {
      // Move to Foundation
      for (let f = 0; f < 8; f++) {
        const fTop = this.foundations[f].at(-1) ?? null;
        if (canBuildOnFoundation(card, fTop)) {
          legal.push(`m ${key}>h${f}`);
          legal.push(`m ${key}>h`); // general alias
        }
      }

      // Move to Tableau
      for (let t = 0; t < 8; t++) {
        if (key === `t${t}`) continue;
        const tTop = this.tableau[t].at(-1) ?? null;
        if (canBuildOnTableau(card, tTop)) {
          legal.push(`m ${key}>t${t}`);
        }
      }

      // Move to Opponent Reserve
      if (opp.reserve.length > 0) {
        const oppRTop = opp.reserve.at(-1);
        if (canLoadOnOpponent(card, oppRTop)) {
          legal.push(`m ${key}>opp_r`);
        }
      }

      // Move to Opponent Waste
      if (opp.waste.length > 0) {
        const oppWTop = opp.waste.at(-1);
        if (canLoadOnOpponent(card, oppWTop)) {
          legal.push(`m ${key}>opp_w`);
        }
      }
    }

    // Can draw from stock if no card currently drawn and stock or waste has cards
    if (!this.drawnCard) {
      if (active.stock.length > 0 || active.waste.length > 0) {
        legal.push("draw");
      }
      if (active.stock.length === 0 && active.waste.length === 0) {
        legal.push("pass");
      }
    } else {
      legal.push("waste");
    }

    return Array.from(new Set(legal));
  }

  // Retrieve card object from source string
  getCard(src) {
    if (src === "drawn") return this.drawnCard;
    if (src === "r") {
      const r = this.players[this.activePlayer].reserve;
      return r.length ? r[r.length - 1] : null;
    }
    if (src.startsWith("t")) {
      const idx = parseInt(src.slice(1), 10);
      const col = this.tableau[idx];
      return col && col.length ? col[col.length - 1] : null;
    }
    return null;
  }

  // Remove card from source
  takeCard(src) {
    if (src === "drawn") {
      const c = this.drawnCard;
      this.drawnCard = null;
      return c;
    }
    if (src === "r") {
      return this.players[this.activePlayer].reserve.pop();
    }
    if (src.startsWith("t")) {
      const idx = parseInt(src.slice(1), 10);
      return this.tableau[idx].pop();
    }
    return null;
  }

  // Put card back (for undo)
  restoreCard(src, card) {
    if (src === "drawn") {
      this.drawnCard = card;
    } else if (src === "r") {
      this.players[this.activePlayer].reserve.push(card);
    } else if (src.startsWith("t")) {
      const idx = parseInt(src.slice(1), 10);
      this.tableau[idx].push(card);
    }
  }

  send(cmd) {
    const trimmed = cmd.trim();

    if (trimmed === "draw") {
      return this.executeDraw();
    }

    if (trimmed === "waste") {
      return this.executeWaste();
    }

    if (trimmed === "crapette") {
      return this.executeCrapetteCall();
    }

    if (trimmed === "undo") {
      return this.executeUndo();
    }

    if (trimmed === "pass") {
      return this.executePass();
    }

    if (trimmed.startsWith("m ")) {
      const parts = trimmed.slice(2).split(">");
      if (parts.length === 2) {
        return this.executeMove(parts[0].trim(), parts[1].trim());
      }
    }

    return { ok: false, error: `Unrecognized command: ${cmd}` };
  }

  executeDraw() {
    if (this.drawnCard) {
      return { ok: false, error: "Already have a drawn card" };
    }

    // Check for compulsory move violations in competitive mode
    const compulsory = this.getCompulsoryMoves();
    if (this.mode === "competitive" && compulsory.length > 0) {
      // Oversight committed! Mark blunder for opponent to call
      this.crapetteBlunder = {
        type: "omitted_compulsory",
        moves: compulsory,
      };
    }

    const active = this.players[this.activePlayer];
    if (active.stock.length === 0) {
      // Recycle waste into stock (turned face down without shuffling)
      if (active.waste.length === 0) {
        return { ok: false, error: "Stock and waste are both empty" };
      }
      active.stock = [...active.waste].reverse();
      active.waste = [];
    }

    this.drawnCard = active.stock.pop();
    this.history.push({ action: "draw", card: this.drawnCard });
    return { ok: true, state: this.state() };
  }

  executeWaste() {
    if (!this.drawnCard) {
      return { ok: false, error: "No drawn card to place in waste" };
    }

    // Placing drawn card on waste ends the turn!
    const active = this.players[this.activePlayer];
    active.waste.push(this.drawnCard);
    this.drawnCard = null;

    // Reset turn-specific history and switch player
    this.history = [];
    this.crapetteBlunder = null;
    this.checkWin();
    this.activePlayer = 1 - this.activePlayer;

    return { ok: true, state: this.state() };
  }

  executePass() {
    this.history = [];
    this.crapetteBlunder = null;
    this.checkWin();
    this.activePlayer = 1 - this.activePlayer;
    return { ok: true, state: this.state() };
  }

  executeMove(src, dst) {
    const card = this.getCard(src);
    if (!card) return { ok: false, error: `No card at ${src}` };

    // Check foundation destination
    if (dst === "h" || dst.startsWith("h")) {
      let fIndex = -1;
      if (dst === "h") {
        // Auto-find matching foundation
        for (let i = 0; i < 8; i++) {
          const fTop = this.foundations[i].at(-1) ?? null;
          if (canBuildOnFoundation(card, fTop)) {
            fIndex = i;
            break;
          }
        }
      } else {
        fIndex = parseInt(dst.slice(1), 10);
      }

      if (fIndex === -1 || fIndex >= 8) {
        return { ok: false, error: "Invalid foundation index" };
      }

      const fTop = this.foundations[fIndex].at(-1) ?? null;
      if (!canBuildOnFoundation(card, fTop)) {
        return { ok: false, error: `Cannot build ${card.code} on foundation ${fIndex}` };
      }

      // Check priority 1: if reserve could have gone to foundation, moving something else first is a blunder
      if (this.mode === "competitive" && src !== "r") {
        const active = this.players[this.activePlayer];
        if (active.reserve.length > 0) {
          const rTop = active.reserve.at(-1);
          for (let f = 0; f < 8; f++) {
            if (canBuildOnFoundation(rTop, this.foundations[f].at(-1) ?? null)) {
              this.crapetteBlunder = {
                type: "reserve_priority_violated",
                card: rTop,
              };
              break;
            }
          }
        }
      }

      const taken = this.takeCard(src);
      this.foundations[fIndex].push(taken);
      this.history.push({ action: "move", src, dst: `h${fIndex}`, card: taken });
      this.checkWin();
      return { ok: true, state: this.state() };
    }

    // Check Tableau destination
    if (dst.startsWith("t")) {
      const tIndex = parseInt(dst.slice(1), 10);
      if (tIndex < 0 || tIndex >= 8) return { ok: false, error: "Invalid tableau index" };

      const tTop = this.tableau[tIndex].at(-1) ?? null;
      if (!canBuildOnTableau(card, tTop)) {
        return { ok: false, error: `Cannot build ${card.code} on tableau ${tIndex}` };
      }

      const taken = this.takeCard(src);
      this.tableau[tIndex].push(taken);
      this.history.push({ action: "move", src, dst: `t${tIndex}`, card: taken });
      this.checkWin();
      return { ok: true, state: this.state() };
    }

    // Check Opponent Reserve destination
    if (dst === "opp_r") {
      const opp = this.players[this.opponent];
      if (opp.reserve.length === 0) return { ok: false, error: "Opponent reserve is empty" };
      const oppRTop = opp.reserve.at(-1);
      if (!canLoadOnOpponent(card, oppRTop)) {
        return { ok: false, error: `Cannot load ${card.code} on opponent reserve` };
      }

      const taken = this.takeCard(src);
      opp.reserve.push(taken);
      this.history.push({ action: "move", src, dst: "opp_r", card: taken });
      this.checkWin();
      return { ok: true, state: this.state() };
    }

    // Check Opponent Waste destination
    if (dst === "opp_w") {
      const opp = this.players[this.opponent];
      if (opp.waste.length === 0) return { ok: false, error: "Opponent waste is empty" };
      const oppWTop = opp.waste.at(-1);
      if (!canLoadOnOpponent(card, oppWTop)) {
        return { ok: false, error: `Cannot load ${card.code} on opponent waste` };
      }

      const taken = this.takeCard(src);
      opp.waste.push(taken);
      this.history.push({ action: "move", src, dst: "opp_w", card: taken });
      this.checkWin();
      return { ok: true, state: this.state() };
    }

    return { ok: false, error: `Invalid destination ${dst}` };
  }

  executeUndo() {
    if (this.history.length === 0) {
      return { ok: false, error: "Nothing to undo in current turn" };
    }

    const last = this.history.pop();
    if (last.action === "draw") {
      this.players[this.activePlayer].stock.push(this.drawnCard);
      this.drawnCard = null;
    } else if (last.action === "move") {
      let card;
      if (last.dst.startsWith("h")) {
        const idx = parseInt(last.dst.slice(1), 10);
        card = this.foundations[idx].pop();
      } else if (last.dst.startsWith("t")) {
        const idx = parseInt(last.dst.slice(1), 10);
        card = this.tableau[idx].pop();
      } else if (last.dst === "opp_r") {
        card = this.players[this.opponent].reserve.pop();
      } else if (last.dst === "opp_w") {
        card = this.players[this.opponent].waste.pop();
      }
      this.restoreCard(last.src, card);
    }

    return { ok: true, state: this.state() };
  }

  executeCrapetteCall() {
    // If a blunder occurred, penalty is applied: active player's turn forfeits to opponent
    if (!this.crapetteBlunder) {
      return { ok: false, error: "No Crapette blunder was committed!" };
    }

    // Undo unwarranted draw if applicable
    if (this.drawnCard) {
      this.players[this.activePlayer].stock.push(this.drawnCard);
      this.drawnCard = null;
    }

    // Seize turn for opponent!
    this.crapetteBlunder = null;
    this.history = [];
    this.activePlayer = 1 - this.activePlayer;

    return { ok: true, penalty: true, state: this.state() };
  }

  checkWin() {
    for (let p = 0; p < 2; p++) {
      const pl = this.players[p];
      if (pl.reserve.length === 0 && pl.stock.length === 0 && pl.waste.length === 0 && this.drawnCard === null) {
        this.winner = p;
        return;
      }
    }
  }

  state() {
    return {
      protocol: 1,
      seed: this.seed.toString(),
      mode: this.mode,
      activePlayer: this.activePlayer,
      opponent: this.opponent,
      winner: this.winner ?? null,
      drawnCard: this.drawnCard ? { ...this.drawnCard } : null,
      crapetteEligible: this.crapetteBlunder !== null,
      undoable: this.history.length > 0,
      tableau: this.tableau.map((col) => col.map((c) => ({ ...c }))),
      foundations: this.foundations.map((f) => f.map((c) => ({ ...c }))),
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        deck: p.deck,
        reserveCount: p.reserve.length,
        reserveTop: p.reserve.length ? { ...p.reserve[p.reserve.length - 1] } : null,
        reserve: p.reserve.map((c) => ({ ...c })),
        stockCount: p.stock.length,
        stock: p.stock.map((c) => ({ ...c })),
        wasteCount: p.waste.length,
        wasteTop: p.waste.length ? { ...p.waste[p.waste.length - 1] } : null,
        waste: p.waste.map((c) => ({ ...c })),
        score: p.score,
      })),
      legal: this.getLegalMoves(),
      compulsory: this.getCompulsoryMoves().map((m) => `m ${m.src}>${m.dst}`),
    };
  }
}
