// Application orchestrator for Crapette (Russian Bank) 3D

import { CrapetteGame } from "../../src/engine/game.js";
import { CrapetteAI } from "../../src/engine/ai.js";
import { calculateDealScore, MatchLedger } from "../../src/engine/scoring.js";
import { SoundSynthesizer } from "./audio.js";
import { Table3D } from "./table3d.js";
import { HUD } from "./hud.js";
import { InteractionController } from "./interaction.js";

export class GameController {
  constructor({
    sound,
    hud,
    table,
    interaction,
    seed = 12345n,
    skill = "master",
    mode = "competitive",
    gameMode = "human_vs_ai",
    stepDelayMs = 500,
  } = {}) {
    this.seed = BigInt(seed);
    this.skill = skill;
    this.mode = mode;
    this.gameMode = gameMode;
    this.stepDelayMs = stepDelayMs;

    this.sound = sound;
    this.hud = hud;
    this.table = table;
    this.interaction = interaction;

    this.ledger = new MatchLedger();
    this.game = null;
    this.ai = null;
    this.aiTimer = null;
    this.isAiRunning = false;

    this.initGame();
  }

  setGameMode(mode) {
    this.gameMode = mode;
    if (this.hud && typeof this.hud.setMode === "function") {
      this.hud.setMode(mode);
    }
    const modeLabel = mode === "ai_vs_ai" ? "AI vs AI (Watching)" : "Vs Computer (Play)";
    if (this.hud && typeof this.hud.showToast === "function") {
      this.hud.showToast(`Mode: ${modeLabel}`);
    }
    this._syncAll();
    this._checkTurn();
  }

  toggleGameMode() {
    const next = this.gameMode === "ai_vs_ai" ? "human_vs_ai" : "ai_vs_ai";
    this.setGameMode(next);
  }

  initGame(dealSeed = null) {
    if (dealSeed !== null) {
      this.seed = BigInt(dealSeed);
    } else if (this.seed === undefined) {
      this.seed = BigInt(Math.floor(Math.random() * 1000000) + 1);
    }

    this.game = new CrapetteGame({ seed: this.seed, mode: this.mode });
    this.ai = new CrapetteAI({ skill: this.skill, seed: this.seed });

    this._syncAll();
    this._checkTurn();
  }

  _syncAll() {
    const state = this.game.state();
    if (this.table && typeof this.table.sync === "function") {
      this.table.sync(state);
    }
    if (this.hud && typeof this.hud.render === "function") {
      this.hud.render(state, this.ledger);
    }
  }

  _checkTurn() {
    if (this.game.winner != null) {
      this._handleDealVictory();
      return;
    }

    if (this.gameMode === "ai_vs_ai") {
      if (!this.isAiRunning && this.stepDelayMs >= 0) {
        this._scheduleAiTurn();
      }
      return;
    }

    if (this.game.activePlayer === 1 && !this.isAiRunning && this.stepDelayMs >= 0) {
      this._scheduleAiTurn();
    }
  }

  _handleDealVictory() {
    const state = this.game.state();
    if (this.sound && typeof this.sound.victoryFanfare === "function") {
      this.sound.victoryFanfare();
    }

    try {
      const dealScore = calculateDealScore(this.game);
      this.ledger.recordDeal(dealScore);
      if (this.hud) {
        this.hud.render(state, this.ledger);
        const winnerName = this.gameMode === "ai_vs_ai"
          ? (dealScore.winner === 0 ? "Player 1 (Crimson)" : "Player 2 (Navy)")
          : (dealScore.winner === 0 ? "You" : "Opponent");
        this.hud.showToast(`Deal Won by ${winnerName}! (+${dealScore.totalPoints} pts)`);
      }
    } catch (e) {
      // Score calculation fallback
    }
  }

  handleDraw() {
    if (this.game.winner != null) return;
    const res = this.game.send("draw");
    if (res.ok) {
      if (this.sound) {
        this.sound.cardSlide();
      }
      this._syncAll();
      this._checkTurn();
    } else if (res.error && this.hud) {
      this.hud.showToast(res.error);
    }
  }

  handleWaste() {
    if (this.game.winner != null) return;
    const res = this.game.send("waste");
    if (res.ok) {
      if (this.sound) {
        this.sound.cardSlide();
        this.sound.cardSnap();
      }
      this._syncAll();
      this._checkTurn();
    } else if (res.error && this.hud) {
      this.hud.showToast(res.error);
    }
  }

  handleMove(src, dst) {
    if (this.game.winner != null) return;
    const res = this.game.send(`m ${src}>${dst}`);
    if (res.ok) {
      this._playMoveAudio(src, dst);
      this._syncAll();
      this._checkTurn();
    } else if (res.error && this.hud) {
      this.hud.showToast(res.error);
    }
  }

  _playMoveAudio(src, dst) {
    if (!this.sound) return;

    if (dst === "h" || dst.startsWith("h")) {
      // Find foundation card rank for chime
      let rank = 1;
      let fIndex = dst === "h" ? 0 : parseInt(dst.slice(1), 10);
      const fPile = this.game.foundations[fIndex];
      if (fPile && fPile.length > 0) {
        rank = fPile[fPile.length - 1].rank;
      }
      this.sound.foundationChime(rank);
    } else {
      this.sound.cardSlide();
      this.sound.cardSnap();
    }
  }

