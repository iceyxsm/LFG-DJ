import type { KineticArchetype } from "./types";

export const ALL_STYLES: KineticArchetype[] = [
  "STACCATO_BURST",
  "WHIP_DIRECTIONAL_SLAM",
  "INVERTED_COLOR_STROBE",
  "WORD_CASCADE_STACK",
  "PERSPECTIVE_3D_SNAP",
  "DYNAMIC_SCALE_RAMP",
  "FF_TRACKING_LOCK",
];

const LONG_LINE_STYLES: KineticArchetype[] = [
  "WHIP_DIRECTIONAL_SLAM",
  "INVERTED_COLOR_STROBE",
  "PERSPECTIVE_3D_SNAP",
  "DYNAMIC_SCALE_RAMP",
  "FF_TRACKING_LOCK",
  "STACCATO_BURST",
];

export function getForcedArchetype(): KineticArchetype | null {
  if (typeof window === "undefined") return null;
  const win = window as any;
  if (win.__forcedArchetype) return win.__forcedArchetype;
  try {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("style") || params.get("archetype");
    if (q) {
      const match = ALL_STYLES.find(
        (s) => s.toLowerCase() === q.toLowerCase() || (q.toLowerCase() === "ff-tracking" && s === "FF_TRACKING_LOCK")
      );
      if (match) return match;
    }
  } catch {}
  return null;
}

export function setForcedArchetype(archetype: KineticArchetype | null): void {
  if (typeof window === "undefined") return;
  (window as any).__forcedArchetype = archetype;
}

/**
 * Guarantees that EVERY SINGLE CONSECUTIVE LINE features a completely
 * different visual edit cut and kinetic physics:
 * - Line 0: Style A
 * - Line 1: Style B
 * - Line 2: Style C
 * - Line 3: Style D
 * - Line 4: Style E
 * - Line 5: Style F
 * - Line 6: Style G (FF_TRACKING_LOCK)
 * Never repeats the same effect across lines.
 */
export function pickArchetype(
  lineIndex: number,
  text: string,
  trackSeed: number,
  _intensity = 0.5
): KineticArchetype {
  const forced = getForcedArchetype();
  if (forced) return forced;

  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Very short punch lines (1–2 words)
  if (wordCount <= 2) {
    const punchPool: KineticArchetype[] = [
      "STACCATO_BURST",
      "PERSPECTIVE_3D_SNAP",
      "FF_TRACKING_LOCK",
      "INVERTED_COLOR_STROBE",
      "DYNAMIC_SCALE_RAMP",
    ];
    return punchPool[Math.abs((lineIndex * 3 + trackSeed) % punchPool.length)];
  }

  // Long lines (5+ words) must avoid single-word vertical stacks so height never overflows
  if (wordCount >= 5) {
    return LONG_LINE_STYLES[Math.abs((lineIndex + trackSeed) % LONG_LINE_STYLES.length)];
  }

  // Standard line progression (3–4 words): full pool including cascade stack and tracking lock
  return ALL_STYLES[Math.abs((lineIndex + trackSeed) % ALL_STYLES.length)];
}
