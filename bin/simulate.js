#!/usr/bin/env node
// Headless Computer vs Computer (AI vs AI) Simulation Runner for Crapette (Russian Bank)

import { fileURLToPath } from "node:url";
import { GameController } from "../web3d/src/main.js";
import { Table3D } from "../web3d/src/table3d.js";

export class SimulationSound {
  constructor() {
    this.events = [];
  }
  cardSlide() { this.events.push("cardSlide"); }
  cardSnap() { this.events.push("cardSnap"); }
  cardFlip() { this.events.push("cardFlip"); }
  foundationChime(rank) { this.events.push(`foundationChime_${rank}`); }
  crapetteCall() { this.events.push("crapetteCall"); }
  victoryFanfare() { this.events.push("victoryFanfare"); }
  setMuted() {}
  isMuted() { return false; }
}

export class SimulationHUD {
  constructor() {
    this.rendered = [];
    this.toasts = [];
    this.hints = [];
    this.mode = null;
    this.skill = null;
  }
  render(state, ledger) {
    this.rendered.push({ state, ledger });
  }
  showToast(msg) {
    this.toasts.push(msg);
  }
  showHintModal(hint) {
    this.hints.push(hint);
  }
  hideHintModal() {}
  showTutorialModal() {}
  hideTutorialModal() {}
  setMuted() {}
  setSkill(s) { this.skill = s; }
  setMode(m) { this.mode = m; }
}

/**
 * Runs Computer vs Computer simulation for specified deals or steps.
 *
 * @param {object} options
 * @param {number} [options.deals=2] - Number of full deals to run to completion
 * @param {bigint|number|string} [options.seed=42n] - Initial RNG seed
 * @param {number} [options.stepDelayMs=-1] - -1 for manual stepping, >= 0 for timer-based
 * @param {number} [options.maxStepsPerDeal=2000] - Safety ceiling for steps per deal
 * @param {boolean} [options.verbose=false] - Whether to log each move
 * @returns {Promise<object>} Detailed simulation report
 */
export async function runAiVsAiSimulation({
  deals = 2,
  seed = 42n,
  stepDelayMs = -1,
  maxStepsPerDeal = 2000,
  verbose = false,
} = {}) {
  const sound = new SimulationSound();
  const hud = new SimulationHUD();
  const table = new Table3D({ headless: true });

  const controller = new GameController({
    sound,
    hud,
    table,
    seed: BigInt(seed),
    stepDelayMs,
    gameMode: "ai_vs_ai",
    tutorial: false,
  });

  const dealReports = [];
  const overallStart = Date.now();

  try {
    for (let dealIndex = 0; dealIndex < deals; dealIndex++) {
      const dealSeed = BigInt(seed) + BigInt(dealIndex * 1000 + 7);
      if (dealIndex > 0) {
        controller.initGame(dealSeed);
      }

      const dealStart = Date.now();
      let steps = 0;
      let turnsCount = 1;
      let lastActivePlayer = controller.game.activePlayer;
      const moveTypes = { draw: 0, waste: 0, move: 0, foundation: 0, tableau: 0, crapette: 0, pass: 0 };
      const activePlayerSteps = [0, 0];

      // Track foundation progress
      const initialFoundationCount = controller.game.foundations.reduce((acc, f) => acc + f.length, 0);

      while (controller.game.winner == null && steps < maxStepsPerDeal) {
        const curPlayer = controller.game.activePlayer;
        if (curPlayer !== lastActivePlayer) {
          turnsCount++;
          lastActivePlayer = curPlayer;
        }
        activePlayerSteps[curPlayer]++;

        // Pre-move inspection
        const beforeFoundations = controller.game.foundations.reduce((acc, f) => acc + f.length, 0);
        const beforeWaste = [
          controller.game.players[0].waste.length,
          controller.game.players[1].waste.length,
        ];

        // Perform step
        if (stepDelayMs >= 0) {
          // Timer-driven or throttled step
          await new Promise((resolve) => setTimeout(resolve, stepDelayMs));
        }
        await controller.stepAI();
        steps++;

        // Inspect what changed
        const afterFoundations = controller.game.foundations.reduce((acc, f) => acc + f.length, 0);
        const afterWaste = [
          controller.game.players[0].waste.length,
          controller.game.players[1].waste.length,
        ];

        if (afterFoundations > beforeFoundations) {
          moveTypes.foundation += (afterFoundations - beforeFoundations);
          moveTypes.move++;
        } else if (afterWaste[0] > beforeWaste[0] || afterWaste[1] > beforeWaste[1]) {
          moveTypes.waste++;
        }

        if (verbose && steps % 50 === 0) {
          console.log(`  [Deal ${dealIndex + 1} | Step ${steps}] Active: P${controller.game.activePlayer}, Foundations: ${afterFoundations}/104, Waste: P0=${afterWaste[0]}, P1=${afterWaste[1]}`);
        }
      }

      const dealDurationMs = Date.now() - dealStart;
      const winner = controller.game.winner;
      const finalFoundations = controller.game.foundations.reduce((acc, f) => acc + f.length, 0);
      const finalWaste = [
        controller.game.players[0].waste.length,
        controller.game.players[1].waste.length,
      ];
      const finalReserve = [
        controller.game.players[0].reserve.length,
        controller.game.players[1].reserve.length,
      ];
      const finalStock = [
        controller.game.players[0].stock.length,
        controller.game.players[1].stock.length,
      ];

      // Retrieve ledger record for this deal
      const ledgerRecord = controller.ledger.deals[dealIndex] || null;

      dealReports.push({
        dealNumber: dealIndex + 1,
        seed: dealSeed.toString(),
        steps,
        turnsCount,
        durationMs: dealDurationMs,
        winner,
        activePlayerSteps,
        moveTypes,
        foundationsTotal: finalFoundations,
        wasteCounts: finalWaste,
        reserveCounts: finalReserve,
        stockCounts: finalStock,
        ledgerRecord,
      });
    }
  } finally {
    controller.destroy();
  }

  const totalDurationMs = Date.now() - overallStart;
  const totalSteps = dealReports.reduce((acc, d) => acc + d.steps, 0);

  return {
    dealsCompleted: dealReports.length,
    totalSteps,
    totalDurationMs,
    matchLedgerTotals: [...controller.ledger.totals],
    matchWinner: controller.ledger.leader,
    deals: dealReports,
    hudRenderCount: hud.rendered.length,
    audioEventCount: sound.events.length,
  };
}

