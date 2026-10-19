import React from "react";
import type { MoodPalette } from "./mood";
import { rgbCss, calculateBeatClock } from "./timing";

interface BeatReactorProps {
  palette: MoodPalette | null;
  energy: number;
  bands: { bass: number; mid: number; treble: number };
  pulse: number;
  trackName: string | null;
  artistName: string | null;
  positionMs: number;
}

const FONT_DISPLAY = "'Archivo Black', sans-serif";
const FONT_BODY = "'Space Grotesk', sans-serif";

export const BeatReactor: React.FC<BeatReactorProps> = ({
  palette,
  energy,
  bands,
  pulse: passedPulse,
  trackName,
  artistName,
  positionMs,
}) => {
  const accentHex = palette ? rgbCss(palette.accent) : "#ff3366";
  const primaryHex = palette ? rgbCss(palette.primary) : "#ffffff";
  const counterHex = palette ? rgbCss(palette.counter) : "rgba(255,255,255,0.4)";

  // 4/4 Beat Rhythm Clock
  const beat = calculateBeatClock(positionMs, 124);
  const pulse = Math.max(passedPulse, beat.pulse, bands.bass);

  // Dynamic chromatic split on heavy kicks
  const splitOffset = pulse > 0.55 ? (pulse - 0.55) * 14 : 0;

  // Formatting timecode
  const mins = Math.floor(positionMs / 60000);
  const secs = Math.floor((positionMs % 60000) / 1000);
  const timecode = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  // Responsive track title typography: guaranteed never to exceed viewport width
  const rawTitle = (trackName || "BEAT BREAK").trim();
  const titleLen = rawTitle.length;
  const titleFontSize =
    titleLen <= 8
      ? "clamp(3rem, 10.5vw, 8rem)"
      : titleLen <= 16
      ? "clamp(2.2rem, 7vw, 5.2rem)"
      : "clamp(1.6rem, 4.8vw, 3.8rem)";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        pointerEvents: "none",
        zIndex: 1,
        padding: "clamp(1rem, 2.5vw, 2.5rem)",
        boxSizing: "border-box",
        overflow: "hidden",
        width: "100vw",
        height: "100vh",
      }}
    >
      {/* Top Banner: Minimal Brutalist Timecode & Meter */}
      <div
        style={{
          width: "100%",
          maxWidth: "92vw",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: FONT_BODY,
          fontSize: "clamp(0.7rem, 1.1vw, 0.95rem)",
          fontWeight: 700,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "rgba(255, 255, 255, 0.5)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              display: "inline-block",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: beat.isDownbeat ? accentHex : "rgba(255,255,255,0.4)",
              boxShadow: beat.isDownbeat ? `0 0 12px ${accentHex}` : "none",
              transition: "all 0.08s ease-out",
            }}
          />
          <span>RHYTHM DROP // 4/4</span>
        </div>

        <div style={{ display: "flex", gap: "20px" }}>
          <span>BAR {String(beat.bar).padStart(2, "0")}</span>
          <span style={{ color: primaryHex }}>{timecode}</span>
        </div>
      </div>

      {/* Centerpiece: Monumental Track Typography & Reactive Beat Towers */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          maxWidth: "92vw",
          maxHeight: "68vh",
          transform: `scale(${1 + pulse * 0.05})`,
          transition: "transform 0.08s cubic-bezier(0.16, 1, 0.3, 1)",
          willChange: "transform",
        }}
      >
        {/* Responsive Track Title */}
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: titleFontSize,
            lineHeight: 0.92,
            textTransform: "uppercase",
            letterSpacing: "-0.04em",
            color: primaryHex,
            textAlign: "center",
            maxWidth: "92vw",
            textShadow:
              splitOffset > 0
                ? `${splitOffset}px 0px 0px ${accentHex}, -${splitOffset}px 0px 0px ${counterHex}`
                : "none",
            wordBreak: "break-word",
            overflowWrap: "break-word",
          }}
        >
          {rawTitle}
        </div>

        {/* Artist Credit */}
        {artistName && (
          <div
            style={{
              fontFamily: FONT_BODY,
              fontSize: "clamp(0.85rem, 1.8vw, 1.6rem)",
              color: "rgba(255, 255, 255, 0.6)",
              fontWeight: 700,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              marginTop: "clamp(0.8rem, 2vw, 1.6rem)",
              textAlign: "center",
              maxWidth: "88vw",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {artistName}
          </div>
        )}

        {/* High-Impact Brutalist Equalizer Towers (20 dynamic columns) */}
        <div
          style={{
            display: "flex",
            gap: "clamp(3px, 0.7vw, 8px)",
            alignItems: "flex-end",
            height: "clamp(28px, 6vh, 60px)",
            marginTop: "clamp(1.4rem, 3vw, 2.6rem)",
            maxWidth: "90vw",
          }}
        >
          {[
            0.5, 0.8, 1.0, 0.7, 0.9, 0.6, 1.0, 0.85, 0.4, 0.95,
            0.95, 0.4, 0.85, 1.0, 0.6, 0.9, 0.7, 1.0, 0.8, 0.5,
          ].map((mult, i) => {
            const barH = 6 + pulse * 50 * mult + energy * 12;
            const isHighlight = i % 4 === beat.measureBeat;
            return (
              <div
                key={i}
                style={{
                  width: "clamp(5px, 1.1vw, 12px)",
                  height: `${barH}px`,
                  backgroundColor: isHighlight ? accentHex : "rgba(255, 255, 255, 0.75)",
                  boxShadow: isHighlight && pulse > 0.6 ? `0 0 12px ${accentHex}` : "none",
                  transition: "height 0.06s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.1s ease",
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Bottom Controls: 4-Beat Measure Indicator & Subtext */}
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "clamp(0.6rem, 1.2vw, 1rem)",
        }}
      >
        {/* 4-Beat Measure Steps */}
        <div
          style={{
            display: "flex",
            gap: "clamp(6px, 1vw, 12px)",
            fontFamily: FONT_BODY,
            fontSize: "clamp(0.75rem, 1.2vw, 1rem)",
            fontWeight: 800,
            letterSpacing: "0.15em",
          }}
        >
          {[0, 1, 2, 3].map((b) => {
            const isActive = beat.measureBeat === b;
            return (
              <div
                key={b}
                style={{
                  padding: "0.3em 0.8em",
                  border: `2px solid ${isActive ? accentHex : "rgba(255, 255, 255, 0.2)"}`,
                  backgroundColor: isActive ? accentHex : "transparent",
                  color: isActive ? "#000000" : "rgba(255, 255, 255, 0.45)",
                  transform: isActive ? "scale(1.08)" : "scale(1)",
                  transition: "all 0.08s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                0{b + 1}
              </div>
            );
          })}
        </div>

        {/* Sleek Rhythmic Subtext */}
        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: "clamp(0.65rem, 0.9vw, 0.8rem)",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: "rgba(255, 255, 255, 0.35)",
            fontWeight: 600,
          }}
        >
          /// LIVE SYNCHRONIZED AUDIO VISUALIZER ///
        </div>
      </div>
    </div>
  );
};
