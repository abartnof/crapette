// Procedural Web Audio API sound synthesizer for Crapette.
// Provides tactile, harmonic auditory feedback: felt slide, card snap, card flip,
// ascending pentatonic foundation chimes with King flourish, dramatic Crapette blunder
// buzzer + gong, and triumphant victory fanfare.
//
// Operates cleanly in modern browsers and degrades gracefully in Node / test environments.

const SEMITONES = [0, 2, 4, 7, 9];

// 13 pentatonic frequencies starting from C4 (261.63 Hz) for card ranks 1 (Ace) to 13 (King)
export const PENTATONIC_FREQUENCIES = Object.freeze(
  Array.from({ length: 13 }, (_, i) => {
    const octave = Math.floor(i / 5);
    const step = i % 5;
    const semitone = octave * 12 + SEMITONES[step];
    return +(261.6256 * Math.pow(2, semitone / 12)).toFixed(2);
  })
);

export class SoundSynthesizer {
  constructor(options = {}) {
    this._volume = 1.0;
    this._muted = false;
    this._ctx = null;
    this._masterGain = null;
    this._noiseBuffer = null;

    // Determine AudioContext
    let ContextClass = null;
    if (options.context) {
      this._ctx = options.context;
    } else if (typeof AudioContext !== "undefined") {
      ContextClass = AudioContext;
    } else if (typeof webkitAudioContext !== "undefined") {
      // Safari compatibility
      ContextClass = webkitAudioContext;
    }

    if (!this._ctx && ContextClass) {
      try {
        this._ctx = new ContextClass();
      } catch {
        this._ctx = null;
      }
    }

    if (this._ctx) {
      this._initMasterGain();
    }
  }

  get isSupported() {
    return this._ctx !== null;
  }

  get context() {
    return this._ctx;
  }

  _initMasterGain() {
    if (!this._ctx) return;
    try {
      this._masterGain = this._ctx.createGain();
      this._masterGain.gain.setValueAtTime(
        this._muted ? 0 : this._volume,
        this._ctx.currentTime
      );
      this._masterGain.connect(this._ctx.destination);
    } catch {
      // In case destination or node creation fails in partial mock
    }
  }

  getVolume() {
    return this._volume;
  }

  setVolume(vol) {
    this._volume = Math.max(0, Math.min(1, Number(vol) || 0));
    if (this._masterGain && this._ctx) {
      try {
        this._masterGain.gain.setValueAtTime(
          this._muted ? 0 : this._volume,
          this._ctx.currentTime
        );
      } catch {}
    }
    return this._volume;
  }

  isMuted() {
    return this._muted;
  }

  setMuted(muted) {
    this._muted = Boolean(muted);
    if (this._masterGain && this._ctx) {
      try {
        this._masterGain.gain.setValueAtTime(
          this._muted ? 0 : this._volume,
          this._ctx.currentTime
        );
      } catch {}
    }
    return this._muted;
  }

  async unlock() {
    if (!this._ctx) return;
    if (this._ctx.state === "suspended" && typeof this._ctx.resume === "function") {
      try {
        await this._ctx.resume();
      } catch {}
    }
  }

  attachGestureUnlock(target = globalThis.window || globalThis.document) {
    if (!target || !this._ctx) return;
    if (this._ctx.state === "running") return;

    const gestures = ["pointerdown", "keydown", "touchstart"];
    const handleGesture = async () => {
      await this.unlock();
      if (this._ctx && this._ctx.state === "running") {
        for (const g of gestures) {
          if (typeof target.removeEventListener === "function") {
            target.removeEventListener(g, handleGesture);
          }
        }
      }
    };

    for (const g of gestures) {
      if (typeof target.addEventListener === "function") {
        target.addEventListener(g, handleGesture, { passive: true });
      }
    }
  }

  _ensureActive() {
    if (!this._ctx) return false;
    if (this._muted) return false;
    if (this._ctx.state === "suspended" && typeof this._ctx.resume === "function") {
      this._ctx.resume().catch(() => {});
    }
    return true;
  }

