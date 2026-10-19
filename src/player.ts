import { api, getAccessToken } from "./auth";
import { getState, setState, trackKey, type Track } from "./state";

export type ModePreference = "sdk" | "watcher";

const WATCHER_POLL_MS = 1000;

let watcherTimer: number | null = null;
let sdkPlayer: any = null;
let sdkDeviceId: string | null = null;
let sdkReady = false;
let sdkScriptLoading = false;
let modePref: ModePreference = "watcher";

type TrackChangeHandler = (t: Track | null) => void;
let onTrackChange: TrackChangeHandler = () => {};
export function setTrackChangeHandler(fn: TrackChangeHandler) {
  onTrackChange = fn;
}

function mapSpotifyTrack(item: any): Track {
  return {
    id: item?.id ?? "",
    name: item?.name ?? "Unknown",
    artists: Array.isArray(item?.artists)
      ? item.artists.map((a: any) => a?.name ?? "")
      : [],
    album: item?.album?.name ?? "",
    albumArt:
      item?.album?.images?.[0]?.url ?? item?.album?.images?.[1]?.url ?? null,
    duration_ms: item?.duration_ms ?? 0,
    uri: item?.uri ?? "",
    isLocal: !!item?.is_local,
  };
}

export function estimateRawPositionMs(now: number = performance.now()): number {
  const s = getState();
  if (s.paused) return Math.max(0, s.basePositionMs);
  const elapsed = Math.max(0, now - s.basePositionAt);
  const dur = s.duration_ms > 0 ? s.duration_ms : Infinity;
  return Math.min(dur, Math.max(0, s.basePositionMs + elapsed));
}

export function estimatePositionMs(now: number = performance.now()): number {
  const s = getState();
  const raw = estimateRawPositionMs(now);
  const offset = s.syncOffsetMs ?? 0;
  return Math.max(0, raw + offset);
}

function updateTrack(t: Track | null): void {
  const prevKey = getState().lastTrackKey;
  const key = trackKey(t);
  setState({ track: t, duration_ms: t?.duration_ms ?? 0, lastTrackKey: key });
  if (key !== prevKey) onTrackChange(t);
}

export async function setMode(pref: ModePreference): Promise<void> {
  modePref = pref;
  setState({ mode: pref });
  if (pref === "sdk") {
    stopWatcher();
    await ensureSdk();
    if (!sdkReady || !sdkDeviceId) {
      setState({
        statusMessage:
          "Web Playback SDK not ready yet — watching your other Spotify device meanwhile.",
      });
      startWatcher();
      return;
    }
    setState({ source: "sdk" });
  } else {
    await teardownSdk();
    startWatcher();
  }
}

export function getModePref(): ModePreference {
  return modePref;
}

function loadSdkScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Spotify) {
      resolve();
      return;
    }
    if (sdkScriptLoading) {
      const check = () => (window.Spotify ? resolve() : setTimeout(check, 200));
      check();
      return;
    }
    sdkScriptLoading = true;
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load Spotify SDK"));
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    document.head.appendChild(script);
  });
}

async function ensureSdk(): Promise<void> {
  if (sdkPlayer) return;
  try {
    await loadSdkScript();
  } catch (e) {
    setState({ error: `Spotify SDK load failed: ${e}` });
    return;
  }
  sdkPlayer = new window.Spotify.Player({
    name: "LFG DJ",
    getOAuthToken: async (cb: (t: string) => void) => {
      const t = await getAccessToken();
      if (t) cb(t);
    },
    volume: 0.7,
  });

  sdkPlayer.addListener("ready", ({ device_id }: any) => {
    sdkDeviceId = device_id;
    sdkReady = true;
    setState({
      source: "sdk",
      statusMessage: "LFG DJ device ready — transfer playback or press play in Spotify.",
    });
    transferPlaybackHere().catch(() => {});
    stopWatcher();
  });
  sdkPlayer.addListener("not_ready", () => {
    sdkReady = false;
    sdkDeviceId = null;
    if (modePref === "sdk") startWatcher();
  });
  sdkPlayer.addListener(
    "player_state_changed",
    (ps: any) => {
      if (!ps) return;
      const item = ps.track_window?.current_track;
      const t = item ? mapSpotifyTrack(item) : null;
      const st = getState();
      if (st.source !== "sdk") setState({ source: "sdk" });
      const now = performance.now();
      const pos = ps.position ?? 0;
      setState({
        paused: ps.paused,
        basePositionMs: pos,
        basePositionAt: now,
        position_ms: pos,
        sdkPositionMs: pos,
        sdkPositionAt: now,
        sdkPlaying: !ps.paused,
        duration_ms: ps.duration ?? t?.duration_ms ?? 0,
      });
      updateTrack(t);
    }
  );
  sdkPlayer.addListener("initialization_error", ({ message }: any) =>
    setState({ error: `SDK init: ${message}` })
  );
  sdkPlayer.addListener("authentication_error", ({ message }: any) =>
    setState({ error: `SDK auth: ${message}` })
  );
  sdkPlayer.addListener("account_error", ({ message }: any) =>
    setState({
      error: `SDK account error (Spotify Premium required): ${message}`,
    })
  );
  sdkPlayer.addListener("playback_error", ({ message }: any) =>
    setState({ error: `SDK playback: ${message}` })
  );

  const ok = await sdkPlayer.connect();
  if (!ok) setState({ error: "Could not connect Web Playback SDK" });
}

async function teardownSdk(): Promise<void> {
  try {
    if (sdkPlayer) await sdkPlayer.disconnect();
  } catch {}
  sdkPlayer = null;
  sdkReady = false;
  sdkDeviceId = null;
}

