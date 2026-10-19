import { useSyncExternalStore } from "react";
import { moodFromTrack, type Mood } from "./mood";
import type { KineticSignals, KineticLineData } from "./types";

interface DjStatePeek {
  position_ms?: number;
  duration_ms?: number;
  paused?: boolean;
  track?: { id?: string; name?: string; artists?: string[] } | null;
  lines?: Array<{ timeMs?: number; time_ms?: number; text: string }>;
  activeLineIndex?: number;
  lyricsMode?: "none" | "loading" | "synced" | "plain" | "instrumental";
  plainLyrics?: string | null;
  energy?: number;
  bands?: { bass?: number; mid?: number; treble?: number };
}

const FALLBACK_BANDS = { bass: 0, mid: 0, treble: 0 };

const EMPTY: KineticSignals = {
  positionMs: 0,
  durationMs: 0,
  paused: true,
  lines: [],
  activeLineIndex: -1,
  lyricsMode: "none",
  plainLyrics: null,
  energy: 0,
  bands: FALLBACK_BANDS,
  mood: null,
  trackName: null,
  artistName: null,
};

let snapshot: KineticSignals = EMPTY;
let lastMoodKey = "";
let lastMood: Mood | null = null;
const listeners = new Set<() => void>();
let rafId: number | null = null;

function readDj(): DjStatePeek | undefined {
  if (typeof window === "undefined") return undefined;
  const win = window as any;
  const raw = win.__djState;
  if (raw && typeof raw === "object") return raw as DjStatePeek;
  return win.__dj as DjStatePeek | undefined;
}

function tick(): void {
  const dj = readDj();
  if (!dj) {
    if (snapshot !== EMPTY) {
      snapshot = EMPTY;
      emit();
    }
    rafId = requestAnimationFrame(tick);
    return;
  }

  const track = dj.track ?? null;
  const trackName = track?.name ?? null;
  const artistName = track?.artists ? track.artists.join(", ") : (track as any)?.artist ?? null;
  const trackKey = track ? `${trackName ?? ""}|${artistName ?? ""}` : null;

  if (trackKey !== lastMoodKey) {
    lastMoodKey = trackKey ?? "";
    lastMood = trackKey ? moodFromTrack(trackKey) : null;
  }

  const rawLines = dj.lines ?? [];
  const normalizedLines: KineticLineData[] = rawLines.map((l) => ({
    timeMs: l.timeMs ?? l.time_ms ?? 0,
    text: l.text,
  }));

  snapshot = {
    positionMs: Math.max(0, dj.position_ms ?? 0),
    durationMs: Math.max(0, dj.duration_ms ?? 0),
    paused: !!dj.paused,
    lines: normalizedLines,
    activeLineIndex: dj.activeLineIndex ?? -1,
    lyricsMode: dj.lyricsMode ?? (normalizedLines.length > 0 ? "synced" : "none"),
    plainLyrics: dj.plainLyrics ?? null,
    energy: typeof dj.energy === "number" ? dj.energy : 0,
    bands: {
      bass: dj.bands?.bass ?? 0,
      mid: dj.bands?.mid ?? 0,
      treble: dj.bands?.treble ?? 0,
    },
    mood: lastMood,
    trackName,
    artistName,
  };

  emit();
  rafId = requestAnimationFrame(tick);
}

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  if (rafId === null) rafId = requestAnimationFrame(tick);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
}

export function useKineticSignals(): KineticSignals {
  return useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
}
