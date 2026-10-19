/**
 * Standalone test harness for Kinetic Typography.
 * Loaded by lyric-test.html (vite dev / build). Drives the component with
 * deterministic fake props at a fixed ?pos= so screenshots and tests are reproducible.
 *
 * URL params:
 *   ?pos=12000     playback position ms
 *   ?mode=synced   lyricsMode override
 *   ?paused=1      freeze sung progress
 *   ?energy=0.7    mic energy 0..1
 *   ?bass=0.5&mid=..&treble=..
 */
import { createRoot } from "react-dom/client";
import "@fontsource/archivo-black/latin-400.css";
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-700.css";

import { KineticScene } from "./kinetic/KineticScene";
import { AmbientBackground } from "./kinetic/AmbientBackground";
import { moodFromTrack } from "./kinetic/mood";

const q = new URLSearchParams(location.search);
const pos = parseFloat(q.get("pos") ?? "4500");
const mode = (q.get("mode") as any) || "synced";
const paused = q.get("paused") === "1";
const energy = parseFloat(q.get("energy") ?? "0.7");
const bands = {
  bass: parseFloat(q.get("bass") ?? "0.6"),
  mid: parseFloat(q.get("mid") ?? "0.4"),
  treble: parseFloat(q.get("treble") ?? "0.5"),
};

const mood = moodFromTrack("Midnight City|M83");

const lines = [
  { timeMs: 0, text: "I'm good, I'm great" },
  { timeMs: 4000, text: "Had to check the safe, check the dresser for my chains" },
  { timeMs: 9000, text: "Woke up by a girl, I don't even know her name" },
  { timeMs: 14000, text: "Paranoid" },
];

function activeIdx(ls: { timeMs: number }[], p: number) {
  let lo = 0,
    hi = ls.length - 1,
    ans = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (ls[m].timeMs <= p) {
      ans = m;
      lo = m + 1;
    } else {
      hi = m - 1;
    }
  }
  return ans;
}

const activeIndex = mode === "synced" ? activeIdx(lines, pos) : -1;
const activeLine = activeIndex >= 0 ? lines[activeIndex] : null;
const nextLine = activeIndex + 1 < lines.length ? lines[activeIndex + 1] : null;
const prevLine = activeIndex > 0 ? lines[activeIndex - 1] : null;

const el = document.getElementById("test-root")!;
createRoot(el).render(
  <div style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
    <AmbientBackground
      palette={mood.palette}
      energy={energy}
      bands={bands}
      positionMs={pos}
      paused={paused}
    />
    <KineticScene
      activeLine={activeLine}
      nextLine={nextLine}
      prevLine={prevLine}
      positionMs={pos}
      activeLineIndex={activeIndex}
      totalLines={lines.length}
      energy={energy}
      bands={bands}
      mood={mood}
      paused={paused}
      trackName="Midnight City"
      artistName="M83"
      lyricsMode={mode}
    />
  </div>
);
