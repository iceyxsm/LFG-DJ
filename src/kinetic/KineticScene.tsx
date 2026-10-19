import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import type { KineticLineData, KineticArchetype } from "./types";
import type { Mood } from "./mood";
import {
  clamp01,
  splitWords,
  wordFill,
  enterRamp,
  onsetPulse,
  rgbCss,
  calculateBeatClock,
  calculateCameraRig,
} from "./timing";
import {
  pickArchetype,
  ALL_STYLES,
  getForcedArchetype,
  setForcedArchetype,
} from "./archetypes";
import { BeatReactor } from "./BeatReactor";

interface KineticSceneProps {
  activeLine: KineticLineData | null;
  nextLine: KineticLineData | null;
  prevLine?: KineticLineData | null;
  positionMs: number;
  activeLineIndex: number;
  totalLines?: number;
  energy: number;
  bands: { bass: number; mid: number; treble: number };
  mood: Mood | null;
  paused: boolean;
  trackName: string | null;
  artistName: string | null;
  lyricsMode: string;
}

const FONT_DISPLAY = "'Archivo Black', sans-serif";
const FONT_BODY = "'Space Grotesk', sans-serif";
const FONT_MONO = 'ui-monospace, "JetBrains Mono", "SF Mono", "Cascadia Code", Menlo, Monaco, Consolas, "Liberation Mono", monospace';

interface FFTrackingTheme {
  name: string;
  bg: string;
  dark: string;
  mid: string;
  bright: string;
  white: string;
  glow: string;
  hatch: string;
}

const FF_TRACKING_THEMES: FFTrackingTheme[] = [
  {
    name: "Phosphor",
    bg: "#010604",
    dark: "#05361b",
    mid: "#13a85a",
    bright: "#7dffb4",
    white: "#eafff3",
    glow: "rgba(125, 255, 180, 0.4)",
    hatch: "rgba(125, 255, 180, 0.16)",
  },
  {
    name: "Thermal",
    bg: "#050310",
    dark: "#3a0b6b",
    mid: "#b3306a",
    bright: "#f6862a",
    white: "#fcf6b4",
    glow: "rgba(246, 134, 42, 0.4)",
    hatch: "rgba(246, 134, 42, 0.16)",
  },
  {
    name: "Amber",
    bg: "#070300",
    dark: "#3d1a02",
    mid: "#b35a09",
    bright: "#ffae3d",
    white: "#fff3d6",
    glow: "rgba(255, 174, 61, 0.4)",
    hatch: "rgba(255, 174, 61, 0.16)",
  },
  {
    name: "Neon",
    bg: "#000502",
    dark: "#003d1e",
    mid: "#00c46a",
    bright: "#5dffae",
    white: "#f0fff6",
    glow: "rgba(93, 255, 174, 0.4)",
    hatch: "rgba(93, 255, 174, 0.16)",
  },
];

interface TypographyScale {
  fontSize: string;
  lineHeight: number;
  wordGap: string;
  rowGap: string;
}

/**
 * Responsive Goldilocks Typographic Scaler:
 * Large and monumental, but strictly bounded so word scales, skews, and shadows never clip.
 */
function getTypographyScale(wordCount: number, totalChars: number, longestWord: number): TypographyScale {
  if (longestWord >= 10 || totalChars >= 28 || wordCount >= 7) {
    return {
      fontSize: "clamp(1.8rem, 4.6vw, 3.8rem)",
      lineHeight: 1.02,
      wordGap: "clamp(0.5rem, 1.5vw, 1.6rem)",
      rowGap: "clamp(0.4rem, 1.2vw, 1.4rem)",
    };
  }
  if (longestWord >= 7 || totalChars >= 14 || wordCount >= 4) {
    return {
      fontSize: "clamp(2.3rem, 6.6vw, 5.0rem)",
      lineHeight: 0.98,
      wordGap: "clamp(0.6rem, 2vw, 2.0rem)",
      rowGap: "clamp(0.5rem, 1.4vw, 1.6rem)",
    };
  }
  return {
    fontSize: "clamp(2.8rem, 8.8vw, 6.5rem)",
    lineHeight: 0.94,
    wordGap: "clamp(0.8rem, 2.4vw, 2.4rem)",
    rowGap: "clamp(0.5rem, 1.8vw, 1.8rem)",
  };
}

function getStaccatoWordSize(wordText: string): string {
  const len = wordText.length;
  if (len <= 4) return "clamp(3.5rem, 12vw, 9.2rem)";
  if (len <= 7) return "clamp(2.8rem, 9.2vw, 7.2rem)";
  if (len <= 10) return "clamp(2.2rem, 7.2vw, 5.6rem)";
  return "clamp(1.8rem, 5.4vw, 4.2rem)";
}

