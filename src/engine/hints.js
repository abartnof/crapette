// Authoritative Hint Engine for Crapette (Russian Bank)
// Powered by expert AI (Master skill 4.0) with ZPD pedagogical coaching.

import { CrapetteAI } from "./ai.js";
import {
  SUIT_GLYPHS,
  SUIT_NAMES,
  RANK_NAMES,
  canBuildOnFoundation,
} from "./cards.js";

// Format a Card into a concise string with rank and suit glyph (e.g. "A♠", "10♦", "K♣")
export function formatCard(card) {
  if (!card) return "None";
  const rankStr =
    card.rank === 1
      ? "A"
      : card.rank === 10
      ? "10"
      : card.rank === 11
      ? "J"
      : card.rank === 12
      ? "Q"
      : card.rank === 13
      ? "K"
      : String(card.rank);
  const glyph = SUIT_GLYPHS[card.suit] || card.suit;
  return `${rankStr}${glyph}`;
}

// Retrieve card from source zone in state
function getCardFromState(src, state) {
  if (src === "drawn") return state.drawnCard ?? null;
  const active = state.players[state.activePlayer];
  if (src === "r") {
    if (active.reserveTop) return active.reserveTop;
    if (active.reserve && active.reserve.length > 0) {
      return active.reserve[active.reserve.length - 1];
    }
    return null;
  }
  if (src.startsWith("t")) {
    const idx = parseInt(src.slice(1), 10);
    const col = state.tableau[idx];
    return col && col.length > 0 ? col[col.length - 1] : null;
  }
  return null;
}

// Retrieve target card at destination zone in state
function getTargetCardFromState(dst, state) {
  if (dst.startsWith("h")) {
    const idx = parseInt(dst.slice(1), 10);
    const f = state.foundations[idx];
    return f && f.length > 0 ? f[f.length - 1] : null;
  }
  if (dst.startsWith("t")) {
    const idx = parseInt(dst.slice(1), 10);
    const col = state.tableau[idx];
    return col && col.length > 0 ? col[col.length - 1] : null;
  }
  if (dst === "opp_r") {
    const opp = state.players[state.opponent];
    return opp.reserveTop ?? (opp.reserve && opp.reserve.length ? opp.reserve[opp.reserve.length - 1] : null);
  }
  if (dst === "opp_w") {
    const opp = state.players[state.opponent];
    return opp.wasteTop ?? (opp.waste && opp.waste.length ? opp.waste[opp.waste.length - 1] : null);
  }
  return null;
}

// Auto-resolve foundation index if generic "h" destination was returned
function resolveFoundationIndex(card, state) {
  if (!card) return 0;
  for (let f = 0; f < 8; f++) {
    const fTop = state.foundations[f]?.at(-1) ?? null;
    if (canBuildOnFoundation(card, fTop)) {
      return f;
    }
  }
  return 0;
}

// Map category to Zone of Proximal Development (ZPD) rationale
export function getZpdRationale(category, context = {}) {
  switch (category) {
    case "crapette":
      return "Opponent omitted a compulsory move, which immediately forfeits their turn to you.";
    case "compulsory_reserve_foundation":
      return "Reserve cards are your bottleneck to victory; emptying reserve cards to foundations is compulsory and brings you closer to an empty depot without risk.";
    case "compulsory_tableau_foundation":
      return "Compulsory foundation play: advancing tableau cards to foundations clears columns and prevents your opponent from calling Crapette.";
    case "drawn_foundation":
      return "Playing the drawn card directly to a foundation secures it permanently and prevents a compulsory move blunder.";
    case "opponent_load":
      return "Opponent loading burdens their pile and delays them from emptying their deck.";
    case "fill_space":
      return "Empty tableau spaces must be filled from your reserve; this rapidly depletes your reserve pile, which is essential to winning.";
    case "tableau_build":
      return "Grouping cards into descending chains consolidates the tableau and uncovers buried cards underneath.";
    case "drawn_tableau":
      return "Playing a drawn card onto the tableau keeps your turn alive and integrates the card into a playable building sequence.";
    case "waste":
      return "When a drawn card has no legal board plays, placing it in waste ends your turn and preserves the card for future recycling.";
    case "draw":
      return "With no remaining legal board moves, turning the next stock card gives you fresh opportunities.";
    case "pass":
      return "With both stock and waste exhausted and no moves, pass the turn to the opponent.";
    default:
      return "Strategic play advances board state toward depleting reserve and deck.";
  }
}