  handleCrapette() {
    if (this.game.winner != null) return;
    const res = this.game.send("crapette");
    if (res.ok) {
      if (this.sound) {
        this.sound.crapetteCall();
      }
      if (this.hud) {
        this.hud.showToast("CRAPETTE! Blunder claimed — turn forfeited!");
      }
      this._syncAll();
      this._checkTurn();
    } else {
      if (this.hud) {
        this.hud.showToast("No Crapette blunder was committed!");
      }
    }
  }

  handleUndo() {
    if (this.game.winner != null) return;
    const res = this.game.send("undo");
    if (res.ok) {
      if (this.sound) {
        this.sound.cardFlip();
      }
      this._syncAll();
      this._checkTurn();
    } else if (res.error && this.hud) {
      this.hud.showToast(res.error);
    }
  }

  _scheduleAiTurn() {
    if (this.aiTimer) {
      clearTimeout(this.aiTimer);
    }
    const delay = this.gameMode === "ai_vs_ai" ? Math.min(this.stepDelayMs, 250) : this.stepDelayMs;
    this.aiTimer = setTimeout(() => {
      this.stepAI();
    }, delay);
  }

  async stepAI() {
    if (this.game.winner != null) return;
    if (this.gameMode !== "ai_vs_ai" && this.game.activePlayer !== 1) return;
    this.isAiRunning = true;

    try {
      const move = this.ai.chooseMove(this.game);
      if (!move) {
        this.isAiRunning = false;
        return;
      }

      // If AI made a blunder in novice mode and it's human vs AI, pause slightly to let human challenge
      if (this.gameMode !== "ai_vs_ai" && this.game.crapetteBlunder && this.skill === "novice" && this.stepDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, Math.max(600, this.stepDelayMs)));
        if (this.game.activePlayer !== 1) {
          // Human claimed crapette during the pause!
          this.isAiRunning = false;
          return;
        }
      }

      if (move === "crapette") {
        if (this.sound) this.sound.crapetteCall();
        const callerName = this.gameMode === "ai_vs_ai"
          ? (this.game.activePlayer === 0 ? "Player 1" : "Player 2")
          : "Opponent";
        if (this.hud) this.hud.showToast(`${callerName} calls CRAPETTE!`);
        this.game.send("crapette");
      } else if (move === "draw") {
        this.game.send("draw");
        if (this.sound) this.sound.cardSlide();
      } else if (move === "waste") {
        this.game.send("waste");
        if (this.sound) {
          this.sound.cardSlide();
          this.sound.cardSnap();
        }
      } else if (move === "pass") {
        this.game.send("pass");
        if (this.hud) this.hud.showToast("Turn passed.");
      } else if (move.startsWith("m ")) {
        const parts = move.slice(2).split(">");
        this.game.send(move);
        this._playMoveAudio(parts[0], parts[1]);
      }

      this._syncAll();

      if (this.game.winner === null) {
        if (this.gameMode === "ai_vs_ai" || this.game.activePlayer === 1) {
          // Continue AI turns
          this._scheduleAiTurn();
        }
      } else {
        this._handleDealVictory();
      }
    } finally {
      this.isAiRunning = false;
    }
  }
}

// Browser bootstrap entry
export function init() {
  if (typeof document === "undefined") return null;

  const canvas = document.getElementById("stage");
  const hudContainer = document.getElementById("hud") || document.body;

  const sound = new SoundSynthesizer();
  sound.attachGestureUnlock(window);

  const table = new Table3D({ canvas });

  let controller = null;

  const hud = new HUD({
    container: hudContainer,
    document,
    onDraw: () => controller?.handleDraw(),
    onWaste: () => controller?.handleWaste(),
    onCrapette: () => controller?.handleCrapette(),
    onUndo: () => controller?.handleUndo(),
    onNewGame: () => controller?.initGame(),
    onToggleSound: () => {
      const muted = !sound.isMuted();
      sound.setMuted(muted);
      hud.setMuted(muted);
    },
    onToggleSkill: () => {
      const newSkill = controller.skill === "master" ? "novice" : "master";
      controller.skill = newSkill;
      controller.ai.skill = newSkill;
      hud.setSkill(newSkill);
      hud.showToast(`AI skill set to ${newSkill === "master" ? "Master" : "Novice"}`);
    },
    onToggleMode: () => {
      controller?.toggleGameMode();
    },
  });

  const interaction = new InteractionController({
    table,
    canvas,
    getGameState: () => controller?.game?.state(),
    onMove: (src, dst) => controller?.handleMove(src, dst),
    onDraw: () => controller?.handleDraw(),
    onWaste: () => controller?.handleWaste(),
  });

  controller = new GameController({
    sound,
    hud,
    table,
    interaction,
    stepDelayMs: 500,
  });

  return controller;
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init());
  } else {
    init();
  }
}