  _getOrCreateNoiseBuffer() {
    if (!this._ctx || !this._ctx.createBuffer) return null;
    if (this._noiseBuffer) return this._noiseBuffer;

    try {
      const sampleRate = this._ctx.sampleRate || 44100;
      const duration = 0.2; // 200ms
      const buffer = this._ctx.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        // Soft white noise
        data[i] = Math.random() * 2 - 1;
      }
      this._noiseBuffer = buffer;
      return buffer;
    } catch {
      return null;
    }
  }

  /**
   * Subtle low-pass filtered noise / sweep for card movement across felt.
   */
  cardSlide() {
    if (!this._ensureActive()) return null;
    const ctx = this._ctx;
    const t = ctx.currentTime;

    const noiseBuffer = this._getOrCreateNoiseBuffer();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1100, t);
    filter.frequency.exponentialRampToValueAtTime(350, t + 0.12);
    filter.Q.setValueAtTime(1.2, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    if (noiseBuffer && ctx.createBufferSource) {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this._masterGain || ctx.destination);
      source.start(t);
      source.stop(t + 0.12);
      return { source, gain, filter };
    } else {
      // Fallback sweep with oscillator if bufferSource is unavailable
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(160, t);
      osc.frequency.exponentialRampToValueAtTime(70, t + 0.12);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this._masterGain || ctx.destination);
      osc.start(t);
      osc.stop(t + 0.12);
      return { osc, gain, filter };
    }
  }

  /**
   * Sharp tactile transient click/snap when a card lands on a pile or tableau.
   */
  cardSnap() {
    if (!this._ensureActive()) return null;
    const ctx = this._ctx;
    const t = ctx.currentTime;

    // 1. Thump: rapid pitch-dropping body tone
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(380, t);
    osc.frequency.exponentialRampToValueAtTime(75, t + 0.045);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.35, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

    osc.connect(oscGain);
    oscGain.connect(this._masterGain || ctx.destination);
    osc.start(t);
    osc.stop(t + 0.045);

    // 2. High transient click / snap
    const clickOsc = ctx.createOscillator();
    clickOsc.type = "sine";
    clickOsc.frequency.setValueAtTime(1600, t);
    clickOsc.frequency.exponentialRampToValueAtTime(300, t + 0.015);

    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.2, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.015);

    clickOsc.connect(clickGain);
    clickGain.connect(this._masterGain || ctx.destination);
    clickOsc.start(t);
    clickOsc.stop(t + 0.015);

    return { osc, oscGain, clickOsc, clickGain };
  }

  /**
   * Quick two-tone flutter when a card turns face up.
   */
  cardFlip() {
    if (!this._ensureActive()) return null;
    const ctx = this._ctx;
    const t = ctx.currentTime;

    // First flutter tone (shorter, rising)
    const osc1 = ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(460, t);
    osc1.frequency.linearRampToValueAtTime(540, t + 0.035);

    const gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(0.18, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

    osc1.connect(gain1);
    gain1.connect(this._masterGain || ctx.destination);
    osc1.start(t);
    osc1.stop(t + 0.035);

    // Second flutter tone (crisper, higher)
    const t2 = t + 0.035;
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(680, t2);
    osc2.frequency.linearRampToValueAtTime(820, t2 + 0.045);

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.22, t2);
    gain2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.045);

    osc2.connect(gain2);
    gain2.connect(this._masterGain || ctx.destination);
    osc2.start(t2);
    osc2.stop(t2 + 0.045);

    return { osc1, osc2 };
  }

  /**
   * Musical pentatonic chime that ascends in frequency based on card rank (1 to 13, Ace to King).
   * Ace starts with warm bell (C4 ≈ 261.6 Hz), increasing up to King (with sparkling flourish!).
   */
  foundationChime(rank = 1) {
    if (!this._ensureActive()) return null;
    const ctx = this._ctx;
    const t = ctx.currentTime;

    const clampedRank = Math.max(1, Math.min(13, Math.round(rank)));
    const fundamental = PENTATONIC_FREQUENCIES[clampedRank - 1] || 261.63;

    // 1. Fundamental warm bell tone
    const oscMain = ctx.createOscillator();
    oscMain.type = "sine";
    oscMain.frequency.setValueAtTime(fundamental, t);

    const gainMain = ctx.createGain();
    gainMain.gain.setValueAtTime(0.28, t);
    gainMain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

    oscMain.connect(gainMain);
    gainMain.connect(this._masterGain || ctx.destination);
    oscMain.start(t);
    oscMain.stop(t + 0.55);

    // 2. Harmonic overtone (2.0x or 2.76x bell inharmonic)
    const oscHarm = ctx.createOscillator();
    oscHarm.type = "sine";
    oscHarm.frequency.setValueAtTime(+(fundamental * 2.756).toFixed(2), t);

    const gainHarm = ctx.createGain();
    gainHarm.gain.setValueAtTime(0.10, t);
    gainHarm.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    oscHarm.connect(gainHarm);
    gainHarm.connect(this._masterGain || ctx.destination);
    oscHarm.start(t);
    oscHarm.stop(t + 0.25);

    // King special flourish: sparkling ascending arpeggio on completion
    const flourishNodes = [];
    if (clampedRank === 13) {
      // Pentatonic sparkle arpeggio: C6, E6, G6, C7, E7
      const sparkleNotes = [1046.50, 1318.51, 1567.98, 2093.00, 2637.02];
      sparkleNotes.forEach((freq, idx) => {
        const noteTime = t + 0.08 * (idx + 1);
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, noteTime);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.18, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.35);

        osc.connect(gain);
        gain.connect(this._masterGain || ctx.destination);
        osc.start(noteTime);
        osc.stop(noteTime + 0.35);
        flourishNodes.push({ osc, gain });
      });
    }

    return { oscMain, oscHarm, flourishNodes };
  }

  /**
   * Dramatic, loud, impactful low buzzer + gong strike + dissonance for calling a blunder / seizing turn.
   */
  crapetteCall() {
    if (!this._ensureActive()) return null;
    const ctx = this._ctx;
    const t = ctx.currentTime;

    // 1. Gritty low buzzer with detuned beating (82 Hz & 88 Hz)
    const buzzer1 = ctx.createOscillator();
    buzzer1.type = "sawtooth";
    buzzer1.frequency.setValueAtTime(82, t);

    const buzzer2 = ctx.createOscillator();
    buzzer2.type = "sawtooth";
    buzzer2.frequency.setValueAtTime(88, t); // 6 Hz beating

    const buzzerFilter = ctx.createBiquadFilter();
    buzzerFilter.type = "lowpass";
    buzzerFilter.frequency.setValueAtTime(750, t);
    buzzerFilter.frequency.exponentialRampToValueAtTime(180, t + 0.45);
    buzzerFilter.Q.setValueAtTime(2.5, t);

    const buzzerGain = ctx.createGain();
    buzzerGain.gain.setValueAtTime(0.38, t);
    buzzerGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    buzzer1.connect(buzzerFilter);
    buzzer2.connect(buzzerFilter);
    buzzerFilter.connect(buzzerGain);
    buzzerGain.connect(this._masterGain || ctx.destination);

    buzzer1.start(t);
    buzzer1.stop(t + 0.45);
    buzzer2.start(t);
    buzzer2.stop(t + 0.45);

    // 2. Dissonant tritone clash (116 Hz and 164 Hz ~ Bb2 and E3)
    const tritoneOsc = ctx.createOscillator();
    tritoneOsc.type = "sawtooth";
    tritoneOsc.frequency.setValueAtTime(116, t);

    const tritoneGain = ctx.createGain();
    tritoneGain.gain.setValueAtTime(0.22, t);
    tritoneGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    tritoneOsc.connect(tritoneGain);
    tritoneGain.connect(this._masterGain || ctx.destination);
    tritoneOsc.start(t);
    tritoneOsc.stop(t + 0.35);

    // 3. Heavy gong strike / sub impact dive
    const gongSub = ctx.createOscillator();
    gongSub.type = "sine";
    gongSub.frequency.setValueAtTime(140, t);
    gongSub.frequency.exponentialRampToValueAtTime(45, t + 0.6);

    const gongSubGain = ctx.createGain();
    gongSubGain.gain.setValueAtTime(0.45, t);
    gongSubGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

    gongSub.connect(gongSubGain);
    gongSubGain.connect(this._masterGain || ctx.destination);
    gongSub.start(t);
    gongSub.stop(t + 0.6);

    // 4. Metallic resonance
    const metalOsc = ctx.createOscillator();
    metalOsc.type = "triangle";
    metalOsc.frequency.setValueAtTime(370, t);

    const metalGain = ctx.createGain();
    metalGain.gain.setValueAtTime(0.18, t);
    metalGain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);

    metalOsc.connect(metalGain);
    metalGain.connect(this._masterGain || ctx.destination);
    metalOsc.start(t);
    metalOsc.stop(t + 0.7);

    return { buzzer1, buzzer2, tritoneOsc, gongSub, metalOsc };
  }

  /**
   * Celebratory triumphant chord fanfare for winning the deal.
   */
  victoryFanfare() {
    if (!this._ensureActive()) return null;
    const ctx = this._ctx;
    const t = ctx.currentTime;

    const fanfareNodes = [];

    // Heraldic fanfare notes leading into full triumph chord
    // C5, E5, G5, C6
    const leadNotes = [
      { freq: 523.25, time: t + 0.00, dur: 0.12 },
      { freq: 659.25, time: t + 0.12, dur: 0.12 },
      { freq: 783.99, time: t + 0.24, dur: 0.12 },
      { freq: 1046.50, time: t + 0.36, dur: 0.18 },
    ];

    leadNotes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, time);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.26, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

      osc.connect(gain);
      gain.connect(this._masterGain || ctx.destination);
      osc.start(time);
      osc.stop(time + dur);
      fanfareNodes.push(osc);
    });

    // Sustained celebratory major triad chord at t + 0.54s: C5, E5, G5, C6
    const chordTime = t + 0.54;
    const chordDuration = 1.1;
    const chordFreqs = [523.25, 659.25, 783.99, 1046.50];

    chordFreqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx === 3 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(freq, chordTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.24, chordTime);
      gain.gain.exponentialRampToValueAtTime(0.001, chordTime + chordDuration);

      osc.connect(gain);
      gain.connect(this._masterGain || ctx.destination);
      osc.start(chordTime);
      osc.stop(chordTime + chordDuration);
      fanfareNodes.push(osc);
    });

    return fanfareNodes;
  }
}

// Default singleton instance and factory
export function createAudio(options = {}) {
  return new SoundSynthesizer(options);
}

export const defaultAudio = new SoundSynthesizer();

// Convenience global trigger helpers delegating to default audio instance
export function cardSlide() {
  return defaultAudio.cardSlide();
}
export function cardSnap() {
  return defaultAudio.cardSnap();
}
export function cardFlip() {
  return defaultAudio.cardFlip();
}
export function foundationChime(rank) {
  return defaultAudio.foundationChime(rank);
}
export function crapetteCall() {
  return defaultAudio.crapetteCall();
}
export function victoryFanfare() {
  return defaultAudio.victoryFanfare();
}
export function setMuted(muted) {
  return defaultAudio.setMuted(muted);
}
export function isMuted() {
  return defaultAudio.isMuted();
}
export function setVolume(vol) {
  return defaultAudio.setVolume(vol);
}
export function getVolume() {
  return defaultAudio.getVolume();
}
