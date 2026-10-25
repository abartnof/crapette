# Credits and Attribution

- **Game Design & Heritage**:
  - *Crapette* (also known as *Russian Bank*, *Zank-Patience*, *Streitpatience*, *Tunj*, and *Touch*), historical competitive patience card game dating to the late 19th century.
  - Rules and variations codified by John McLeod at [Pagat.com](https://www.pagat.com/patience/crapette.html).
- **Core 3D Card Architecture**:
  - Derived from `card_toolkit` by Abe Ratnofsky (`@abartnof`), including:
    - Inverted-hull ink line shader (`materials.js`)
    - Three-group card slab geometry (`cards.js`)
    - Vector width texture scaling and Canvas 2D Jumbo Index rendering (`faces.js`, `art.js`)
    - Clock timeline and animation director (`director.js`, `timeline.js`, `kinematics.js`)
    - Single-file HTML inliner (`build.py`)
- **Random Number Generation**:
  - `xoshiro256**` seeded by SplitMix64 PRNG algorithm by Sebastiano Vigna and David Blackman.
- **Three.js**:
  - Ricardo Cabello (Mr.doob) and the Three.js contributors (MIT License).
