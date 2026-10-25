import test from "node:test";
import assert from "node:assert/strict";
import {
  SoundSynthesizer,
  createAudio,
  defaultAudio,
  cardSlide,
  cardSnap,
  cardFlip,
  foundationChime,
  crapetteCall,
  victoryFanfare,
  setMuted,
  isMuted,
  setVolume,
  getVolume,
  PENTATONIC_FREQUENCIES,
} from "../web3d/src/audio.js";

// Helper to create a comprehensive Web Audio mock
function createMockAudioContext() {
  const createdNodes = [];
  const events = [];

  class MockAudioParam {
    constructor(name, defaultValue = 0) {
      this.name = name;
      this.value = defaultValue;
      this.scheduled = [];
    }
    setValueAtTime(value, time) {
      this.value = value;
      this.scheduled.push({ method: "setValueAtTime", value, time });
      return this;
    }
    linearRampToValueAtTime(value, time) {
      this.value = value;
      this.scheduled.push({ method: "linearRampToValueAtTime", value, time });
      return this;
    }
    exponentialRampToValueAtTime(value, time) {
      this.value = value;
      this.scheduled.push({ method: "exponentialRampToValueAtTime", value, time });
      return this;
    }
    setTargetAtTime(target, time, timeConstant) {
      this.scheduled.push({ method: "setTargetAtTime", target, time, timeConstant });
      return this;
    }
  }

  class MockAudioNode {
    constructor(nodeType) {
      this.nodeType = nodeType;
      this.connections = [];
      createdNodes.push(this);
    }
    connect(dest) {
      this.connections.push(dest);
      events.push({ action: "connect", source: this.nodeType, dest: dest.nodeType || "destination" });
      return dest;
    }
    disconnect() {
      events.push({ action: "disconnect", source: this.nodeType });
    }
  }

  class MockGainNode extends MockAudioNode {
    constructor() {
      super("gain");
      this.gain = new MockAudioParam("gain", 1.0);
    }
  }

  class MockOscillatorNode extends MockAudioNode {
    constructor() {
      super("oscillator");
      this.frequency = new MockAudioParam("frequency", 440);
      this.type = "sine";
      this.startedAt = null;
      this.stoppedAt = null;
    }
    start(time = 0) {
      this.startedAt = time;
      events.push({ action: "start", type: "oscillator", time });
    }
    stop(time = 0) {
      this.stoppedAt = time;
      events.push({ action: "stop", type: "oscillator", time });
    }
  }

  class MockBiquadFilterNode extends MockAudioNode {
    constructor() {
      super("biquadFilter");
      this.type = "lowpass";
      this.frequency = new MockAudioParam("frequency", 350);
      this.Q = new MockAudioParam("Q", 1);
    }
  }

  class MockAudioBufferSourceNode extends MockAudioNode {
    constructor() {
      super("bufferSource");
      this.buffer = null;
      this.startedAt = null;
      this.stoppedAt = null;
    }
    start(time = 0) {
      this.startedAt = time;
      events.push({ action: "start", type: "bufferSource", time });
    }
    stop(time = 0) {
      this.stoppedAt = time;
      events.push({ action: "stop", type: "bufferSource", time });
    }
  }

  const destination = new MockAudioNode("destination");

  const ctx = {
    currentTime: 10.0,
    sampleRate: 44100,
    state: "suspended",
    destination,
    async resume() {
      ctx.state = "running";
      events.push({ action: "resume" });
    },
    createGain() {
      return new MockGainNode();
    },
    createOscillator() {
      return new MockOscillatorNode();
    },
    createBiquadFilter() {
      return new MockBiquadFilterNode();
    },
    createBuffer(channels, length, sampleRate) {
      const channelData = new Float32Array(length);
      return {
        numberOfChannels: channels,
        length,
        sampleRate,
        getChannelData: () => channelData,
      };
    },
    createBufferSource() {
      return new MockAudioBufferSourceNode();
    },
  };

  return {
    ctx,
    createdNodes,
    events,
    MockGainNode,
    MockOscillatorNode,
    MockBiquadFilterNode,
    MockAudioBufferSourceNode,
  };
}