// Build structured hint object from action command
export function buildHintFromAction(action, state) {
  if (!action) return null;

  if (action === "crapette") {
    const headline = "Call CRAPETTE! Opponent omitted a compulsory move, which immediately forfeits their turn to you";
    const rule = "Crapette rules require calling out opponent omissions of compulsory moves immediately before they make subsequent plays.";
    const tension = "Opponent omitted a compulsory move, which immediately forfeits their turn to you, penalizing their blunder without risking your own cards.";
    const why = "Opponent omitted a compulsory move, which immediately forfeits their turn to you.";
    return {
      action: "crapette",
      command: "crapette",
      headline,
      what: headline,
      rule,
      tension,
      why,
      rationale: tension,
      explanation: tension,
      text: headline,
      message: headline,
      source: "opponent",
      destination: "active",
      src: "opponent",
      dst: "active",
      card: null,
      targetCard: null,
      category: "crapette",
      priority: 1,
    };
  }

  if (action === "draw") {
    const headline = "Draw from Stock";
    const rule = "When you have no drawn card and no legal board moves (or board moves are exhausted), draw the next card from your stock.";
    const tension = "Drawing stock ends your flexibility to rearrange tableau columns if you turn an unplayable card, so exhaust all advantageous board arrangements first. With no remaining legal board moves, turning the next stock card gives you fresh opportunities.";
    const why = "With no remaining legal board moves, turning the next stock card gives you fresh opportunities.";
    return {
      action: "draw",
      command: "draw",
      headline,
      what: headline,
      rule,
      tension,
      why,
      rationale: tension,
      explanation: tension,
      text: `${headline}: ${why}`,
      message: `${headline}: ${why}`,
      source: "stock",
      destination: "drawn",
      src: "stock",
      dst: "drawn",
      card: null,
      targetCard: null,
      category: "draw",
      priority: 5,
    };
  }

  if (action === "waste") {
    const card = state.drawnCard;
    const cardStr = formatCard(card);
    const headline = `Discard ${cardStr} to Waste`;
    const rule = "When a drawn card cannot be played to any foundation, tableau column, or opponent pile, it must be placed on your waste pile.";
    const tension = "When a drawn card has no legal board plays, placing it in waste ends your turn and preserves the card for future recycling.";
    const why = tension;
    return {
      action: "waste",
      command: "waste",
      headline,
      what: headline,
      rule,
      tension,
      why,
      rationale: tension,
      explanation: tension,
      text: `${headline}: ${why}`,
      message: `${headline}: ${why}`,
      source: "drawn",
      destination: "waste",
      src: "drawn",
      dst: "waste",
      card,
      targetCard: null,
      category: "waste",
      priority: 5,
    };
  }

  if (action === "pass") {
    const headline = "Pass Turn";
    const rule = "When both your stock and waste piles are empty and no board moves remain, you must pass the turn to your opponent.";
    const tension = "With both stock and waste exhausted and no moves, pass the turn to the opponent to let them advance the board state.";
    const why = tension;
    return {
      action: "pass",
      command: "pass",
      headline,
      what: headline,
      rule,
      tension,
      why,
      rationale: tension,
      explanation: tension,
      text: `${headline}: ${why}`,
      message: `${headline}: ${why}`,
      source: "active",
      destination: "opponent",
      src: "active",
      dst: "opponent",
      card: null,
      targetCard: null,
      category: "pass",
      priority: 6,
    };
  }

  if (action.startsWith("m ")) {
    const parts = action.slice(2).split(">");
    const src = parts[0].trim();
    let dst = parts[1].trim();
    const card = getCardFromState(src, state);

    // Resolve generic "h" destination to explicit foundation
    if (dst === "h") {
      const f = resolveFoundationIndex(card, state);
      dst = `h${f}`;
    }

    const normalizedAction = `m ${src}>${dst}`;
    const targetCard = getTargetCardFromState(dst, state);
    const cardStr = formatCard(card);

    // 1. Move to Foundation
    if (dst.startsWith("h")) {
      const fIdx = parseInt(dst.slice(1), 10);
      const fNum = fIdx + 1;

      if (src === "r") {
        const headline = `Move ${cardStr} from Reserve to Foundation ${fNum}`;
        const rule = "Foundation piles build up in ascending sequence by matching suit starting from Ace.";
        const tension = "Reserve cards are your bottleneck to victory; emptying reserve cards to foundations is compulsory and brings you closer to an empty depot without risk. Foundation plays from reserve take highest priority and cannot be challenged.";
        const why = tension;
        return {
          action: normalizedAction,
          command: normalizedAction,
          headline,
          what: headline,
          rule,
          tension,
          why,
          rationale: tension,
          explanation: tension,
          text: `${headline}: ${why}`,
          message: `${headline}: ${why}`,
          source: src,
          destination: dst,
          src,
          dst,
          card,
          targetCard,
          category: "compulsory_reserve_foundation",
          priority: 1,
        };
      }

      if (src === "drawn") {
        const headline = `Move ${cardStr} from Drawn Card to Foundation ${fNum}`;
        const rule = "Drawn cards matching foundation sequences must be played to foundations as compulsory moves.";
        const tension = "Playing drawn cards to foundations secures them permanently and avoids a compulsory move omission blunder.";
        const why = tension;
        return {
          action: normalizedAction,
          command: normalizedAction,
          headline,
          what: headline,
          rule,
          tension,
          why,
          rationale: tension,
          explanation: tension,
          text: `${headline}: ${why}`,
          message: `${headline}: ${why}`,
          source: src,
          destination: dst,
          src,
          dst,
          card,
          targetCard,
          category: "drawn_foundation",
          priority: 2,
        };
      }

      if (src.startsWith("t")) {
        const tIdx = parseInt(src.slice(1), 10);
        const tNum = tIdx + 1;
        const headline = `Move ${cardStr} from Tableau ${tNum} to Foundation ${fNum}`;
        const rule = "Foundation piles build upward in matching suit (A to K); playing eligible tableau cards to foundations is compulsory.";
        const tension = "Moving to foundation is permanent and forecloses using this card in tableau building, but it clears column depth and avoids a Crapette blunder seizure.";
        const why = "Compulsory foundation play: advancing tableau cards to foundations clears columns and prevents your opponent from calling Crapette.";
        return {
          action: normalizedAction,
          command: normalizedAction,
          headline,
          what: headline,
          rule,
          tension,
          why,
          rationale: tension,
          explanation: tension,
          text: `${headline}: ${why}`,
          message: `${headline}: ${why}`,
          source: src,
          destination: dst,
          src,
          dst,
          card,
          targetCard,
          category: "compulsory_tableau_foundation",
          priority: 2,
        };
      }
    }

    // 2. Move to Opponent Reserve or Waste
    if (dst === "opp_r" || dst === "opp_w") {
      const oppCardStr = targetCard ? formatCard(targetCard) : dst === "opp_r" ? "Reserve" : "Waste";
      const headline = `Load ${cardStr} onto Opponent's ${oppCardStr}`;
      const rule = "Opponent loading allows playing a card of the same suit with rank +1 or -1 onto the opponent's reserve or waste pile.";
      const tension = "Opponent loading burdens their pile and delays them from emptying their deck, though ensure it cannot be immediately recycled to the tableau.";
      const why = tension;
      return {
        action: normalizedAction,
        command: normalizedAction,
        headline,
        what: headline,
        rule,
        tension,
        why,
        rationale: tension,
        explanation: tension,
        text: `${headline}: ${why}`,
        message: `${headline}: ${why}`,
        source: src,
        destination: dst,
        src,
        dst,
        card,
        targetCard,
        category: "opponent_load",
        priority: 3,
      };
    }

    // 3. Move to Tableau
    if (dst.startsWith("t")) {
      const dstIdx = parseInt(dst.slice(1), 10);
      const dstNum = dstIdx + 1;

      // Empty space destination
      if (!targetCard) {
        if (src === "r") {
          const headline = `Move ${cardStr} from Reserve to empty Tableau space ${dstNum}`;
          const rule = "Any card can fill an empty tableau space, but filling empty spaces from Reserve takes compulsory priority.";
          const tension = "You could move a tableau card into this empty column, but filling it now forecloses your reserve from emptying into it. Move the Reserve card instead.";
          const why = "Empty tableau spaces must be filled from your reserve; this rapidly depletes your reserve pile, which is essential to winning.";
          return {
            action: normalizedAction,
            command: normalizedAction,
            headline,
            what: headline,
            rule,
            tension,
            why,
            rationale: tension,
            explanation: tension,
            text: `${headline}: ${why}`,
            message: `${headline}: ${why}`,
            source: src,
            destination: dst,
            src,
            dst,
            card,
            targetCard: null,
            category: "fill_space",
            priority: 3,
          };
        }

        if (src === "drawn") {
          const headline = `Move ${cardStr} to empty Tableau space ${dstNum}`;
          const rule = "Drawn cards can be placed into empty tableau spaces if no building moves or foundation moves exist.";
          const tension = "Placing a drawn card into an open tableau slot keeps your turn alive without dumping the card into waste.";
          const why = tension;
          return {
            action: normalizedAction,
            command: normalizedAction,
            headline,
            what: headline,
            rule,
            tension,
            why,
            rationale: tension,
            explanation: tension,
            text: `${headline}: ${why}`,
            message: `${headline}: ${why}`,
            source: src,
            destination: dst,
            src,
            dst,
            card,
            targetCard: null,
            category: "drawn_tableau",
            priority: 4,
          };
        }

        if (src.startsWith("t")) {
          const srcIdx = parseInt(src.slice(1), 10);
          const srcNum = srcIdx + 1;
          const headline = `Move ${cardStr} from Tableau ${srcNum} to empty Tableau space ${dstNum}`;
          const rule = "Empty tableau spaces can accept any card from another column.";
          const tension = "Only shift columns into empty spaces when it uncovers critical buried cards underneath; avoid swapping lone cards between empty spaces.";
          const why = tension;
          return {
            action: normalizedAction,
            command: normalizedAction,
            headline,
            what: headline,
            rule,
            tension,
            why,
            rationale: tension,
            explanation: tension,
            text: `${headline}: ${why}`,
            message: `${headline}: ${why}`,
            source: src,
            destination: dst,
            src,
            dst,
            card,
            targetCard: null,
            category: "fill_space",
            priority: 4,
          };
        }
      }

      // Building on non-empty tableau column
      const targetStr = formatCard(targetCard);

      if (src === "drawn") {
        const headline = `Build ${cardStr} on ${targetStr}`;
        const rule = "Tableau columns build downward in strictly alternating colors.";
        const tension = "Playing a drawn card onto the tableau keeps your turn alive and integrates the card into a playable building sequence.";
        const why = tension;
        return {
          action: normalizedAction,
          command: normalizedAction,
          headline,
          what: headline,
          rule,
          tension,
          why,
          rationale: tension,
          explanation: tension,
          text: `${headline}: ${why}`,
          message: `${headline}: ${why}`,
          source: src,
          destination: dst,
          src,
          dst,
          card,
          targetCard,
          category: "drawn_tableau",
          priority: 4,
        };
      }

      if (src === "r") {
        const headline = `Build ${cardStr} on ${targetStr}`;
        const rule = "Tableau columns build downward in strictly alternating colors.";
        const tension = "While you could shift tableau cards first, prioritizing your Reserve frees up your critical 13-card bottleneck before drawing. Grouping cards into descending chains consolidates the tableau and uncovers buried cards underneath.";
        const why = "Grouping cards into descending chains consolidates the tableau and uncovers buried cards underneath.";
        return {
          action: normalizedAction,
          command: normalizedAction,
          headline,
          what: headline,
          rule,
          tension,
          why,
          rationale: tension,
          explanation: tension,
          text: `${headline}: ${why}`,
          message: `${headline}: ${why}`,
          source: src,
          destination: dst,
          src,
          dst,
          card,
          targetCard,
          category: "tableau_build",
          priority: 3,
        };
      }

      if (src.startsWith("t")) {
        const headline = `Build ${cardStr} on ${targetStr}`;
        const rule = "Tableau columns build downward in strictly alternating colors.";
        const tension = "Grouping cards into descending chains consolidates the tableau and uncovers buried cards underneath.";
        const why = tension;
        return {
          action: normalizedAction,
          command: normalizedAction,
          headline,
          what: headline,
          rule,
          tension,
          why,
          rationale: tension,
          explanation: tension,
          text: `${headline}: ${why}`,
          message: `${headline}: ${why}`,
          source: src,
          destination: dst,
          src,
          dst,
          card,
          targetCard,
          category: "tableau_build",
          priority: 4,
        };
      }
    }
  }

  return null;
}