export const KineticScene: React.FC<KineticSceneProps> = ({
  activeLine,
  nextLine,
  prevLine: _prevLine,
  positionMs,
  activeLineIndex,
  totalLines = 0,
  energy,
  bands,
  mood,
  paused,
  trackName,
  artistName,
  lyricsMode,
}) => {
  const palette = mood?.palette;
  // High-voltage sharp colors (zero muddy glows)
  const accentHex = palette ? rgbCss(palette.accent) : "#00f0ff";
  const primaryHex = palette ? rgbCss(palette.primary) : "#ffffff";
  const counterHex = palette ? rgbCss(palette.counter) : "rgba(255,255,255,0.4)";

  const [forcedArchetype, setForced] = useState<KineticArchetype | null>(() => getForcedArchetype());

  const handleCycleArchetype = useCallback(() => {
    setForced((curr) => {
      const startIdx = curr ? ALL_STYLES.indexOf(curr) : -1;
      const nextIdx = (startIdx + 1) % (ALL_STYLES.length + 1);
      const next = nextIdx === ALL_STYLES.length ? null : ALL_STYLES[nextIdx];
      setForcedArchetype(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return;
      if (ev.key === "t" || ev.key === "T") {
        setForced((curr) => {
          const next = curr === "FF_TRACKING_LOCK" ? null : "FF_TRACKING_LOCK";
          setForcedArchetype(next);
          return next;
        });
      } else if (ev.key === "e" || ev.key === "E") {
        handleCycleArchetype();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleCycleArchetype]);

  // 4/4 Beat Rhythm Clock
  const beat = calculateBeatClock(positionMs, 124);
  const synthPulse = paused ? 0 : beat.pulse;
  const pulse = Math.max(synthPulse, bands.bass > 0.05 ? bands.bass : 0);

  // Continuous Uninterrupted Musical Groove Beat Effect (never stops or drops dead between beats)
  const continuousBeatPulse = paused
    ? 0
    : Math.min(1, Math.max(beat.continuousPulse, bands.bass > 0.05 ? bands.bass * 0.9 : 0));
  const grooveBounce = paused ? 0 : beat.grooveBounce;

  // Progressive Energy Pacing
  const introFactor = Math.min(1, Math.max(0.2, activeLineIndex / 3.5));
  const audioEnergy = Math.max(bands.bass * 0.7 + energy * 0.3, synthPulse * 0.6);
  const intensity = Math.min(1, Math.max(0.25, introFactor * 0.6 + audioEnergy * 0.45));

  // Line timing
  const lineStartMs = activeLine?.timeMs ?? 0;
  const nextLineStartMs = nextLine?.timeMs ?? null;
  const msFromMount = Math.max(0, positionMs - (lineStartMs - 120));
  const msIntoLine = Math.max(0, positionMs - lineStartMs);
  const enterProgress = enterRamp(msFromMount, 260);
  const enterOpacity = clamp01(msFromMount / 140);
  const hitPulse = onsetPulse(msIntoLine, 300);

  // Word-level timing
  const words = useMemo(() => {
    if (!activeLine) return [];
    return splitWords(activeLine.text, lineStartMs, nextLineStartMs);
  }, [activeLine?.text, lineStartMs, nextLineStartMs]);

  // Active word index
  const currentWordIndex = useMemo(() => {
    if (words.length === 0) return -1;
    let idx = 0;
    for (let i = 0; i < words.length; i++) {
      if (positionMs >= words[i].startMs) idx = i;
    }
    return idx;
  }, [words, positionMs]);

  // Dynamic Archetype Selection (Guarantees every consecutive line has a completely different edit style!)
  const hasText = !!(activeLine && activeLine.text.trim().length > 0);
  const archetype = useMemo(() => {
    if (!hasText || !activeLine) return forcedArchetype ?? "WHIP_DIRECTIONAL_SLAM";
    return pickArchetype(activeLineIndex, activeLine.text, mood?.seed ?? 42, intensity);
  }, [activeLineIndex, activeLine?.text, mood?.seed, hasText, intensity, forcedArchetype]);

  const isVerticalStack = archetype === "WORD_CASCADE_STACK";
  const isTrackingLock = archetype === "FF_TRACKING_LOCK";

  // 3D Macro Camera Rig: zooms into text and continuously follows words as they are sung
  const cam = calculateCameraRig(
    positionMs,
    msFromMount,
    currentWordIndex,
    words,
    pulse,
    intensity,
    activeLineIndex,
    isVerticalStack,
    isTrackingLock
  );

  // Music-video RGB chromatic split on kicks and heavy syllable transients
  const chromaticShadow =
    cam.chromaticX > 0.4
      ? `${cam.chromaticX.toFixed(1)}px 0 0 ${accentHex}, ${(-cam.chromaticX).toFixed(1)}px 0 0 ${counterHex}, 3px 3px 0px #000000`
      : "3px 3px 0px #000000";

  // Responsive Metrics Computation
  const typography = useMemo(() => {
    const wordCount = words.length;
    const totalChars = words.reduce((acc, w) => acc + w.text.length, 0);
    const longestWord = Math.max(...words.map((w) => w.text.length), 0);
    return getTypographyScale(wordCount, totalChars, longestWord);
  }, [words]);

  // Authentic ff-tracking Deterministic Palette (Phosphor, Thermal, Amber, Neon)
  const ffTheme = useMemo(() => {
    const seed = mood?.seed ?? 42;
    return FF_TRACKING_THEMES[Math.abs(seed) % FF_TRACKING_THEMES.length];
  }, [mood?.seed]);

  // Optical Glyph Tracker Box Layout Measurements for SVG Vector Connector Link
  const ffContainerRef = useRef<HTMLDivElement | null>(null);
  const ffWordRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [ffBoxPoints, setFfBoxPoints] = useState<
    { cx: number; cy: number; left: number; right: number; top: number; bottom: number }[]
  >([]);

  useEffect(() => {
    if (archetype !== "FF_TRACKING_LOCK" || !ffContainerRef.current) return;
    const updatePoints = () => {
      const container = ffContainerRef.current;
      if (!container) return;
      const cRect = container.getBoundingClientRect();
      const pts = ffWordRefs.current
        .filter((el): el is HTMLDivElement => el !== null)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return {
            cx: r.left - cRect.left + r.width / 2,
            cy: r.top - cRect.top + r.height / 2,
            left: r.left - cRect.left,
            right: r.right - cRect.left,
            top: r.top - cRect.top,
            bottom: r.bottom - cRect.top,
          };
        });
      setFfBoxPoints(pts);
    };

    updatePoints();
    const ro = new ResizeObserver(updatePoints);
    ro.observe(ffContainerRef.current);
    return () => ro.disconnect();
  }, [archetype, words.length, activeLine?.text]);

  /* ------------------------------------------------------------------ */
  /* Fallback / Instrumental / Beat Reactor Transitions                */
  /* ------------------------------------------------------------------ */
  if (lyricsMode === "loading") {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: "clamp(2.5rem, 6vw, 5.5rem)",
              color: primaryHex,
              letterSpacing: "-0.04em",
              textTransform: "uppercase",
            }}
          >
            TUNING IN
          </div>
        </div>
      </div>
    );
  }

  // Instrumental / Beat Reactor conditions
  const isIntro = activeLineIndex < 0;
  const isOutro = totalLines > 0 && activeLineIndex >= totalLines - 1 && msIntoLine > 8000;
  const gapToNext = nextLineStartMs != null ? nextLineStartMs - lineStartMs : 0;
  const isLongBreak = gapToNext >= 9000 && msIntoLine > 6500;
  const showBeatReactor =
    lyricsMode === "instrumental" || isIntro || isOutro || isLongBreak || !hasText;

  if (showBeatReactor) {
    return (
      <BeatReactor
        palette={palette ?? null}
        energy={energy}
        bands={bands}
        pulse={pulse}
        trackName={trackName}
        artistName={artistName}
        positionMs={positionMs}
      />
    );
  }

  return (
    <div
      style={{
        ...containerStyle,
        transform: `translate3d(${cam.x.toFixed(1)}px, ${cam.y.toFixed(1)}px, 0) scale(${cam.zoom.toFixed(3)}) rotate(${cam.rotate.toFixed(2)}deg)`,
        willChange: "transform",
      }}
    >
      {/* Cinematic Viewfinder Corner Brackets */}
      <div style={cornerTopLeftStyle} />
      <div style={cornerTopRightStyle} />
      <div style={cornerBottomLeftStyle} />
      <div style={cornerBottomRightStyle} />

      {/* Cinematic Letterbox Vignettes */}
      <div style={letterboxTopStyle} />
      <div style={letterboxBottomStyle} />

      {/* Edit Monitor HUD Metadata Bar */}
      <div style={editHudStyle}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              backgroundColor: beat.isDownbeat ? "#ff2a5f" : "#888888",
              boxShadow: beat.isDownbeat ? "0 0 8px #ff2a5f" : "none",
              transition: "background-color 0.08s ease",
            }}
          />
          REC • 124 BPM
        </span>
        <span>BAR {beat.bar + 1} : {beat.measureBeat + 1}</span>
        <span
          onClick={handleCycleArchetype}
          style={{
            cursor: "pointer",
            pointerEvents: "auto",
            padding: "2px 7px",
            borderRadius: "4px",
            backgroundColor: forcedArchetype ? "rgba(255, 42, 95, 0.22)" : "rgba(255, 255, 255, 0.06)",
            border: forcedArchetype ? "1px solid rgba(255, 42, 95, 0.6)" : "1px solid rgba(255, 255, 255, 0.12)",
            color: forcedArchetype ? "#ff4070" : "inherit",
            transition: "all 0.12s ease",
          }}
          title="Click to cycle edit styles or lock FF-TRACKING (shortcut: 't' to toggle ff-tracking, 'e' to cycle)"
        >
          EDIT // {archetype.replace(/_/g, " ")}{forcedArchetype ? " [LOCKED]" : ""}
        </span>
      </div>
      {/* -------------------------------------------------------------- */}
      {/* 1. STACCATO_BURST (The Machine Gun Word Cut)                   */}
      {/* -------------------------------------------------------------- */}
      {archetype === "STACCATO_BURST" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            maxWidth: "min(88vw, 1200px)",
            maxHeight: "75vh",
            textAlign: "center",
            overflow: "visible",
            padding: "clamp(12px, 2vw, 28px)",
            boxSizing: "border-box",
            opacity: enterOpacity,
            transform: `scale(${0.96 + enterProgress * 0.04 + continuousBeatPulse * 0.025}) translateY(${(1 - enterProgress) * 12 + grooveBounce * -3}px)`,
            willChange: "transform, opacity",
          }}
        >
          {/* Monumental Active Word Cutting on Each Syllable - Keyed by index so repeated words (e.g. "oh oh oh") re-punch distinctly */}
          <div
            key={`${currentWordIndex}-${words[currentWordIndex]?.text || 0}`}
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: getStaccatoWordSize(words[currentWordIndex]?.text || words[0]?.text || ""),
              lineHeight: 0.9,
              textTransform: "uppercase",
              letterSpacing: "-0.05em",
              color: primaryHex,
              transform: `scale(${1 + continuousBeatPulse * 0.07 + hitPulse * 0.05}) translateY(${grooveBounce * -4}px)`,
              willChange: "transform",
              wordBreak: "break-word",
              maxWidth: "min(84vw, 1100px)",
              padding: "0 16px",
              boxSizing: "border-box",
              textShadow: chromaticShadow,
            }}
          >
            {words[currentWordIndex]?.text || words[0]?.text || ""}
          </div>

          {/* Clean Edit Context Line Below with Active Highlighter Badge */}
          <div
            style={{
              display: "flex",
              gap: "clamp(8px, 1.4vw, 16px)",
              flexWrap: "wrap",
              justifyContent: "center",
              marginTop: "clamp(1.5rem, 3vw, 2.5rem)",
              maxWidth: "85vw",
            }}
          >
            {words.map((w, idx) => {
              const isCurr = idx === currentWordIndex;
              const isDone = idx < currentWordIndex;
              return (
                <span
                  key={idx}
                  style={{
                    fontFamily: FONT_BODY,
                    fontSize: "clamp(0.85rem, 1.4vw, 1.3rem)",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    padding: isCurr ? "4px 10px" : "4px 0",
                    borderRadius: "4px",
                    backgroundColor: isCurr ? accentHex : "transparent",
                    color: isCurr ? "#000000" : isDone ? primaryHex : "rgba(255,255,255,0.24)",
                    borderBottom: isCurr ? "none" : isDone ? "2px solid rgba(255,255,255,0.4)" : "2px solid transparent",
                    boxShadow: isCurr ? `0 4px 14px ${accentHex}66` : "none",
                    textShadow: "none",
                    transform: isCurr
                      ? `scale(${1.08 + continuousBeatPulse * 0.05}) translateY(${-continuousBeatPulse * 3}px)`
                      : "scale(1)",
                    transition: "all 0.12s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                >
                  {w.text}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------- */}
      {/* 2. WHIP_DIRECTIONAL_SLAM (High-Velocity Whip-Pan Entrance)      */}
      {/* -------------------------------------------------------------- */}
      {archetype === "WHIP_DIRECTIONAL_SLAM" && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
            gap: typography.wordGap,
            rowGap: typography.rowGap,
            textAlign: "center",
            maxWidth: "min(88vw, 1200px)",
            maxHeight: "75vh",
            overflow: "visible",
            padding: "clamp(12px, 2.5vw, 32px)",
            boxSizing: "border-box",
            opacity: enterOpacity,
            transform: `translateX(${(1 - enterProgress) * (activeLineIndex % 2 === 0 ? -28 : 28)}px) skewX(${(1 - enterProgress) * (activeLineIndex % 2 === 0 ? -4 : 4)}deg) scale(${1 + continuousBeatPulse * 0.02}) translateY(${grooveBounce * -3}px)`,
            willChange: "transform, opacity",
          }}
        >
          {words.map((w, idx) => {
            const fill = wordFill(positionMs, w);
            const isCurrent = idx === currentWordIndex;
            const isSung = fill > 0.05;
            const wordDist = Math.abs(idx - currentWordIndex);

            return (
              <span
                key={idx}
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: typography.fontSize,
                  lineHeight: typography.lineHeight,
                  textTransform: "uppercase",
                  letterSpacing: "-0.04em",
                  display: "inline-block",
                  padding: isCurrent ? "0.04em 0.28em" : "0",
                  borderRadius: "4px",
                  backgroundColor: isCurrent ? primaryHex : "transparent",
                  color: isCurrent
                    ? "#000000"
                    : isSung
                    ? primaryHex
                    : "rgba(255, 255, 255, 0.24)",
                  transform: isCurrent
                    ? `scale(${1.12 + continuousBeatPulse * 0.06}) translateY(${-3 - continuousBeatPulse * 4}px)`
                    : `scale(${1 + continuousBeatPulse * 0.015})`,
                  opacity: isCurrent ? 1 : wordDist === 1 ? 0.78 : 0.35,
                  boxShadow: isCurrent ? "0 8px 24px rgba(0,0,0,0.6)" : "none",
                  textShadow: isCurrent ? "none" : isSung ? "3px 3px 0px #000000" : "none",
                  transition: "background-color 0.12s ease, color 0.12s ease, transform 0.12s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.15s ease",
                  wordBreak: "break-word",
                  willChange: "transform, opacity",
                }}
              >
                {w.text}
              </span>
            );
          })}
        </div>
      )}

      {/* -------------------------------------------------------------- */}
      {/* 3. INVERTED_COLOR_STROBE (Solid High-Contrast Block Snap)       */}
      {/* -------------------------------------------------------------- */}
      {archetype === "INVERTED_COLOR_STROBE" && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
            gap: typography.wordGap,
            rowGap: typography.rowGap,
            textAlign: "center",
            maxWidth: "min(88vw, 1200px)",
            maxHeight: "75vh",
            overflow: "visible",
            padding: "clamp(12px, 2.5vw, 32px)",
            boxSizing: "border-box",
            opacity: enterOpacity,
            transform: `scale(${0.96 + enterProgress * 0.04 + continuousBeatPulse * 0.025}) translateY(${(1 - enterProgress) * 12 + grooveBounce * -3}px)`,
            willChange: "transform, opacity",
          }}
        >
          {words.map((w, idx) => {
            const fill = wordFill(positionMs, w);
            const isCurrent = idx === currentWordIndex;
            const isSung = fill > 0.05;
            const wordDist = Math.abs(idx - currentWordIndex);

            return (
              <span
                key={idx}
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: typography.fontSize,
                  lineHeight: 1.0,
                  textTransform: "uppercase",
                  letterSpacing: "-0.03em",
                  display: "inline-block",
                  padding: isCurrent ? "0.06em 0.32em" : "0",
                  borderRadius: "4px",
                  backgroundColor: isCurrent ? accentHex : "transparent",
                  color: isCurrent
                    ? "#000000"
                    : isSung
                    ? primaryHex
                    : "rgba(255, 255, 255, 0.24)",
                  transform: isCurrent
                    ? `scale(${1.12 + continuousBeatPulse * 0.06}) translateY(${-2 - continuousBeatPulse * 4}px)`
                    : `scale(${1 + continuousBeatPulse * 0.015})`,
                  opacity: isCurrent ? 1 : wordDist === 1 ? 0.78 : 0.35,
                  boxShadow: isCurrent ? `0 8px 24px rgba(0,0,0,0.6), 0 0 20px ${accentHex}44` : "none",
                  textShadow: isCurrent ? "none" : isSung ? "3px 3px 0px #000000" : "none",
                  transition: "all 0.1s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.15s ease",
                  wordBreak: "break-word",
                  willChange: "transform, opacity",
                }}
              >
                {w.text}
              </span>
            );
          })}
        </div>
      )}

      {/* -------------------------------------------------------------- */}
      {/* 4. WORD_CASCADE_STACK (Words Slam Down Into Stack on Beat)     */}
      {/* -------------------------------------------------------------- */}
      {archetype === "WORD_CASCADE_STACK" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "clamp(0.4rem, 1vw, 1.2rem)",
            maxWidth: "min(88vw, 1200px)",
            maxHeight: "75vh",
            overflow: "visible",
            padding: "clamp(12px, 2.5vw, 32px)",
            boxSizing: "border-box",
            textAlign: "center",
            opacity: enterOpacity,
            transform: `translateY(${(1 - enterProgress) * 18 + grooveBounce * -3}px) scale(${1 + continuousBeatPulse * 0.02})`,
            willChange: "transform, opacity",
          }}
        >
          {words.map((w, idx) => {
            const fill = wordFill(positionMs, w);
            const isCurrent = idx === currentWordIndex;
            const isSung = fill > 0.05;
            const wordDist = Math.abs(idx - currentWordIndex);

            return (
              <span
                key={idx}
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize:
                    words.length <= 4
                      ? "clamp(2.4rem, 7vw, 5.5rem)"
                      : "clamp(1.6rem, 4.2vw, 3.4rem)",
                  lineHeight: 0.95,
                  textTransform: "uppercase",
                  letterSpacing: "-0.04em",
                  display: "inline-block",
                  transform: isCurrent
                    ? `scale(${1.14 + continuousBeatPulse * 0.07}) translateY(${-continuousBeatPulse * 4}px)`
                    : isSung
                    ? `scale(${1 + continuousBeatPulse * 0.015})`
                    : "translateY(10px) scale(0.97)",
                  opacity: isCurrent ? 1 : wordDist === 1 ? 0.78 : 0.32,
                  color: isCurrent
                    ? accentHex
                    : isSung
                    ? primaryHex
                    : "rgba(255, 255, 255, 0.18)",
                  textShadow: isCurrent ? `${chromaticShadow}, 6px 6px 0px rgba(0,0,0,0.8)` : isSung ? "3px 3px 0px #000000" : "none",
                  transition: "transform 0.14s cubic-bezier(0.16, 1, 0.3, 1), color 0.12s ease, opacity 0.15s ease",
                  wordBreak: "break-word",
                  willChange: "transform, opacity",
                }}
              >
                {w.text}
              </span>
            );
          })}
        </div>
      )}

      {/* -------------------------------------------------------------- */}
      {/* 5. PERSPECTIVE_3D_SNAP (Athletic 3D Tilt + Solid Extrusion)     */}
      {/* -------------------------------------------------------------- */}
      {archetype === "PERSPECTIVE_3D_SNAP" && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
            gap: typography.wordGap,
            rowGap: typography.rowGap,
            textAlign: "center",
            maxWidth: "min(88vw, 1200px)",
            maxHeight: "75vh",
            overflow: "visible",
            padding: "clamp(16px, 3.5vw, 40px)",
            boxSizing: "border-box",
            opacity: enterOpacity,
            transform: `perspective(800px) rotateX(${(1 - enterProgress) * 10 + (8 - hitPulse * 8) - continuousBeatPulse * 2.5}deg) rotateY(${-5 + hitPulse * 5}deg) scale(${0.96 + enterProgress * 0.04 + continuousBeatPulse * 0.025}) translateY(${grooveBounce * -3}px)`,
            willChange: "transform, opacity",
          }}
        >
          {words.map((w, idx) => {
            const fill = wordFill(positionMs, w);
            const isCurrent = idx === currentWordIndex;
            const isSung = fill > 0.05;
            const wordDist = Math.abs(idx - currentWordIndex);

            return (
              <span
                key={idx}
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: typography.fontSize,
                  lineHeight: typography.lineHeight,
                  textTransform: "uppercase",
                  letterSpacing: "-0.03em",
                  display: "inline-block",
                  color: isCurrent ? primaryHex : isSung ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.22)",
                  opacity: isCurrent ? 1 : wordDist === 1 ? 0.78 : 0.35,
                  textShadow: isCurrent
                    ? `4px 4px 0px #000000, 8px 8px 0px ${accentHex}, 12px 12px 0px #000000`
                    : isSung
                    ? "3px 3px 0px #000000"
                    : "none",
                  transform: isCurrent
                    ? `scale(${1.12 + continuousBeatPulse * 0.06}) translateY(${-3 - continuousBeatPulse * 4}px)`
                    : `scale(${1 + continuousBeatPulse * 0.015})`,
                  transition: "transform 0.12s cubic-bezier(0.16, 1, 0.3, 1), color 0.12s ease, opacity 0.15s ease",
                  wordBreak: "break-word",
                  willChange: "transform, opacity",
                }}
              >
                {w.text}
              </span>
            );
          })}
        </div>
      )}

      {/* -------------------------------------------------------------- */}
      {/* 6. DYNAMIC_SCALE_RAMP (Speed-Ramp Zoom On Sung Syllables)       */}
      {/* -------------------------------------------------------------- */}
      {archetype === "DYNAMIC_SCALE_RAMP" && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
            gap: typography.wordGap,
            rowGap: typography.rowGap,
            maxWidth: "min(88vw, 1200px)",
            maxHeight: "75vh",
            textAlign: "center",
            overflow: "visible",
            padding: "clamp(12px, 2.5vw, 32px)",
            boxSizing: "border-box",
            opacity: enterOpacity,
            transform: `scale(${0.96 + enterProgress * 0.04 + continuousBeatPulse * 0.03}) translateY(${(1 - enterProgress) * 10 + grooveBounce * -3}px)`,
            willChange: "transform, opacity",
          }}
        >
          {words.map((w, idx) => {
            const isCurrent = idx === currentWordIndex;
            const fill = wordFill(positionMs, w);
            const isSung = fill > 0.05;
            const wordDist = Math.abs(idx - currentWordIndex);

            return (
              <span
                key={idx}
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: typography.fontSize,
                  lineHeight: typography.lineHeight,
                  letterSpacing: "-0.04em",
                  textTransform: "uppercase",
                  display: "inline-block",
                  transform: isCurrent
                    ? `scale(${1.14 + continuousBeatPulse * 0.08}) translateY(${-3 - continuousBeatPulse * 4}px)`
                    : `scale(${1 + continuousBeatPulse * 0.015})`,
                  opacity: isCurrent ? 1 : wordDist === 1 ? 0.78 : 0.35,
                  color: isCurrent
                    ? accentHex
                    : isSung
                    ? primaryHex
                    : "rgba(255,255,255,0.2)",
                  textShadow: isCurrent
                    ? `${chromaticShadow}, 6px 6px 0px ${accentHex}88`
                    : "none",
                  transition: "transform 0.1s cubic-bezier(0.16, 1, 0.3, 1), color 0.12s ease, opacity 0.15s ease",
                  wordBreak: "break-word",
                  willChange: "transform, opacity",
                }}
              >
                {w.text}
              </span>
            );
          })}
        </div>
      )}

      {/* -------------------------------------------------------------- */}
      {/* 7. FF_TRACKING_LOCK (Optical Glyph Tracker inspired by ff-tracking) */}
      {/* -------------------------------------------------------------- */}
      {archetype === "FF_TRACKING_LOCK" && (
        <div
          ref={ffContainerRef}
          style={{
            position: "relative",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
            gap: "clamp(1.0rem, 2.2vw, 2.6rem)",
            rowGap: "clamp(2.6rem, 4.6vw, 4.4rem)",
            maxWidth: "min(88vw, 1200px)",
            maxHeight: "75vh",
            overflow: "visible",
            padding: "clamp(24px, 3.5vw, 44px)",
            boxSizing: "border-box",
            opacity: enterOpacity,
            transform: `perspective(1000px) rotateX(${8 - hitPulse * 3 - continuousBeatPulse * 2}deg) rotateY(${-4 + hitPulse * 2}deg) translateY(${(1 - enterProgress) * 12 + grooveBounce * -3}px) scale(${1 + continuousBeatPulse * 0.02})`,
            willChange: "transform, opacity",
          }}
        >
          {/* Subtle CRT Screen Scanline Overlay */}
          <div
            style={{
              position: "absolute",
              inset: "-20px -30px",
              pointerEvents: "none",
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.25) 0px, rgba(0, 0, 0, 0.25) 1px, transparent 1px, transparent 3px)",
              opacity: 0.55,
              zIndex: 0,
            }}
          />

          {/* Central Optic Lens Reticle Watermark */}
          <svg
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "360px",
              height: "360px",
              pointerEvents: "none",
              opacity: 0.12,
              zIndex: 0,
            }}
            viewBox="-180 -180 360 360"
          >
            <circle cx="0" cy="0" r="140" fill="none" stroke={ffTheme.bright} strokeWidth="1" strokeDasharray="4 6" />
            <circle cx="0" cy="0" r="70" fill="none" stroke={ffTheme.bright} strokeWidth="0.8" />
            <circle cx="0" cy="0" r="8" fill="none" stroke={ffTheme.bright} strokeWidth="1" />
            <line x1="-160" y1="0" x2="160" y2="0" stroke={ffTheme.bright} strokeWidth="1" strokeDasharray="6 6" />
            <line x1="0" y1="-160" x2="0" y2="160" stroke={ffTheme.bright} strokeWidth="1" strokeDasharray="6 6" />
          </svg>

          {/* Top Passthrough Telemetry Header */}
          <div
            style={{
              position: "absolute",
              top: "-28px",
              left: "14px",
              right: "14px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontFamily: FONT_MONO,
              fontSize: "9.5px",
              fontWeight: 700,
              letterSpacing: "0.14em",
              color: "rgba(255, 255, 255, 0.4)",
              zIndex: 1,
              textTransform: "uppercase",
            }}
          >
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <span style={{ color: ffTheme.bright }}>SYS // {ffTheme.name.toUpperCase()}</span>
              <span>FOV 35MM</span>
              <span>FPS 120</span>
              <span>LATENCY 0.8MS</span>
            </div>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <span>MODE: OPTICAL GLYPH</span>
              <span
                style={{
                  padding: "1px 6px",
                  borderRadius: "2px",
                  backgroundColor: currentWordIndex >= 0 ? `${ffTheme.bright}22` : "transparent",
                  color: currentWordIndex >= 0 ? ffTheme.bright : "rgba(255,255,255,0.4)",
                  border: `1px solid ${currentWordIndex >= 0 ? ffTheme.bright : "rgba(255,255,255,0.15)"}`,
                  fontSize: "8.5px",
                }}
              >
                {currentWordIndex >= 0 ? "TARGET ACQUIRED" : "STANDBY"}
              </span>
            </div>
          </div>

          {/* SVG Vector Connector Link Between Word Tracker Boxes */}
          {ffBoxPoints.length > 1 && (
            <svg
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                zIndex: 0,
                overflow: "visible",
              }}
            >
              {ffBoxPoints.slice(0, -1).map((p1, i) => {
                const p2 = ffBoxPoints[i + 1];
                if (!p1 || !p2) return null;
                const isLinkDone = i < currentWordIndex - 1;
                const isLinkActive = i === currentWordIndex - 1;
                const strokeColor = isLinkActive
                  ? (palette ? accentHex : ffTheme.bright)
                  : isLinkDone
                  ? ffTheme.mid
                  : "rgba(255, 255, 255, 0.12)";
                const strokeWidth = isLinkActive ? 2 : isLinkDone ? 1.5 : 1;
                const strokeDash = isLinkActive ? "4 2" : isLinkDone ? "4 3" : "3 3";
                const strokeOpacity = isLinkActive ? 0.95 : isLinkDone ? 0.65 : 0.4;

                const isSameRow = Math.abs(p1.cy - p2.cy) < 14;

                if (isSameRow) {
                  return (
                    <line
                      key={i}
                      x1={p1.right}
                      y1={p1.cy}
                      x2={p2.left}
                      y2={p2.cy}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeDasharray={strokeDash}
                      opacity={strokeOpacity}
                    />
                  );
                }

                // Clean orthogonal corner trace on wrapped rows (avoids diagonal slicing across text)
                return (
                  <g key={i}>
                    <path
                      d={`M ${p1.right} ${p1.cy} L ${p1.right + 14} ${p1.cy} L ${p1.right + 14} ${p1.cy + 10}`}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeDasharray={strokeDash}
                      opacity={strokeOpacity}
                    />
                    <path
                      d={`M ${p2.left - 14} ${p2.cy - 10} L ${p2.left - 14} ${p2.cy} L ${p2.left} ${p2.cy}`}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeDasharray={strokeDash}
                      opacity={strokeOpacity}
                    />
                  </g>
                );
              })}

              {/* Animated Glowing Tracer Dot Traveling Along Active Link */}
              {currentWordIndex > 0 && currentWordIndex < ffBoxPoints.length && (() => {
                const p1 = ffBoxPoints[currentWordIndex - 1];
                const p2 = ffBoxPoints[currentWordIndex];
                if (!p1 || !p2) return null;
                const w = words[currentWordIndex];
                const fill = w ? clamp01(wordFill(positionMs, w)) : 0;
                const activeColor = palette ? accentHex : ffTheme.bright;

                const isSameRow = Math.abs(p1.cy - p2.cy) < 18;
                let dotX = p1.right + (p2.left - p1.right) * fill;
                let dotY = p1.cy + (p2.cy - p1.cy) * fill;

                if (!isSameRow) {
                  dotX = p2.left - 24 + 24 * fill;
                  dotY = p2.cy;
                }

                return (
                  <g>
                    <circle cx={dotX} cy={dotY} r={7} fill={activeColor} opacity={0.35} />
                    <circle cx={dotX} cy={dotY} r={3} fill={ffTheme.white} />
                  </g>
                );
              })()}

              {/* Entry Node Tracer on First Word */}
              {currentWordIndex === 0 && ffBoxPoints[0] && (() => {
                const p0 = ffBoxPoints[0];
                const w0 = words[0];
                const fill = w0 ? clamp01(wordFill(positionMs, w0)) : 0;
                const activeColor = palette ? accentHex : ffTheme.bright;
                const dotX = p0.left - 22 + 22 * fill;
                const dotY = p0.cy;
                return (
                  <g>
                    <line
                      x1={p0.left - 26}
                      y1={p0.cy}
                      x2={p0.left}
                      y2={p0.cy}
                      stroke={activeColor}
                      strokeWidth={1.5}
                      strokeDasharray="3 2"
                      opacity={0.6}
                    />
                    <circle cx={dotX} cy={dotY} r={5} fill={activeColor} opacity={0.35} />
                    <circle cx={dotX} cy={dotY} r={2.5} fill={ffTheme.white} />
                  </g>
                );
              })()}
            </svg>
          )}

          {words.map((w, idx) => {
            const fill = wordFill(positionMs, w);
            const isCurrent = idx === currentWordIndex;
            const isSung = fill > 0.05;
            const isDone = idx < currentWordIndex;
            const isWordOnset = isCurrent && fill >= 0.01 && fill <= 0.45;
            const isLocked = isCurrent && (isWordOnset || hitPulse > 0.28 || pulse > 0.55 || beat.isDownbeat);

            // High-voltage tracking color: electric lock red, phosphor green / active theme
            const themeBright = palette ? accentHex : ffTheme.bright;
            const trackerColor = isLocked
              ? "#ff2a5f" // Lock-on flash red
              : isCurrent
              ? themeBright
              : isDone
              ? (palette ? primaryHex : ffTheme.white)
              : "rgba(255, 255, 255, 0.22)";

            // Bracket sizing
            const bracketSize = isLocked ? 11 : isCurrent ? 9 : 5;
            const bracketWidth = isCurrent ? "2px" : "1px";

            return (
              <div
                key={idx}
                ref={(el) => {
                  ffWordRefs.current[idx] = el;
                }}
                style={{
                  position: "relative",
                  display: "inline-flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "clamp(8px, 1.2vw, 14px) clamp(12px, 1.8vw, 22px)",
                  borderRadius: "2px",
                  background: isCurrent
                    ? `repeating-linear-gradient(45deg, ${trackerColor}26 0px, ${trackerColor}26 2px, transparent 2px, transparent 6px), ${ffTheme.dark}ee`
                    : isSung
                    ? `repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.03) 0px, rgba(255, 255, 255, 0.03) 2px, transparent 2px, transparent 6px), rgba(0, 0, 0, 0.45)`
                    : "rgba(0, 0, 0, 0.28)",
                  border: `1px solid ${
                    isCurrent
                      ? trackerColor
                      : isSung
                      ? "rgba(255, 255, 255, 0.18)"
                      : "rgba(255, 255, 255, 0.08)"
                  }`,
                  boxShadow: isCurrent
                    ? `0 0 24px ${trackerColor}44, inset 0 0 14px ${trackerColor}1c`
                    : "none",
                  transform: isCurrent
                    ? `scale(${1.1 + hitPulse * 0.04 + continuousBeatPulse * 0.05}) translateY(${-3 - continuousBeatPulse * 4}px)`
                    : isSung
                    ? `scale(${1 + continuousBeatPulse * 0.015})`
                    : "scale(0.98)",
                  transition:
                    "transform 0.12s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.14s ease, border-color 0.14s ease, box-shadow 0.14s ease",
                  zIndex: isCurrent ? 3 : 1,
                }}
              >
                {/* 4 Optical Tracker Corner Brackets (The signature ff-tracking glyph box!) */}
                {/* Top-Left */}
                <div
                  style={{
                    position: "absolute",
                    top: "-2px",
                    left: "-2px",
                    width: `${bracketSize}px`,
                    height: `${bracketSize}px`,
                    borderTop: `${bracketWidth} solid ${trackerColor}`,
                    borderLeft: `${bracketWidth} solid ${trackerColor}`,
                    transition: "border-color 0.12s ease",
                  }}
                />
                {/* Top-Right */}
                <div
                  style={{
                    position: "absolute",
                    top: "-2px",
                    right: "-2px",
                    width: `${bracketSize}px`,
                    height: `${bracketSize}px`,
                    borderTop: `${bracketWidth} solid ${trackerColor}`,
                    borderRight: `${bracketWidth} solid ${trackerColor}`,
                    transition: "border-color 0.12s ease",
                  }}
                />
                {/* Bottom-Left */}
                <div
                  style={{
                    position: "absolute",
                    bottom: "-2px",
                    left: "-2px",
                    width: `${bracketSize}px`,
                    height: `${bracketSize}px`,
                    borderBottom: `${bracketWidth} solid ${trackerColor}`,
                    borderLeft: `${bracketWidth} solid ${trackerColor}`,
                    transition: "border-color 0.12s ease",
                  }}
                />
                {/* Bottom-Right */}
                <div
                  style={{
                    position: "absolute",
                    bottom: "-2px",
                    right: "-2px",
                    width: `${bracketSize}px`,
                    height: `${bracketSize}px`,
                    borderBottom: `${bracketWidth} solid ${trackerColor}`,
                    borderRight: `${bracketWidth} solid ${trackerColor}`,
                    transition: "border-color 0.12s ease",
                  }}
                />

                {/* Reticle Crosshair Ticks for Active Tracker Box */}
                {isCurrent && (
                  <>
                    <div
                      style={{
                        position: "absolute",
                        top: "-5px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: "1px",
                        height: "4px",
                        backgroundColor: trackerColor,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        bottom: "-5px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: "1px",
                        height: "4px",
                        backgroundColor: trackerColor,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: "-5px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: "4px",
                        height: "1px",
                        backgroundColor: trackerColor,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        right: "-5px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: "4px",
                        height: "1px",
                        backgroundColor: trackerColor,
                      }}
                    />
                  </>
                )}

                {/* Top Telemetry Tag */}
                <div
                  style={{
                    position: "absolute",
                    top: "-17px",
                    left: "0",
                    fontFamily: FONT_MONO,
                    fontSize: "9px",
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    whiteSpace: "nowrap",
                    color: trackerColor,
                    opacity: isCurrent ? 1 : 0.5,
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <span>TRK.{String(idx + 1).padStart(2, "0")}</span>
                  {isCurrent && (
                    <span
                      style={{
                        padding: "1px 5px",
                        borderRadius: "2px",
                        backgroundColor: isLocked ? "#ff2a5f" : trackerColor,
                        color: "#000000",
                        textShadow: "none",
                        fontSize: "8px",
                        fontWeight: 900,
                        letterSpacing: "0.08em",
                      }}
                    >
                      {isLocked ? "LOCK" : "TRK"}
                    </span>
                  )}
                  {isDone && (
                    <span
                      style={{
                        fontSize: "7.5px",
                        color: "rgba(255, 255, 255, 0.4)",
                        fontWeight: 600,
                      }}
                    >
                      PASS
                    </span>
                  )}
                </div>

                {/* Word Glyph Content in High-Precision Monospace */}
                <span
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: typography.fontSize,
                    lineHeight: 1.0,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    fontWeight: 800,
                    color: isCurrent
                      ? ffTheme.white
                      : isSung
                      ? (palette ? primaryHex : "#ffffff")
                      : "rgba(255, 255, 255, 0.28)",
                    textShadow: isCurrent
                      ? `0 0 16px ${trackerColor}99, 2px 2px 0px #000000`
                      : "none",
                    willChange: "transform, opacity",
                  }}
                >
                  {w.text}
                </span>

                {/* Bottom Coordinate Readout */}
                <div
                  style={{
                    position: "absolute",
                    bottom: "-15px",
                    right: "0",
                    fontFamily: FONT_MONO,
                    fontSize: "8.5px",
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    whiteSpace: "nowrap",
                    color: isCurrent ? trackerColor : "rgba(255, 255, 255, 0.28)",
                    opacity: isCurrent ? 0.95 : 0.4,
                  }}
                >
                  X:{(idx * 160 + 380).toFixed(0)} Y:540 [{isCurrent ? Math.round(fill * 100) : isDone ? 100 : 0}%]
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1,
  pointerEvents: "none",
  overflow: "hidden",
  padding: "clamp(1rem, 2.5vw, 2.5rem)",
  boxSizing: "border-box",
  width: "100vw",
  height: "100vh",
};

const cornerSize = 14;
const cornerBorder = "2px solid rgba(255, 255, 255, 0.18)";

const cornerTopLeftStyle: React.CSSProperties = {
  position: "fixed",
  top: "18px",
  left: "18px",
  width: cornerSize,
  height: cornerSize,
  borderTop: cornerBorder,
  borderLeft: cornerBorder,
  pointerEvents: "none",
  zIndex: 2,
};
const cornerTopRightStyle: React.CSSProperties = {
  position: "fixed",
  top: "18px",
  right: "18px",
  width: cornerSize,
  height: cornerSize,
  borderTop: cornerBorder,
  borderRight: cornerBorder,
  pointerEvents: "none",
  zIndex: 2,
};
const cornerBottomLeftStyle: React.CSSProperties = {
  position: "fixed",
  bottom: "18px",
  left: "18px",
  width: cornerSize,
  height: cornerSize,
  borderBottom: cornerBorder,
  borderLeft: cornerBorder,
  pointerEvents: "none",
  zIndex: 2,
};
const cornerBottomRightStyle: React.CSSProperties = {
  position: "fixed",
  bottom: "18px",
  right: "18px",
  width: cornerSize,
  height: cornerSize,
  borderBottom: cornerBorder,
  borderRight: cornerBorder,
  pointerEvents: "none",
  zIndex: 2,
};

const letterboxTopStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  height: "50px",
  background: "linear-gradient(to bottom, rgba(0,0,0,0.45), transparent)",
  pointerEvents: "none",
  zIndex: 1,
};

const letterboxBottomStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  height: "50px",
  background: "linear-gradient(to top, rgba(0,0,0,0.5), transparent)",
  pointerEvents: "none",
  zIndex: 1,
};

const editHudStyle: React.CSSProperties = {
  position: "fixed",
  bottom: "16px",
  left: "36px",
  display: "flex",
  gap: "18px",
  fontFamily: FONT_BODY,
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.14em",
  color: "rgba(255, 255, 255, 0.45)",
  textTransform: "uppercase",
  pointerEvents: "none",
  zIndex: 2,
};