// -----------------------------------------------------------------------------
// Fallback & Node.js environment safety tests
// -----------------------------------------------------------------------------

test("Audio: runs safely in Node environment without Web Audio API (no-op fallback)", () => {
  const synth = new SoundSynthesizer({ context: null });
  assert.equal(synth.isSupported, false);
  assert.equal(synth.isMuted(), false);
  assert.equal(synth.getVolume(), 1.0);

  // Calling sound triggers in no-op mode does not throw and returns null/false
  assert.doesNotThrow(() => synth.cardSlide());
  assert.doesNotThrow(() => synth.cardSnap());
  assert.doesNotThrow(() => synth.cardFlip());
  assert.doesNotThrow(() => synth.foundationChime(1));
  assert.doesNotThrow(() => synth.foundationChime(13));
  assert.doesNotThrow(() => synth.crapetteCall());
  assert.doesNotThrow(() => synth.victoryFanfare());
  assert.doesNotThrow(() => synth.unlock());
});

test("Audio: volume and mute state management", () => {
  const synth = new SoundSynthesizer({ context: null });
  assert.equal(synth.getVolume(), 1.0);
  assert.equal(synth.isMuted(), false);

  synth.setVolume(0.5);
  assert.equal(synth.getVolume(), 0.5);

  // Clamping
  synth.setVolume(1.8);
  assert.equal(synth.getVolume(), 1.0);
  synth.setVolume(-0.2);
  assert.equal(synth.getVolume(), 0.0);

  synth.setMuted(true);
  assert.equal(synth.isMuted(), true);
  synth.setMuted(false);
  assert.equal(synth.isMuted(), false);
});

// -----------------------------------------------------------------------------
// Web Audio synthesis tests with mock context
// -----------------------------------------------------------------------------

test("Audio: initializes master gain and connects to destination when context is provided", () => {
  const { ctx, createdNodes } = createMockAudioContext();
  const synth = new SoundSynthesizer({ context: ctx });

  assert.equal(synth.isSupported, true);
  const masterGain = createdNodes.find((n) => n.nodeType === "gain");
  assert.ok(masterGain, "Master gain node should be created");
  assert.ok(masterGain.connections.includes(ctx.destination), "Master gain should connect to destination");
});

test("Audio: cardSlide() creates filtered noise / sweep with gentle attack and decay", () => {
  const { ctx, createdNodes } = createMockAudioContext();
  const synth = new SoundSynthesizer({ context: ctx });

  const startCount = createdNodes.length;
  synth.cardSlide();

  const newNodes = createdNodes.slice(startCount);
  const filter = newNodes.find((n) => n.nodeType === "biquadFilter");
  const gain = newNodes.find((n) => n.nodeType === "gain");
  const source = newNodes.find((n) => n.nodeType === "bufferSource" || n.nodeType === "oscillator");

  assert.ok(filter, "cardSlide should create a filter node");
  assert.ok(gain, "cardSlide should create an envelope gain node");
  assert.ok(source, "cardSlide should create a source (bufferSource or oscillator)");
  assert.ok(gain.gain.scheduled.length > 0, "Gain envelope should have scheduled events");
});

test("Audio: cardSnap() creates tactile sharp transient click and punchy low tap", () => {
  const { ctx, createdNodes } = createMockAudioContext();
  const synth = new SoundSynthesizer({ context: ctx });

  const startCount = createdNodes.length;
  synth.cardSnap();

  const newNodes = createdNodes.slice(startCount);
  const oscillators = newNodes.filter((n) => n.nodeType === "oscillator");
  const gains = newNodes.filter((n) => n.nodeType === "gain");

  assert.ok(gains.length >= 1, "cardSnap should have at least one gain envelope");
  assert.ok(oscillators.length >= 1, "cardSnap should have at least one oscillator for pitch thump");

  // Check pitch drop
  const osc = oscillators[0];
  const freqRamps = osc.frequency.scheduled;
  assert.ok(freqRamps.length >= 1, "cardSnap oscillator frequency should ramp down for punchy tap");
});