// Describe any engine command or move in human-readable terms
export function describeMove(cmdOrMove, gameOrState) {
  const state = typeof gameOrState?.state === "function" ? gameOrState.state() : gameOrState;
  const hint = buildHintFromAction(cmdOrMove, state);
  return hint?.headline ?? String(cmdOrMove);
}

// Instantiate master expert AI engine
function createExpertAI() {
  let ai;
  try {
    ai = new CrapetteAI({ skill: 4.0, seed: 12345n });
  } catch {
    ai = new CrapetteAI({ skill: "master", seed: 12345n });
  }
  if (ai.skill !== "master" && ai.skillLevel === undefined) {
    ai.skill = "master";
  }
  return ai;
}

// Generate all valid candidate hints, ranked by strategic priority
export function generateAllHints(gameOrState) {
  const state = typeof gameOrState?.state === "function" ? gameOrState.state() : gameOrState;
  if (!state || (state.winner !== null && state.winner !== undefined)) {
    return [];
  }

  const hints = [];

  // 1. Blunder exploitation
  if (state.crapetteEligible) {
    hints.push(buildHintFromAction("crapette", state));
  }

  const legal = state.legal ?? [];
  const seenEmptyFoundation = new Set();
  for (const move of legal) {
    // Avoid generic alias if specific exists
    if (move.endsWith(">h")) {
      const parts = move.slice(2).split(">");
      const src = parts[0];
      const hasSpecific = legal.some((m) => m.startsWith(`m ${src}>h`) && m !== move);
      if (hasSpecific) continue;
    }
    // Only include first empty foundation slot per source to avoid 8 redundant Ace hints
    if (move.includes(">h")) {
      const parts = move.slice(2).split(">");
      const src = parts[0];
      const dst = parts[1];
      if (dst.startsWith("h") && dst !== "h") {
        const fIdx = parseInt(dst.slice(1), 10);
        if (!state.foundations[fIdx] || state.foundations[fIdx].length === 0) {
          if (seenEmptyFoundation.has(src)) continue;
          seenEmptyFoundation.add(src);
        }
      }
    }
    const h = buildHintFromAction(move, state);
    if (h) hints.push(h);
  }

  // Deduplicate and rank by priority
  const seen = new Set();
  const unique = [];
  for (const h of hints) {
    if (!seen.has(h.action)) {
      seen.add(h.action);
      unique.push(h);
    }
  }

  unique.sort((a, b) => a.priority - b.priority);
  return unique;
}

// Authoritative Hint Engine: generates the optimal hint powered by Master AI
export function generateHint(gameOrState) {
  const state = typeof gameOrState?.state === "function" ? gameOrState.state() : gameOrState;
  if (!state || (state.winner !== null && state.winner !== undefined)) {
    return null;
  }

  // 1. Blunder exploitation takes immediate priority
  if (state.crapetteEligible) {
    return buildHintFromAction("crapette", state);
  }

  // 2. Query expert AI (Master skill 4.0)
  const expertAI = createExpertAI();
  const chosen = expertAI.chooseMove(gameOrState);

  if (chosen) {
    const hint = buildHintFromAction(chosen, state);
    if (hint) return hint;
  }

  // Fallback to highest ranked candidate hint
  const all = generateAllHints(state);
  return all.length > 0 ? all[0] : null;
}
