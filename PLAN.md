# Crapette (Russian Bank) 3D - Implementation Plan

## Overview
A modern, delightful 3D video game adaptation of **Crapette** (Russian Bank / Zank-Patience / Streitpatience), built as a single, self-contained offline HTML page using Three.js, cel-shaded card geometry with ink outlines, synthesized Web Audio sound effects and chimes, an authoritative rules engine, an intelligent AI opponent with difficulty settings, and rigorous test coverage.

Borrowing from `abartnof/card_toolkit`, `cassino`, and `la_belle_lucie`.

---

## Game Design Philosophy: Player Joy & Engagement
What makes a digital card game truly satisfying and fun?
1. **Snappy, Tactile Physics & Animation**:
   - Cards don't just teleport: they slide, hop in parabolic arcs, and flip with realistic 3D inertia.
   - Dynamic elevation: lifted cards cast soft drop shadows on the felt below.
2. **Harmonic Auditory Feedback (Web Audio Synthesizer)**:
   - Subtle felt rustle and card snap sounds on pickup and drop.
   - Foundation chime ladder: placing an Ace triggers a gentle chime (C4), building progressively in pitch up to King with a celebratory chord arpeggio.
   - The dramatic "CRAPETTE!" call: sharp, energetic brass/percussion impact with visual table shake and red banner announcement.
3. **Clarity Without Clutter**:
   - Two distinct deck color schemes: Royal Crimson vs. Midnight Navy card backs.
   - Clear visual affordances: hovering shows faint elevation; selecting highlights valid destination slots with a distinctive blue ink glow.
   - Distinct empty slot outlines with suit icons on foundation spaces and dashed outlines on tableau slots.
4. **Empowering Game Modes**:
   - **Competitive / Classic Mode**: Strict compulsory foundation rules and reserve priority. Active "CALL CRAPETTE!" button: catch the AI slipping and seize control of the turn!
   - **Cozy / Casual Mode**: Relaxed play with auto-foundation moves, polite hints, unlimited undo, and no blunder forfeitures.
   - **Configurable AI**: Novice (casual play, occasional human-like oversights) vs. Master (relentless reserve-loading tactician).
5. **Accessibility & Polish**:
   - Classic card faces and high-contrast Jumbo Index faces (auto-selected for touch/small screens).
   - Responsive layout adapting smoothly to desktop, tablet, and mobile orientations.
   - Built-in interactive Rules Guide and Game Statistics.

---

## Architecture & File Structure

```
crapette/
├── GEMINI.md                     # Standing project rules (TDD, atomic commits)
├── PLAN.md                       # Current roadmap and progress log
├── CREDITS.md                    # Asset and rules attribution
├── docs/
│   ├── RULES.md                  # Comprehensive Crapette rules & variations
│   └── PROTOCOL.md               # Engine state representation and command protocol
├── kit/                          # Vendored toolkit components from card_toolkit
│   ├── js/                       # cards.js, materials.js, scene.js, director.js, etc.
│   ├── css/                      # hud.css
│   ├── build.py                  # Single-file HTML bundler
│   └── STAMP                     # Provenance record
├── src/
│   ├── engine/                   # Authoritative pure JavaScript rules engine
│   │   ├── rng.js                # Seeded xoshiro256** & SplitMix64 generator
│   │   ├── cards.js              # Card representations, 104-card double pack, suits/ranks
│   │   ├── game.js               # Game state, layout, valid moves, turn flow, blunder checking
│   │   ├── ai.js                 # AI bot tactics (heuristic move generation, blunder simulation)
│   │   └── scoring.js            # Tournament scoring & statistics
│   ├── web3d/                    # Frontend 3D table & interface
│   │   ├── layout.js             # 3D spatial coordinates for table, foundations, reserves, tableau
│   │   ├── audio.js              # Web Audio API sound synthesizer (card sounds, chimes, crapette gong)
│   │   ├── table.js              # Three.js board setup, card mesh creation, animation tweens
│   │   ├── interaction.js        # Raycasting, drag-and-drop / click-to-move, valid slot highlight
│   │   ├── hud.js                # Scoreboard, turn indicator, card counts, Crapette! call button
│   │   ├── dialogs.js            # Settings modal, New Game modal, Rules help modal
│   │   ├── style.css             # Clean modern UI overlay styling
│   │   └── main.js               # Application entry point wiring engine, table, audio, and HUD
│   └── index.html                # Page shell template
├── test/                         # Comprehensive TDD test suite (Node test runner)
│   ├── rng.test.js               # PRNG determinism & vector checks
│   ├── cards.test.js             # Pack generation, card encoding, parsing
│   ├── rules.test.js             # Foundation building, tableau alternation, loading rules
│   ├── priorities.test.js        # Compulsory moves, reserve priority, Crapette blunder triggers
│   ├── ai.test.js                # AI decision making & blunder calling
│   └── scoring.test.js           # Score calculation & match ledger
└── bin/
    └── gate                      # Pre-commit test gate (runs all unit tests & verifies build)
```

---

## Phases of Execution

- [x] **Phase 1: Project Setup & Toolkit Vendoring**
  - Vendor `kit/` (js, css, build.py) from `card_toolkit`.
  - Create `CREDITS.md`, `docs/RULES.md`, and `docs/PROTOCOL.md`.
  - Create `bin/gate` test runner script.

- [ ] **Phase 2: Core Engine & TDD Test Suite (`src/engine/`)**
  - TDD: `rng.js` (xoshiro256** + SplitMix64) and tests.
  - TDD: `cards.js` (double deck, 104 cards, Red/Blue deck tagging, suit/rank helpers).
  - TDD: `game.js` (layout setup, available cards, foundation moves, tableau building, opponent loading, waste recycling, victory condition).
  - TDD: Priority & blunder enforcement (Reserve priority, compulsory foundation moves, "Crapette!" seizure).
  - TDD: `ai.js` (bot move selection, difficulty profiles, blunder-calling reaction).
  - TDD: `scoring.js` (match scoring, cards remaining penalties).

- [ ] **Phase 3: Web Audio Synthesizer (`src/web3d/audio.js`)**
  - Synthesize card slide, flip, snap, and table tap sounds.
  - Synthesize 13-step ascending pentatonic chimes for foundation building.
  - Synthesize dramatic "CRAPETTE!" impact buzzer and victory fanfare.

- [ ] **Phase 4: 3D Table & Visuals (`src/web3d/`)**
  - 3D table geometry, felt textures, camera framing.
  - Dual-deck card meshes (Royal Crimson vs. Midnight Navy backs).
  - High-DPI canvas-drawn card faces (Classic and Jumbo Index options).
  - Layout coordinates for 8 tableau columns, 8 foundations, 2 reserves, 2 stocks, 2 waste piles.
  - Smooth animation director: parabolic card hops, flip animations, target slot glowing.

- [ ] **Phase 5: User Interaction & HUD**
  - Click-to-move and drag-and-drop input handling.
  - Target slot highlighting and visual cues.
  - HUD: Turn indicator, card count meters, prominent "CALL CRAPETTE!" button.
  - Modals: New Game (seed selection, difficulty, mode), Settings (faces, animations, sound), Rules & Help.

- [ ] **Phase 6: Integration, Build & Polish**
  - Build pipeline via `build.py` generating standalone `crapette.html`.
  - Verify zero console errors, smooth 60fps animations.
  - Full verification with `bin/gate`.