test("Audio: cardFlip() creates a quick two-tone flutter", () => {
  const { ctx, createdNodes } = createMockAudioContext();
  const synth = new SoundSynthesizer({ context: ctx });

  const startCount = createdNodes.length;
  synth.cardFlip();

  const newNodes = createdNodes.slice(startCount);
  const oscillators = newNodes.filter((n) => n.nodeType === "oscillator");
  assert.ok(oscillators.length >= 2, "cardFlip should create at least two tones for the flutter");
});

test("Audio: foundationChime(rank) ascends monotonically across ranks 1 to 13", () => {
  const frequencies = [];

  for (let rank = 1; rank <= 13; rank++) {
    const { ctx, createdNodes } = createMockAudioContext();
    const synth = new SoundSynthesizer({ context: ctx });
    synth.foundationChime(rank);

    const oscs = createdNodes.filter((n) => n.nodeType === "oscillator");
    assert.ok(oscs.length >= 1, `foundationChime(${rank}) should create at least one oscillator`);
    // The fundamental oscillator frequency
    const fundamentalFreq = oscs[0].frequency.value;
    frequencies.push(fundamentalFreq);
  }

  // Check Ace starts at warm bell frequency (C4 ≈ 261.63 Hz)
  assert.ok(
    Math.abs(frequencies[0] - 261.63) < 1.0,
    `Ace fundamental should be around 261.6 Hz (got ${frequencies[0]})`
  );

  // Check strictly ascending frequencies
  for (let i = 1; i < frequencies.length; i++) {
    assert.ok(
      frequencies[i] > frequencies[i - 1],
      `Rank ${i + 1} (${frequencies[i]}Hz) should be higher pitch than rank ${i} (${frequencies[i - 1]}Hz)`
    );
  }
});

test("Audio: foundationChime(13) (King) triggers a sparkling arpeggio flourish", () => {
  const { ctx: ctxQueen, createdNodes: nodesQueen } = createMockAudioContext();
  const synthQueen = new SoundSynthesizer({ context: ctxQueen });
  synthQueen.foundationChime(12); // Queen
  const queenOscCount = nodesQueen.filter((n) => n.nodeType === "oscillator").length;

  const { ctx: ctxKing, createdNodes: nodesKing } = createMockAudioContext();
  const synthKing = new SoundSynthesizer({ context: ctxKing });
  synthKing.foundationChime(13); // King
  const kingOscCount = nodesKing.filter((n) => n.nodeType === "oscillator").length;

  assert.ok(
    kingOscCount > queenOscCount,
    `King should trigger extra flourish oscillators (King: ${kingOscCount}, Queen: ${queenOscCount})`
  );
});

test("Audio: crapetteCall() triggers dramatic buzzer, dissonance, and gong strike", () => {
  const { ctx, createdNodes } = createMockAudioContext();
  const synth = new SoundSynthesizer({ context: ctx });

  const startCount = createdNodes.length;
  synth.crapetteCall();

  const newNodes = createdNodes.slice(startCount);
  const oscillators = newNodes.filter((n) => n.nodeType === "oscillator");
  assert.ok(oscillators.length >= 3, "crapetteCall should synthesize buzzer + dissonant tones + gong");

  // Check presence of low frequency buzzer / gong tone (< 150 Hz)
  const lowOsc = oscillators.find((o) => o.frequency.value <= 150);
  assert.ok(lowOsc, "crapetteCall should include low frequency impact/buzzer tone");
});

