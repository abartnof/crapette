# Crapette (Russian Bank)

Crapette (also known as Russian Bank or Zank-Patience) is a competitive two-player patience card game played with two 52-card decks (104 cards total). Players race to empty their Reserve, Stock, and Waste piles into shared central Foundations and Tableau columns, using clever sequences and tactical opponent loading ("Crapette") to sabotage the opponent's piles.

**Play it live at [abartnof.github.io/crapette](https://abartnof.github.io/crapette/)**,
or open `web3d/crapette.html` in any browser: it is a standalone, single-file 3D table build (~597 KB) with zero external network or runtime dependencies.

## Rules & Strategy

- **[pagat.com/patience/crapette.html](https://www.pagat.com/patience/crapette.html)**: Traditional European rules followed by this engine.
- `docs/RULES.md`: Authoritative rulebook detailing layout, compulsory move hierarchy, opponent loading, blunder calls, and tournament scoring.
- `docs/PROTOCOL.md`: Protocol specification for frontend-engine command dispatch.

## Architecture

- **Authoritative Rules Engine** (`src/engine/`): Pure JavaScript engine holding all game validity, deterministic seeded PRNG streams, blunder detection, and tournament score calculation.
- **Heuristic AI** (`src/engine/ai.js`): Intelligent opponent with `"master"` and `"novice"` difficulty settings.
- **Procedural Web Audio API Synthesizer** (`web3d/src/audio.js`): Felt slides, card snaps, flutters, 13-step ascending pentatonic foundation chimes, and blunder alarm buzzer/gongs.
- **3D Table & HUD** (`web3d/src/`): Built on Three.js with cel-shaded cards, inverted-hull ink line outlines, high-DPI Canvas 2D Jumbo Index faces, and dual-deck backs (Royal Crimson vs. Midnight Navy).

## Building & Verification

```bash
node --test test/*.test.js   # run engine and layout unit test suite
./bin/gate                  # run pre-commit test gate and build check
python3 kit/build.py        # bundle and compile single-file web3d/crapette.html
```
