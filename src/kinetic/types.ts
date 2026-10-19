import type { Mood } from "./mood";

export type KineticArchetype =
  | "STACCATO_BURST"
  | "WHIP_DIRECTIONAL_SLAM"
  | "INVERTED_COLOR_STROBE"
  | "WORD_CASCADE_STACK"
  | "PERSPECTIVE_3D_SNAP"
  | "DYNAMIC_SCALE_RAMP"
  | "FF_TRACKING_LOCK";

export interface KineticLineData {
  timeMs: number;
  text: string;
}

export interface KineticSignals {
  positionMs: number;
  durationMs: number;
  paused: boolean;
  lines: KineticLineData[];
  activeLineIndex: number;
  lyricsMode: "none" | "loading" | "synced" | "plain" | "instrumental";
  plainLyrics: string | null;
  energy: number;
  bands: { bass: number; mid: number; treble: number };
  mood: Mood | null;
  trackName: string | null;
  artistName: string | null;
}