test("Audio: victoryFanfare() triggers triumphant chord fanfare", () => {
  const { ctx, createdNodes } = createMockAudioContext();
  const synth = new SoundSynthesizer({ context: ctx });

  const startCount = createdNodes.length;
  synth.victoryFanfare();

  const newNodes = createdNodes.slice(startCount);
  const oscillators = newNodes.filter((n) => n.nodeType === "oscillator");
  // Fanfare has multiple chord notes and arpeggio notes
  assert.ok(oscillators.length >= 4, "victoryFanfare should synthesize multiple chord/arpeggio tones");
});

test("Audio: muted state silences output", () => {
  const { ctx, createdNodes } = createMockAudioContext();
  const synth = new SoundSynthesizer({ context: ctx });

  synth.setMuted(true);
  const startCount = createdNodes.length;
  synth.cardSnap();
  synth.foundationChime(5);
  synth.crapetteCall();

  // Either no new nodes created or master gain is 0
  const masterGain = createdNodes.find((n) => n.nodeType === "gain");
  assert.equal(masterGain.gain.value, 0);
});

test("Audio: gesture unlock resumes suspended context", async () => {
  const { ctx, events } = createMockAudioContext();
  const synth = new SoundSynthesizer({ context: ctx });

  assert.equal(ctx.state, "suspended");
  await synth.unlock();
  assert.equal(ctx.state, "running");
  assert.ok(events.some((e) => e.action === "resume"));
});

test("Audio: createAudio factory and standalone module functions", () => {
  const synth = createAudio();
  assert.equal(synth instanceof SoundSynthesizer, true);

  // Standalone exports delegate to defaultAudio
  assert.equal(typeof getVolume(), "number");
  assert.equal(typeof isMuted(), "boolean");
  setVolume(0.8);
  assert.equal(getVolume(), 0.8);
  setMuted(true);
  assert.equal(isMuted(), true);
  setMuted(false);
  assert.equal(isMuted(), false);

  // Sound triggers do not throw
  assert.doesNotThrow(() => cardSlide());
  assert.doesNotThrow(() => cardSnap());
  assert.doesNotThrow(() => cardFlip());
  assert.doesNotThrow(() => foundationChime(1));
  assert.doesNotThrow(() => foundationChime(13));
  assert.doesNotThrow(() => crapetteCall());
  assert.doesNotThrow(() => victoryFanfare());
});

test("Audio: foundationChime clamps invalid or out-of-range ranks", () => {
  const { ctx, createdNodes } = createMockAudioContext();
  const synth = new SoundSynthesizer({ context: ctx });

  // Rank 0 should clamp to 1 (Ace, 261.63 Hz)
  synth.foundationChime(0);
  const oscLow = createdNodes.find((n) => n.nodeType === "oscillator");
  assert.ok(Math.abs(oscLow.frequency.value - 261.63) < 0.1);

  // Rank 99 should clamp to 13 (King) and trigger King flourish
  const startCount = createdNodes.length;
  synth.foundationChime(99);
  const newOscs = createdNodes.slice(startCount).filter((n) => n.nodeType === "oscillator");
  assert.ok(newOscs.length > 2, "Should trigger King flourish when clamped to 13");
});

test("Audio: attachGestureUnlock binds and removes listeners upon gesture", async () => {
  const listeners = {};
  const mockTarget = {
    addEventListener(event, fn) {
      listeners[event] = fn;
    },
    removeEventListener(event, fn) {
      if (listeners[event] === fn) delete listeners[event];
    },
  };

  const { ctx } = createMockAudioContext();
  const synth = new SoundSynthesizer({ context: ctx });

  synth.attachGestureUnlock(mockTarget);
  assert.ok(listeners["pointerdown"], "Should listen to pointerdown");
  assert.ok(listeners["keydown"], "Should listen to keydown");

  // Trigger pointerdown
  await listeners["pointerdown"]();
  assert.equal(ctx.state, "running");
  assert.equal(listeners["pointerdown"], undefined, "Listener should be removed after unlock");
  assert.equal(listeners["keydown"], undefined, "Listener should be removed after unlock");
});


