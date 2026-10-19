export interface Track {
  id: string;
  name: string;
  artists: string[];
  album: string;
  albumArt: string | null;
  duration_ms: number;
  uri: string;
  isLocal: boolean;
}

export interface LyricLine {
  timeMs: number;
  text: string;
}

export type LyricsMode =
  | "none"
  | "loading"
  | "synced"
  | "plain"
  | "instrumental";

export type PlaybackMode = "sdk" | "watcher" | "idle";

export type PlaybackSource = "sdk" | "watcher" | null;

export interface DjVisualTrack {
  name: string;
  artist: string;
  albumArtUrl?: string;
  id?: string;
}

export interface DjVisualLine {
  time_ms: number;
  text: string;
  words?: Array<{ time_ms: number; text: string }>;
}

// The shape the visuals layer consumes on window.__dj.
export interface DjVisualState {
  position_ms: number;
  duration_ms: number;
  paused: boolean;
  track: DjVisualTrack | undefined;
  activeLineIndex: number;
  lines: DjVisualLine[];
  energy: number[];
}

export interface AppState {
  mode: PlaybackMode;
  source: PlaybackSource;
  track: Track | null;
  paused: boolean;
  position_ms: number;
  duration_ms: number;
  lines: LyricLine[];
  activeLineIndex: number;
  lyricsMode: LyricsMode;
  plainLyrics: string | null;
  energy: number;
  bands: { bass: number; mid: number; treble: number };
  spectrum: number[];
  beat: number;
  lastPositionPollAt: number;
  basePositionMs: number;
  basePositionAt: number;
  sdkPositionMs: number;
  sdkPositionAt: number;
  sdkPlaying: boolean;
  watcherTrackKey: string | null;
  lastTrackKey: string | null;
  statusMessage: string;
  error: string | null;
  auth: {
    loggedIn: boolean;
    userName: string | null;
    product: string | null;
  };
  syncOffsetMs: number;
}

const initialSyncOffset = (() => {
  try {
    const val = localStorage.getItem("lfg_dj_sync_offset_ms");
    return val ? parseInt(val, 10) || 0 : 0;
  } catch {
    return 0;
  }
})();

const state: AppState = {
  mode: "idle",
  source: null,
  track: null,
  paused: true,
  position_ms: 0,
  duration_ms: 0,
  lines: [],
  activeLineIndex: -1,
  lyricsMode: "none",
  plainLyrics: null,
  energy: 0,
  bands: { bass: 0, mid: 0, treble: 0 },
  spectrum: [],
  beat: 0,
  lastPositionPollAt: 0,
  basePositionMs: 0,
  basePositionAt: 0,
  sdkPositionMs: 0,
  sdkPositionAt: 0,
  sdkPlaying: false,
  watcherTrackKey: null,
  lastTrackKey: null,
  statusMessage: "Starting up…",
  error: null,
  auth: { loggedIn: false, userName: null, product: null },
  syncOffsetMs: initialSyncOffset,
};

export function getState(): AppState {
  return state;
}

export function setState(partial: Partial<AppState>): void {
  Object.assign(state, partial);
}

export function setSyncOffset(offsetMs: number): void {
  state.syncOffsetMs = offsetMs;
  try {
    localStorage.setItem("lfg_dj_sync_offset_ms", String(offsetMs));
  } catch {}
}

export function trackKey(t: Track | null): string | null {
  if (!t) return null;
  return `${t.id}|${t.name}|${t.artists.join(",")}|${t.duration_ms}`;
}

declare global {
  interface Window {
    __dj?: DjVisualState;
    __djState?: AppState;
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: any;
  }
}

export function publishDjState(): DjVisualState {
  const t = state.track;
  const pub: DjVisualState = {
    position_ms: state.position_ms,
    duration_ms: state.duration_ms,
    paused: state.paused,
    track: t
      ? {
          name: t.name,
          artist: t.artists.join(", "),
          albumArtUrl: t.albumArt ?? undefined,
          id: t.id,
        }
      : undefined,
    activeLineIndex: state.activeLineIndex,
    lines: state.lines.map((l) => ({ time_ms: l.timeMs, text: l.text })),
    energy: state.spectrum,
  };
  window.__dj = pub;
  window.__djState = state;
  return pub;
}
