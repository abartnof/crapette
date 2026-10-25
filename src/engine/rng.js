// Seeded xoshiro256** PRNG seeded by SplitMix64 with named streams.
// Pinned to the reference algorithm from card_toolkit / cardkit-rng.

const MASK64 = 0xffffffffffffffffn;

function rotl(x, k) {
  const n = BigInt(k);
  return ((x << n) | (x >> (64n - n))) & MASK64;
}

class SplitMix64 {
  constructor(seed) {
    this.state = BigInt(seed) & MASK64;
  }

  nextU64() {
    this.state = (this.state + 0x9e3779b97f4a7c15n) & MASK64;
    let z = this.state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK64;
    return (z ^ (z >> 31n)) & MASK64;
  }
}

export class Rng {
  constructor(s0, s1, s2, s3) {
    this.s = [
      BigInt(s0) & MASK64,
      BigInt(s1) & MASK64,
      BigInt(s2) & MASK64,
      BigInt(s3) & MASK64,
    ];
  }

  static seeded(seed) {
    const sm = new SplitMix64(seed);
    return new Rng(sm.nextU64(), sm.nextU64(), sm.nextU64(), sm.nextU64());
  }

  static stream(seed, purpose) {
    const p = BigInt(purpose);
    const purposeMix = (p * 0x517cc1b727220a95n) & MASK64;
    const sm = new SplitMix64((BigInt(seed) ^ purposeMix) & MASK64);
    return new Rng(sm.nextU64(), sm.nextU64(), sm.nextU64(), sm.nextU64());
  }

  nextU64() {
    const [s0, s1, s2, s3] = this.s;
    const result = (rotl((s1 * 5n) & MASK64, 7) * 9n) & MASK64;
    const t = (s1 << 17n) & MASK64;

    this.s[2] = (s2 ^ s0) & MASK64;
    this.s[3] = (s3 ^ s1) & MASK64;
    this.s[1] = (this.s[1] ^ this.s[2]) & MASK64;
    this.s[0] = (s0 ^ this.s[3]) & MASK64;

    this.s[2] = (this.s[2] ^ t) & MASK64;
    this.s[3] = rotl(this.s[3], 45);

    return result;
  }

  // Returns integer in [0, max)
  nextBelow(max) {
    if (max <= 0) return 0;
    const m = BigInt(max);
    return Number(this.nextU64() % m);
  }

  // Returns integer in [min, max)
  nextInt(min, max) {
    return min + this.nextBelow(max - min);
  }

  // In-place Fisher-Yates shuffle
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextBelow(i + 1);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }
}
