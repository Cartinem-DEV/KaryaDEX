/**
 * KaryaDEX — Seeded Pseudo-Random Number Generator (PRNG)
 *
 * Implements a 32-bit Mulberry32 algorithm for deterministic, reproducible
 * puzzle generation across daily challenges and seeds.
 */

export interface PRNG {
  /** Returns a pseudorandom float between 0 (inclusive) and 1 (exclusive). */
  next(): number;
  /** Returns a pseudorandom integer between min (inclusive) and max (inclusive). */
  nextInt(min: number, max: number): number;
  /** Returns a random element from an array. */
  pick<T>(array: T[]): T;
  /** Shuffles an array in place deterministically using Fisher-Yates. */
  shuffle<T>(array: T[]): T[];
}

/**
 * Hashes an arbitrary string or number into a 32-bit unsigned integer seed.
 */
export function hashSeed(seedInput: string | number): number {
  if (typeof seedInput === 'number') {
    return (seedInput >>> 0) || 123456789;
  }

  let hash = 1779033703 ^ seedInput.length;
  for (let i = 0; i < seedInput.length; i++) {
    hash = Math.imul(hash ^ seedInput.charCodeAt(i), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return hash >>> 0;
}

/**
 * Creates a seeded PRNG using Mulberry32.
 */
export function createPRNG(seedInput: string | number): PRNG {
  let s = hashSeed(seedInput);

  function next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function nextInt(min: number, max: number): number {
    if (min >= max) return min;
    return Math.floor(next() * (max - min + 1)) + min;
  }

  function pick<T>(array: T[]): T {
    if (array.length === 0) throw new Error('Cannot pick from empty array');
    return array[nextInt(0, array.length - 1)];
  }

  function shuffle<T>(array: T[]): T[] {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = nextInt(0, i);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  return { next, nextInt, pick, shuffle };
}
