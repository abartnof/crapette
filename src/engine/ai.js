// Heuristic AI opponent for Crapette (Russian Bank)
import { Rng } from "./rng.js";

export class CrapetteAI {
  constructor({ skill = "master", seed = 12345n, blunderRate = 0.0 } = {}) {
    this.skill = skill; // "master" or "novice"
    this.rng = Rng.stream(BigInt(seed), 2);
    this.blunderRate = skill === "novice" ? (blunderRate || 0.2) : 0.0;
    this.turnMoves = [];
    this.recentBoardMoves = [];
    this.lastPlayer = null;
  }

  chooseMove(game) {
    const state = typeof game.state === "function" ? game.state() : game;

    if (state.activePlayer !== this.lastPlayer) {
      this.turnMoves = [];
      this.lastPlayer = state.activePlayer;
    }

    // 1. Blunder exploitation: If opponent committed a blunder and Crapette is eligible
    if (state.crapetteEligible) {
      if (this.skill === "master") {
        return "crapette";
      }
      // Novice may occasionally miss the call
      if (this.rng.nextInt(0, 100) < 80) {
        return "crapette";
      }
    }

    const legal = state.legal ?? [];

    const recordMove = (m) => {
      if (m && m.startsWith("m ")) {
        const parts = m.slice(2).split(">");
        this.turnMoves.push({ src: parts[0], dst: parts[1] });
        this.recentBoardMoves.push({ src: parts[0], dst: parts[1] });
        if (this.recentBoardMoves.length > 8) this.recentBoardMoves.shift();
      }
      return m;
    };

    // If a card is currently drawn:
    // The active player must play or discard the drawn card!
    if (state.drawnCard) {
      // Priority 1: Move drawn card to foundation
      const drawnFoundation = legal.find(
        (m) => m === "m drawn>h" || m.startsWith("m drawn>h")
      );
      if (drawnFoundation) return recordMove(drawnFoundation);

      // Priority 2: Opponent loading (reserve first, then waste)
      if (legal.includes("m drawn>opp_r")) return recordMove("m drawn>opp_r");
      if (legal.includes("m drawn>opp_w")) return recordMove("m drawn>opp_w");

      // Priority 3 & 4: Move drawn card to tableau
      // Prefer non-empty tableau columns (building), then empty spaces
      const tableauMoves = legal.filter((m) => m.startsWith("m drawn>t"));
      if (tableauMoves.length > 0) {
        if (state.tableau) {
          const buildOnExisting = tableauMoves.find((m) => {
            const idx = parseInt(m.split(">t")[1], 10);
            return state.tableau[idx] && state.tableau[idx].length > 0;
          });
          if (buildOnExisting) return recordMove(buildOnExisting);
        }
        return recordMove(tableauMoves[0]);
      }

      // Priority 6: If drawn card cannot be moved to foundation, tableau, or opponent, "waste"
      return "waste";
    }

    // When NO card is drawn:

    // Priority 1: Execute compulsory foundation moves (m r>h or m tX>h)
    // Reserve to foundation takes precedence over tableau to foundation
    const reserveToFoundation = legal.find(
      (m) => m === "m r>h" || m.startsWith("m r>h")
    );
    if (reserveToFoundation) return recordMove(reserveToFoundation);

    const tableauToFoundation = legal.find(
      (m) => m.startsWith("m t") && (m.endsWith(">h") || m.includes(">h"))
    );
    if (tableauToFoundation) return recordMove(tableauToFoundation);

    // Also check state.compulsory if legal doesn't list it or if specific syntax
    const compulsory =
      typeof game.getCompulsoryMoves === "function"
        ? game.getCompulsoryMoves()
        : [];
    const compFoundation = compulsory.filter((m) => m.dst.startsWith("h"));
    if (compFoundation.length > 0) {
      compFoundation.sort((a, b) => a.priority - b.priority);
      return recordMove(`m ${compFoundation[0].src}>${compFoundation[0].dst}`);
    }

    // Priority 2: Opponent loading on opponent's reserve (m r>opp_r or m tX>opp_r)
    // or opponent's waste (m r>opp_w or m tX>opp_w)
    if (legal.includes("m r>opp_r")) return recordMove("m r>opp_r");
    const tableauToOppR = legal.find((m) => {
      if (!m.startsWith("m t") || !m.endsWith(">opp_r")) return false;
      const parts = m.slice(2).split(">");
      const src = parts[0];
      if (state.tableau) {
        const idx = parseInt(src.slice(1), 10);
        if (state.tableau[idx] && state.tableau[idx].length <= 1) return false;
      }
      if (this.recentBoardMoves.some((prev) => prev.src === "r" && prev.dst === src)) {
        return false;
      }
      return true;
    });
    if (tableauToOppR) return recordMove(tableauToOppR);

    if (legal.includes("m r>opp_w")) return recordMove("m r>opp_w");
    const tableauToOppW = legal.find((m) => {
      if (!m.startsWith("m t") || !m.endsWith(">opp_w")) return false;
      const parts = m.slice(2).split(">");
      const src = parts[0];
      if (state.tableau) {
        const idx = parseInt(src.slice(1), 10);
        if (state.tableau[idx] && state.tableau[idx].length <= 1) return false;
      }
      return true;
    });
    if (tableauToOppW) return recordMove(tableauToOppW);

    // Priority 3: Tableau building moves (m tX>tY or m r>tY)
    // Tableau building moves build onto existing columns (descending alternating colors)
    const rToTableauMoves = legal.filter((m) => m.startsWith("m r>t"));
    if (state.tableau) {
      const rToNonEmpty = rToTableauMoves.find((m) => {
        const idx = parseInt(m.split(">t")[1], 10);
        return state.tableau[idx] && state.tableau[idx].length > 0;
      });
      if (rToNonEmpty) return recordMove(rToNonEmpty);
    }

    // Filter tToTMoves to avoid infinite cycles
    const isReverseMove = (src, dst) => {
      return (
        this.turnMoves.some((prev) => prev.src === dst && prev.dst === src) ||
        this.recentBoardMoves.some((prev) => prev.src === dst && prev.dst === src)
      );
    };

    const tToTMoves = legal.filter(
      (m) => m.startsWith("m t") && m.includes(">t")
    );

    const tCount = this.turnMoves.filter(
      (m) => m.src.startsWith("t") && m.dst.startsWith("t")
    ).length;

    const validTToTMoves =
      tCount >= 4
        ? []
        : tToTMoves.filter((m) => {
            const parts = m.slice(2).split(">");
            const src = parts[0];
            const dst = parts[1];
            const srcIdx = parseInt(src.slice(1), 10);
            const dstIdx = parseInt(dst.slice(1), 10);

            if (state.tableau) {
              // Avoid moving a lone card to an empty slot (useless slot swap)
              if (
                state.tableau[srcIdx] &&
                state.tableau[srcIdx].length <= 1 &&
                state.tableau[dstIdx] &&
                state.tableau[dstIdx].length === 0
              ) {
                return false;
              }
            }

            // Avoid immediate undo/reverse
            if (isReverseMove(src, dst)) {
              return false;
            }

            return true;
          });

    if (state.tableau) {
      const tToNonEmpty = validTToTMoves.find((m) => {
        const parts = m.slice(2).split(">");
        const dstIdx = parseInt(parts[1].slice(1), 10);
        return state.tableau[dstIdx] && state.tableau[dstIdx].length > 0;
      });
      if (tToNonEmpty) return recordMove(tToNonEmpty);
    } else if (validTToTMoves.length > 0) {
      return recordMove(validTToTMoves[0]);
    }

    // Priority 4: Fill empty tableau spaces from reserve
    const reserveToEmpty = compulsory.find(
      (m) => m.src === "r" && m.dst.startsWith("t")
    );
    if (reserveToEmpty) {
      return recordMove(`m ${reserveToEmpty.src}>${reserveToEmpty.dst}`);
    }
    if (state.tableau) {
      const rToEmpty = rToTableauMoves.find((m) => {
        const idx = parseInt(m.split(">t")[1], 10);
        return state.tableau[idx] && state.tableau[idx].length === 0;
      });
      if (rToEmpty) return recordMove(rToEmpty);
    } else if (rToTableauMoves.length > 0) {
      return recordMove(rToTableauMoves[0]);
    }

    // Priority 5: If active and no drawn card, "draw"
    if (legal.includes("draw")) {
      return "draw";
    }

    if (legal.includes("pass")) {
      return "pass";
    }

    if (legal.length > 0 && !legal[0].startsWith("m t")) {
      return recordMove(legal[0]);
    }

    if (state.drawnCard) {
      return "waste";
    }

    return legal.includes("pass") ? "pass" : null;
  }
}