export async function transferPlaybackHere(): Promise<void> {
  if (!sdkDeviceId) return;
  const res = await api("/v1/me/player", {
    method: "PUT",
    body: JSON.stringify({ device_ids: [sdkDeviceId], play: true }),
  });
  if (!res.ok && res.status !== 204) {
    console.warn("transfer playback failed", res.status);
  }
}

export async function sdkTogglePlay(): Promise<void> {
  if (sdkPlayer) await sdkPlayer.togglePlay();
}
export async function sdkNext(): Promise<void> {
  if (sdkPlayer) await sdkPlayer.nextTrack();
}
export async function sdkPrev(): Promise<void> {
  if (sdkPlayer) await sdkPlayer.previousTrack();
}
export async function sdkSeek(ms: number): Promise<void> {
  if (sdkPlayer) {
    await sdkPlayer.seek(ms);
    const now = performance.now();
    setState({
      basePositionMs: ms,
      basePositionAt: now,
      position_ms: ms,
      sdkPositionMs: ms,
      sdkPositionAt: now,
    });
  }
}

export function startWatcher(): void {
  if (watcherTimer !== null) return;
  setState({ source: "watcher" });
  pollOnce().catch(() => {});
  watcherTimer = window.setInterval(() => {
    pollOnce().catch((e) => console.warn("watcher poll", e));
  }, WATCHER_POLL_MS);
}

export function stopWatcher(): void {
  if (watcherTimer !== null) {
    window.clearInterval(watcherTimer);
    watcherTimer = null;
  }
}

async function pollOnce(): Promise<void> {
  const t0 = performance.now();
  let res: Response;
  try {
    res = await api("/v1/me/player?additional_types=track");
  } catch (e) {
    setState({ error: `Watcher: ${e}` });
    return;
  }
  const t1 = performance.now();
  if (res.status === 204) {
    const s = getState();
    if (s.track || s.source !== "watcher" || s.paused === false) {
      setState({ paused: true, statusMessage: "Nothing playing on Spotify." });
      updateTrack(null);
    }
    return;
  }
  if (!res.ok) {
    if (res.status !== 401) {
      setState({ error: `Watcher poll ${res.status}` });
    }
    return;
  }
  const j = await res.json();
  const item = j?.item;
  const t = item && item.type === "track" ? mapSpotifyTrack(item) : null;
  const progress = typeof j?.progress_ms === "number" ? j.progress_ms : 0;
  const isPlaying = !!j?.is_playing;

  // Cristian's Algorithm for network round-trip flight compensation:
  // Using high-resolution monotonic performance.now() - 100% immune to OS clock skew/NTP drift!
  const rtt = Math.max(0, t1 - t0);
  const halfRtt = Math.min(600, rtt / 2);
  const realProgress = progress + (isPlaying ? halfRtt : 0);

  const rawEst = estimateRawPositionMs(t1);
  const drift = realProgress - rawEst;
  const st = getState();
  const newTrack = trackKey(t) !== st.lastTrackKey;

  // 1. Hard snap when track changes, play/pause state flips, or major seek occurs (> 1000ms)
  if (newTrack || st.paused !== isPlaying || Math.abs(drift) > 1000) {
    setState({
      basePositionMs: realProgress,
      basePositionAt: t1,
      position_ms: realProgress + (st.syncOffsetMs ?? 0),
      lastPositionPollAt: t1,
      paused: !isPlaying,
    });
  } else if (Math.abs(drift) > 180) {
    // 2. Smooth drift correction for subtle clock skew (nudges 35% without visual jerk)
    const correctedBase = rawEst + drift * 0.35;
    setState({
      basePositionMs: correctedBase,
      basePositionAt: t1,
      position_ms: correctedBase + (st.syncOffsetMs ?? 0),
      lastPositionPollAt: t1,
      paused: !isPlaying,
    });
  } else {
    // 3. Within normal jitter band (< 180ms) - continuous quartz lockstep without jitter
    setState({ lastPositionPollAt: t1, paused: !isPlaying });
  }
  updateTrack(t);
}

export async function watcherPlayPause(): Promise<void> {
  const s = getState();
  const endpoint = s.paused ? "/v1/me/player/play" : "/v1/me/player/pause";
  await api(endpoint, { method: "PUT" });
  pollOnce().catch(() => {});
}
export async function watcherNext(): Promise<void> {
  await api("/v1/me/player/next", { method: "POST" });
  setTimeout(() => pollOnce().catch(() => {}), 300);
}
export async function watcherPrev(): Promise<void> {
  await api("/v1/me/player/previous", { method: "POST" });
  setTimeout(() => pollOnce().catch(() => {}), 300);
}
export async function watcherSeek(ms: number): Promise<void> {
  await api(`/v1/me/player/seek?position_ms=${Math.floor(ms)}`, {
    method: "PUT",
  });
  const now = performance.now();
  setState({
    basePositionMs: ms,
    basePositionAt: now,
    position_ms: ms,
    lastPositionPollAt: now,
  });
  setTimeout(() => pollOnce().catch(() => {}), 300);
}

export async function transport(action: "playpause" | "next" | "prev"): Promise<void> {
  const s = getState();
  if (s.source === "sdk" && sdkPlayer) {
    if (action === "playpause") return sdkTogglePlay();
    if (action === "next") return sdkNext();
    if (action === "prev") return sdkPrev();
  } else {
    if (action === "playpause") return watcherPlayPause();
    if (action === "next") return watcherNext();
    if (action === "prev") return watcherPrev();
  }
}

export async function seek(ms: number): Promise<void> {
  const s = getState();
  if (s.source === "sdk" && sdkPlayer) return sdkSeek(ms);
  return watcherSeek(ms);
}

export function currentSdkDeviceId(): string | null {
  return sdkDeviceId;
}