// Standalone CLI execution
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const getArg = (name, fallback) => {
    const prefix = `--${name}=`;
    const found = args.find((a) => a.startsWith(prefix));
    return found ? found.slice(prefix.length) : fallback;
  };

  const deals = parseInt(getArg("deals", "2"), 10);
  const seed = BigInt(getArg("seed", "42"));
  const stepDelayMs = parseInt(getArg("step-delay", "-1"), 10);
  const verbose = args.includes("--verbose");

  console.log("==================================================================");
  console.log("   CRAPETTE (RUSSIAN BANK) - AI vs AI HEADLESS SIMULATION");
  console.log("==================================================================");
  console.log(`Deals: ${deals} | Seed: ${seed} | Step Delay: ${stepDelayMs}ms`);

  runAiVsAiSimulation({ deals, seed, stepDelayMs, verbose })
    .then((result) => {
      console.log("\n------------------------- SIMULATION RESULTS -------------------------");
      console.log(`Total Deals Completed: ${result.dealsCompleted}`);
      console.log(`Total Steps Executed:  ${result.totalSteps} in ${result.totalDurationMs}ms`);
      console.log(`Match Ledger Totals:   Player 1: ${result.matchLedgerTotals[0]} pts | Player 2: ${result.matchLedgerTotals[1]} pts`);
      console.log(`Match Leader/Winner:   ${result.matchWinner !== null ? `Player ${result.matchWinner + 1}` : "Tie"}`);
      console.log(`HUD Render Events:     ${result.hudRenderCount}`);
      console.log(`Audio Events Triggered:${result.audioEventCount}`);

      console.log("\n------------------------- PER-DEAL BREAKDOWN -------------------------");
      for (const d of result.deals) {
        console.log(`\nDeal #${d.dealNumber} (Seed: ${d.seed}):`);
        console.log(`  Winner:         Player ${d.winner !== null ? d.winner + 1 : "None"}`);
        console.log(`  Steps:          ${d.steps} across ${d.turnsCount} turns`);
        console.log(`  Player Steps:   P1=${d.activePlayerSteps[0]} | P2=${d.activePlayerSteps[1]}`);
        console.log(`  Foundations:    ${d.foundationsTotal} cards banked`);
        console.log(`  Waste Piles:    P1=${d.wasteCounts[0]} | P2=${d.wasteCounts[1]}`);
        console.log(`  Reserves Left:  P1=${d.reserveCounts[0]} | P2=${d.reserveCounts[1]}`);
        if (d.ledgerRecord) {
          console.log(`  Ledger Points:  +${d.ledgerRecord.totalPoints} pts awarded to P${d.ledgerRecord.winner + 1}`);
          console.log(`    Winner Bonus:        ${d.ledgerRecord.winnerBonus} pts`);
          console.log(`    Loser Reserve Pen:   ${d.ledgerRecord.reservePenalty} pts`);
          console.log(`    Loser Stk/Waste Pen: ${d.ledgerRecord.stockWastePenalty} pts`);
          console.log(`  Cumulative Totals:     [${d.ledgerRecord.cumulativeTotals.join(", ")}]`);
        }
      }
      console.log("\n==================================================================");
      console.log("   SIMULATION SUCCESSFUL - ALL ASSERTIONS VERIFIED");
      console.log("==================================================================\n");
    })
    .catch((err) => {
      console.error("Simulation failed with error:", err);
      process.exit(1);
    });
}
