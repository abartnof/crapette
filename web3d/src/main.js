// Application orchestrator for Crapette (Russian Bank) 3D

import { CrapetteGame } from "../../src/engine/game.js";
import { CrapetteAI, AI_SKILLS } from "../../src/engine/ai.js";
import { generateHint } from "../../src/engine/hints.js";
import { calculateDealScore, MatchLedger } from "../../src/engine/scoring.js";
import {
  pageDue,
  getTutorialPage,
  getTutorialSettings,
  saveTutorialSettings,
  markPageSeen,
  resetTutorialSettings,
} from "./tutorial.js";
import { SoundSynthesizer } from "./audio.js";
import { Table3D } from "./table3d.js";
import { HUD } from "./hud.js";
import { InteractionController } from "./interaction.js";
import { loadTextures } from "./art.js";

export class GameController {
  constructor({
    sound,
    hud,
    table,
    interaction,
    seed = 12345n,
    skill = "4.0",
    mode = "competitive",
    gameMode = "human_vs_ai",
    stepDelayMs = 500,
    tutorial = true,
    hints = true,
    store = typeof window !== "undefined" ? window.localStorage : null,
  } = {}) {
    this.seed = BigInt(seed);
    this.skill = skill;
    this.mode = mode;
    this.gameMode = gameMode;
    this.stepDelayMs = stepDelayMs;
    this.tutorialEnabled = tutorial;
    this.hintsEnabled = hints;
    this.store = store;

    this.sound = sound;
    this.hud = hud;
    this.table = table;
    this.interaction = interaction;

    const tutSettings = getTutorialSettings(this.store);
    this.tutorialSeen = Array.isArray(tutSettings?.seen) ? [...tutSettings.seen] : [];
    if (tutSettings && tutSettings.enabled !== undefined && tutorial === undefined) {
      this.tutorialEnabled = tutSettings.enabled;
    }

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
    if (dealSeed !== null && dealSeed !== undefined) {
      this.seed = BigInt(dealSeed);
    } else if (this.seed === undefined) {
      this.seed = BigInt(Math.floor(Math.random() * 1000000) + 1);
    }

    this.game = new CrapetteGame({ seed: this.seed, mode: this.mode });
    this.ai = new CrapetteAI({ skill: this.skill, seed: this.seed });

    this._syncAll();
    this.checkTutorial();
    this._checkTurn();
  }

  startNewGame({ mode, rules, skill, tutorial, hints, seed } = {}) {
    if (mode !== undefined) this.gameMode = mode;
    if (rules !== undefined) this.mode = rules;
    if (skill !== undefined) this.skill = skill;
    if (tutorial !== undefined) this.tutorialEnabled = Boolean(tutorial);
    if (hints !== undefined) this.hintsEnabled = Boolean(hints);

    if (this.hud) {
      if (typeof this.hud.setMode === "function") this.hud.setMode(this.gameMode);
      if (typeof this.hud.setSkill === "function") this.hud.setSkill(this.skill);
    }

    const dealSeed = seed ? BigInt(seed) : BigInt(Math.floor(Math.random() * 1000000) + 1);
    this.initGame(dealSeed);
  }

  changeFelt(felt) {
    if (this.table) {
      if (typeof this.table.setSurface === "function") {
        this.table.setSurface(felt);
      } else if (typeof this.table.setFelt === "function") {
        this.table.setFelt(felt);
      }
    }
  }

  requestHint() {
    if (this.game.winner != null) return;
    const hint = generateHint(this.game);
    if (!hint) {
      if (this.hud && typeof this.hud.showToast === "function") {
        this.hud.showToast("No hints available for this position.");
      }
      return;
    }
    if (this.hud && typeof this.hud.showHintModal === "function") {
      this.hud.showHintModal(hint);
    }
    if (this.table && typeof this.table.highlightSlots === "function") {
      const targets = [hint.source, hint.destination].filter(Boolean);
      this.table.highlightSlots(targets);
    }
  }

  checkTutorial() {
    if (!this.tutorialEnabled || this.gameMode === "ai_vs_ai" || this.game?.winner != null) return;
    const state = this.game.state();
    const dueKey = pageDue(state, this.tutorialSeen, { enabled: this.tutorialEnabled, isWatching: this.gameMode === "ai_vs_ai" });
    if (dueKey) {
      const page = getTutorialPage(dueKey);
      if (page && this.hud && typeof this.hud.showTutorialModal === "function") {
        this.hud.showTutorialModal(page);
      }
    }
  }

  handleTutorialDismiss({ pageKey, disableAll } = {}) {
    if (pageKey) {
      if (!this.tutorialSeen.includes(pageKey)) {
        this.tutorialSeen.push(pageKey);
      }
      markPageSeen(this.store, pageKey);
    }
    if (disableAll) {
      this.tutorialEnabled = false;
      saveTutorialSettings(this.store, { enabled: false, seen: this.tutorialSeen });
    }
  }

  resetTutorials() {
    this.tutorialSeen = [];
    this.tutorialEnabled = true;
    resetTutorialSettings(this.store);
    this.checkTutorial();
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

    this.checkTutorial();

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

  if (typeof ART !== "undefined" && ART) {
    loadTextures(ART, { pixelRatio: globalThis.devicePixelRatio || 1 })
      .then((textures) => {
        if (table && typeof table.setTextures === "function") {
          table.setTextures(textures);
        }
      })
      .catch((err) => {
        console.warn("Unable to load embedded art textures:", err);
      });
  }

  let controller = null;

  const hud = new HUD({
    container: hudContainer,
    document,
    onDraw: () => controller?.handleDraw(),
    onWaste: () => controller?.handleWaste(),
    onCrapette: () => controller?.handleCrapette(),
    onUndo: () => controller?.handleUndo(),
    onNewGame: () => controller?.hud.toggleNewGameModal(true),
    onStartNewGame: (cfg) => controller?.startNewGame(cfg),
    onHint: () => controller?.requestHint(),
    onOpenSettings: () => controller?.hud.toggleSettingsModal(true),
    onChangeFelt: (felt) => controller?.changeFelt(felt),
    onResetTutorial: () => controller?.resetTutorials(),
    onDismissTutorial: (data) => controller?.handleTutorialDismiss(data),
    onToggleSound: () => {
      const muted = !sound.isMuted();
      sound.setMuted(muted);
      hud.setMuted(muted);
    },
    onVolumeChange: (vol) => {
      if (typeof sound.setMasterVolume === "function") sound.setMasterVolume(vol);
    },
    onToggleSkill: () => {
      const cur = parseFloat(controller.skill) || 4.0;
      const next = cur <= 1.0 ? 4.0 : cur - 0.5;
      controller.skill = next.toFixed(1);
      controller.ai.skill = next.toFixed(1);
      hud.setSkill(next.toFixed(1));
      hud.showToast(`AI skill level: ${next.toFixed(1)}`);
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
