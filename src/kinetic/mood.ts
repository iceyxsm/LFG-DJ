/**
 * src/kinetic/mood.ts
 * Deterministic per-track color palette generator.
 * Zero external dependencies.
 */

export interface MoodPalette {
  /** Deep backdrop base tone */
  base: [number, number, number];
  /** Primary typographic color */
  primary: [number, number, number];
  /** Secondary typographic / border counterpoint */
  counter: [number, number, number];
  /** High-energy hot accent for active words, beat flashes, and glow */
  accent: [number, number, number];
}

export interface Mood {
  seed: number;
  palette: MoodPalette;
  phase: number;
}

export function hashTrack(identity: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < identity.length; i++) {
    h ^= identity.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hsl(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  return [f(0), f(8), f(4)];
}

export function moodFromTrack(identity: string): Mood {
  const seed = hashTrack(identity);
  const r = rng(seed);

  const anchorHue = r();
  const separation = 0.28 + r() * 0.22;
  const counterHue = (anchorHue + (r() > 0.5 ? separation : -separation) + 1) % 1;

  const anchorIsWarm = anchorHue < 0.14 || anchorHue > 0.85;
  const accentHue = anchorIsWarm
    ? (anchorHue + 0.5 + (r() - 0.5) * 0.15 + 1) % 1
    : 0.02 + r() * 0.12; // amber to neon magenta

  const sat = 0.6 + r() * 0.35;
  const lift = 0.02 + r() * 0.04;

  const palette: MoodPalette = {
    base: hsl(anchorHue, sat * 0.45, lift),
    primary: hsl(anchorHue, Math.min(0.95, sat + 0.1), 0.75 + r() * 0.15),
    counter: hsl(counterHue, sat * (0.7 + r() * 0.3), 0.5 + r() * 0.18),
    accent: hsl(accentHue, 0.95, 0.62 + r() * 0.15),
  };

  return { seed, palette, phase: r() * 1000 };
}
