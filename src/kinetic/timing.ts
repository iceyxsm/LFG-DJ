/**
 * src/kinetic/timing.ts
 * Pure math and easing helpers for kinetic typography. Zero external dependencies.
 */

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * clamp01(t);

/* ------------------------------------------------------------------ */
/* Easing functions                                                    */
/* ------------------------------------------------------------------ */

export function easeOutCubic(t: number): number {
  const c = clamp01(t);
  return 1 - Math.pow(1 - c, 3);
}

export function easeInCubic(t: number): number {
  const c = clamp01(t);
  return c * c * c;
}

export function easeInOutCubic(t: number): number {
  const c = clamp01(t);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

/** Overshoot spring bounce for kinetic slam impact */
export function easeOutBack(t: number, overshoot = 1.70158): number {
  const c = clamp01(t) - 1;
  return c * c * ((overshoot + 1) * c + overshoot) + 1;
}

/** Elastic snap for high-energy rhythmic punches */
export function easeOutElastic(t: number): number {
  const c = clamp01(t);
  if (c === 0 || c === 1) return c;
  const p = 0.3;
  return Math.pow(2, -10 * c) * Math.sin(((c - p / 4) * (2 * Math.PI)) / p) + 1;
}

/* ------------------------------------------------------------------ */
/* Timing & Word Segmentation                                          */
/* ------------------------------------------------------------------ */

export interface WordTiming {
  index: number;
  text: string;
  startMs: number;
  endMs: number;
}

/**
 * Calculates progress (0..1) of playback through a given line.
 */
export function lineProgress(
  positionMs: number,
  lineStartMs: number,
  nextLineStartMs: number | null
): number {
  const end =
    nextLineStartMs != null && nextLineStartMs > lineStartMs
      ? nextLineStartMs
      : lineStartMs + 4000;
  return clamp01((positionMs - lineStartMs) / Math.max(1, end - lineStartMs));
}

const SHORT_FUNCTION_WORDS = new Set([
  "i", "a", "an", "the", "to", "in", "on", "at", "my", "me", "we", "he", "she",
  "it", "so", "up", "no", "of", "is", "as", "if", "by", "or", "and", "but",
  "you", "your", "do", "dont", "all", "be", "im", "ill", "ive",
]);

export function estimateWordWeight(word: string): number {
  const clean = word.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!clean) return 1.0;
  if (SHORT_FUNCTION_WORDS.has(clean)) return 0.65;
  if (clean.length <= 3) return 0.85;

  const vowelMatches = clean.match(/[aeiouy]+/g);
  const syllables = vowelMatches ? vowelMatches.length : 1;

  if (syllables === 1) {
    return clean.length >= 6 ? 1.3 : 1.0;
  }
  if (syllables === 2) {
    return 1.7;
  }
  return Math.min(3.2, syllables * 0.95);
}

/**
 * Splits a line of text into words with syllable-weighted vocal cadence timing windows.
 */
export function splitWords(
  text: string,
  lineStartMs: number,
  nextLineStartMs: number | null
): WordTiming[] {
  const rawWords = text.trim().split(/\s+/).filter(Boolean);
  const n = rawWords.length;
  if (n === 0) return [];

  const end =
    nextLineStartMs != null && nextLineStartMs > lineStartMs
      ? nextLineStartMs
      : lineStartMs + 4000;
  const rawSpan = Math.max(1, end - lineStartMs);
  // Cap sung duration so words don't drag unnaturally if next line is far away (e.g. 10s guitar solo)
  const span = Math.min(rawSpan, Math.max(1800, n * 580));

  // Word 0 begins synchronously with lineStartMs (zero artificial lag).
  // Leave a modest breathing release at the tail before the next line begins.
  const release = Math.min(0.08 * span, 200);
  const sungSpan = Math.max(1, span - release);

  const weights = rawWords.map(estimateWordWeight);
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  let currentStart = lineStartMs;
  return rawWords.map((word, i) => {
    const wordDur = sungSpan * (weights[i] / totalWeight);
    const startMs = currentStart;
    const endMs = startMs + wordDur;
    currentStart = endMs;

    return {
      index: i,
      text: word,
      startMs,
      endMs: endMs + wordDur * 0.15,
    };
  });
}

/**
 * Calculates word fill / sung status (0..1).
 */
export function wordFill(positionMs: number, w: WordTiming): number {
  const t = clamp01((positionMs - w.startMs) / Math.max(1, w.endMs - w.startMs));
  return easeOutCubic(t);
}

