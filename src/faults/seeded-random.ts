// Seeded randomness: the same inputs always give the same number.
// Pure: no NestJS, no I/O.

// Turns any text into a 32-bit number (FNV-1a hash).
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// The mulberry32 generator from mini-proxy: one number between 0 and 1.
function mulberry32(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// The dice roll for one rule on one request: a number between 0 and 1.
// Depends only on (run seed, request number, rule id), so a run can be
// replayed exactly, even if requests arrive in a different order.
export function roll(seed: number, sequence: number, ruleId: string): number {
  return mulberry32(hash(`${seed}:${sequence}:${ruleId}`));
}
