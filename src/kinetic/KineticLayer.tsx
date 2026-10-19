import React from "react";
import "@fontsource/archivo-black/latin-400.css";
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-700.css";

import { useKineticSignals } from "./signalStore";
import { AmbientBackground } from "./AmbientBackground";
import { KineticScene } from "./KineticScene";

export const KineticLayer: React.FC = () => {
  const s = useKineticSignals();

  const activeLine =
    s.activeLineIndex >= 0 && s.activeLineIndex < s.lines.length
      ? s.lines[s.activeLineIndex]
      : null;

  const nextLine =
    s.activeLineIndex + 1 < s.lines.length ? s.lines[s.activeLineIndex + 1] : null;

  const prevLine =
    s.activeLineIndex > 0 ? s.lines[s.activeLineIndex - 1] : null;

  return (
    <div
      id="kinetic-layer"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        overflow: "hidden",
      }}
      aria-hidden="true"
    >
      {/* Dynamic ambient backdrop (zero-GPU) */}
      <AmbientBackground
        palette={s.mood?.palette ?? null}
        energy={s.energy}
        bands={s.bands}
        positionMs={s.positionMs}
        paused={s.paused}
      />

      {/* Kinetic Typography Scene */}
      <KineticScene
        key={`${s.activeLineIndex}-${s.trackName ?? ""}`}
        activeLine={activeLine}
        nextLine={nextLine}
        prevLine={prevLine}
        positionMs={s.positionMs}
        activeLineIndex={s.activeLineIndex}
        totalLines={s.lines.length}
        energy={s.energy}
        bands={s.bands}
        mood={s.mood}
        paused={s.paused}
        trackName={s.trackName}
        artistName={s.artistName}
        lyricsMode={s.lyricsMode}
      />
    </div>
  );
};