/**
 * Smooth cubic entrance ramp for liquid line transition (0 -> 1).
 * Uses easeOutCubic for clean, cushioned arrival without choppiness.
 */
export function enterRamp(msIntoLine: number, durationMs = 240): number {
  return easeOutCubic(clamp01(msIntoLine / Math.max(1, durationMs)));
}

/**
 * Exit ramp when a line finishes and clears out (0 -> 1).
 */
export function exitRamp(msPastLine: number, durationMs = 400): number {
  return easeInCubic(msPastLine / Math.max(1, durationMs));
}

/**
 * Onset pulse for a line hit (peaks at 1.0, falls to 0).
 */
export function onsetPulse(msIntoLine: number, decayMs = 500): number {
  const t = clamp01(msIntoLine / decayMs);
  return (1 - t) * (1 - t);
}

/**
 * Fallback procedural BPM pulse (heartbeat) when no audio/mic is active.
 */
export function bpmPulse(positionMs: number, bpm = 124): number {
  const beatPeriod = (60 / bpm) * 1000;
  const phase = (positionMs % beatPeriod) / beatPeriod;
  // sharp attack, exponential decay
  return Math.exp(-phase * 5);
}

export interface BeatClock {
  beatTotal: number;
  measureBeat: number; // 0..3 in 4/4 time
  bar: number;
  phase: number; // 0..1 inside current beat
  isDownbeat: boolean;
  pulse: number; // 0..1 dynamic pulse amplitude
  continuousPulse: number; // 0..1 continuous uninterrupted groove wave (never drops to 0 and stops)
  grooveBounce: number; // -1..1 continuous vertical bounce wave
}

export function calculateBeatClock(positionMs: number, bpm = 124): BeatClock {
  const beatPeriod = (60 / bpm) * 1000;
  const beatTotal = Math.floor(positionMs / beatPeriod);
  const phase = (positionMs % beatPeriod) / beatPeriod;
  const measureBeat = ((beatTotal % 4) + 4) % 4;
  const bar = Math.floor(beatTotal / 4);
  const isDownbeat = measureBeat === 0;

  // Sharp percussive kick attack
  const decay = Math.exp(-phase * 4.2);
  const weight = isDownbeat ? 1.0 : measureBeat === 2 ? 0.85 : 0.70;
  const pulse = decay * weight;

  // Continuous uninterrupted rhythmic groove wave (never stops!)
  // Smooth harmonic wave: peaks on beat, flows into offbeat bounce, ramps into next beat
  const harmonicWave = Math.cos(phase * 2 * Math.PI) * 0.5 + 0.5; // 0..1 smooth sinusoidal wave
  const upbeatLift = Math.sin(phase * Math.PI); // peaks at phase 0.5
  const continuousPulse = Math.min(1, Math.max(0, pulse * 0.45 + harmonicWave * 0.35 + upbeatLift * 0.20));

  // Vertical groove bounce: natural head-bob trajectory (dips on kick, floats on upbeat)
  const grooveBounce = Math.sin(phase * 2 * Math.PI);

  return {
    beatTotal,
    measureBeat,
    bar,
    phase,
    isDownbeat,
    pulse,
    continuousPulse,
    grooveBounce,
  };
}

export function rgbCss(c: [number, number, number], a?: number): string {
  const r = Math.round(clamp01(c[0]) * 255);
  const g = Math.round(clamp01(c[1]) * 255);
  const b = Math.round(clamp01(c[2]) * 255);
  return a == null ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${clamp01(a)})`;
}

export interface CameraRigState {
  x: number;
  y: number;
  zoom: number;
  rotate: number;
  chromaticX: number;
  blurPx: number;
}

/**
 * Calculates continuous 3D camera tracking coordinates for music video edit styles.
 * Selectively zooms in on key climactic moments and punchlines — NOT every single line!
 * Evaluated on requestAnimationFrame - zero CSS transition conflicts.
 */
export function calculateCameraRig(
  positionMs: number,
  msFromMount: number,
  currentWordIndex: number,
  words: WordTiming[],
  pulse: number,
  intensity: number,
  activeLineIndex: number,
  isVerticalStack = false,
  isTrackingLock = false
): CameraRigState {
  const totalWords = words.length;

  // Selective Zoom: in a real music video edit (Cole Bennett / Lyrical Lemonade / MTV),
  // macro camera tracking is reserved for select climactic punch moments (~20% of lines)
  // or dedicated tracking-lock archetypes (like ff-tracking),
  // while standard lines stay wide, centered, and rock-steady.
  const isPunchDrop = totalWords <= 2 && activeLineIndex % 2 === 1;
  const isHighDrop = intensity > 0.72 && activeLineIndex % 4 === 0;
  const isCascadeClimax = isVerticalStack && intensity > 0.58;
  const isClimactic = isPunchDrop || isHighDrop || isCascadeClimax || isTrackingLock;

  // 1. Continuous Sub-Word Pacing: smoothly glides from word to word without stepping
  let continuousWordRatio = 0;
  let wordAttackPulse = 0;

  if (isClimactic && totalWords > 1 && currentWordIndex >= 0) {
    const safeIdx = Math.min(totalWords - 1, currentWordIndex);
    const w = words[safeIdx];
    if (w) {
      const wordSpan = Math.max(1, w.endMs - w.startMs);
      const tInWord = clamp01((positionMs - w.startMs) / wordSpan);
      // Only interpolate toward the next word if not already on the last word
      const nextWeight = safeIdx < totalWords - 1 ? easeOutCubic(tInWord) : 0;
      const continuousIndex = safeIdx + nextWeight;
      continuousWordRatio = clamp(
        (continuousIndex / (totalWords - 1)) - 0.5,
        -0.45,
        0.45
      );
      wordAttackPulse = (1 - tInWord) * (1 - tInWord);
    }
  } else if (isClimactic && totalWords === 1 && currentWordIndex === 0) {
    const w = words[0];
    if (w) {
      const wordSpan = Math.max(1, w.endMs - w.startMs);
      const tInWord = clamp01((positionMs - w.startMs) / wordSpan);
      wordAttackPulse = (1 - tInWord) * (1 - tInWord);
    }
    continuousWordRatio = 0;
  }

  // 2. Camera Zoom:
  // - Standard lines (~80%): Clean 1.0x wide framing, rock-steady readability.
  // - Climactic lines (~20%): Tasteful 1.15x-1.20x macro framing with vocal attack punch.
  let finalZoom = 1.0;
  const kickTrans = pulse > 0.56 ? pulse - 0.56 : 0;
  const isHeavy = intensity > 0.65;

  if (isClimactic) {
    const targetZoom = totalWords <= 2 ? 1.20 : 1.14;
    const enterT = clamp01(msFromMount / 260);
    const enterEase = easeOutCubic(enterT);
    const enterZoom = lerp(1.02, targetZoom, enterEase);
    const wordPunch = wordAttackPulse * 0.04;
    const kickPunch = kickTrans * (isHeavy ? 0.05 : 0.025);
    finalZoom = enterZoom + wordPunch + kickPunch;
  } else {
    // Subtle beat breathing on normal lines
    finalZoom = 1.0 + kickTrans * 0.02;
  }

  // 3. Camera Pan:
  // - Short punchlines (<= 2 words): ZERO horizontal pan. Keeps words dead-center in the camera focal point!
  // - Multi-word lines: Restrained safe tracking (max 65px) so words never clip or touch screen edges.
  let targetPanX = 0;
  let targetPanY = 0;

  if (isClimactic) {
    if (isVerticalStack) {
      const travelY = Math.min(100, Math.max(30, (totalWords - 1) * 28));
      targetPanY = -continuousWordRatio * travelY;
    } else {
      // 1-2 words are already centered: zero horizontal pan avoids pushing the end of text off-screen
      const travelX = totalWords <= 2 ? 0 : Math.min(65, (totalWords - 2) * 18);
      targetPanX = -continuousWordRatio * travelX;
    }
  }

  // Silky smooth entrance slide (subtle 8px cushion only for climactic lines; standard lines stay anchored)
  const enterT = clamp01(msFromMount / 260);
  const enterEase = easeOutCubic(enterT);
  const enterSlideX = isClimactic ? (1 - enterEase) * (activeLineIndex % 2 === 0 ? 8 : -8) : 0;

  // Steadicam handheld float
  const driftX = Math.sin(positionMs * 0.0009) * 2;
  const driftY = Math.cos(positionMs * 0.0012) * 1.5;
  const driftRot = Math.sin(positionMs * 0.0007) * 0.2;

  // Beat kick roll & chromatic glitch split
  const kickRot = kickTrans * (activeLineIndex % 2 === 0 ? 0.4 : -0.4);
  const chromaticX = kickTrans * 2.5 + wordAttackPulse * 1.2;

  return {
    x: enterSlideX + targetPanX + driftX,
    y: targetPanY + driftY,
    zoom: finalZoom,
    rotate: driftRot + kickRot,
    chromaticX,
    blurPx: 0,
  };
}

