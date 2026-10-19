import { getState, setState, type LyricLine, type Track } from "./state";

const LRCLIB_BASE = "https://lrclib.net";

let fetchSeq = 0;

const OFFSET_RE = /^\[offset:\s*([+-]?\d+)\]/i;

/**
 * Strips noise from Spotify track titles so LRClib searches match reliably:
 * "Song Name - 2021 Remaster" -> "Song Name"
 * "Song Name (feat. Artist)" -> "Song Name"
 */
export function cleanTrackTitle(title: string): string {
  return title
    .replace(/\s*-\s*(remaster(ed)?(\s*\d+)?|live|acoustic|deluxe|radio edit|bonus track|instrumental).*$/i, "")
    .replace(/\s*[\(\[](feat\.|featuring|with|remaster(ed)?(\s*\d+)?|live|deluxe)[\s\S]*?[\)\]]/gi, "")
    .trim();
}

export function parseLrc(lrc: string): LyricLine[] {
  let fileOffsetMs = 0;
  const rawLines = lrc.split(/\r?\n/);

  // Check for LRC header offset metadata
  for (const raw of rawLines) {
    const line = raw.trim();
    if (!line) continue;
    const offM = OFFSET_RE.exec(line);
    if (offM) {
      fileOffsetMs = parseInt(offM[1], 10) || 0;
      break;
    }
  }

  const out: LyricLine[] = [];
  const TIME_TAG_RE = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

  for (const raw of rawLines) {
    const line = raw.trim();
    if (!line) continue;

    // Support multi-timestamp repeated lines (e.g. "[00:15.00][00:25.00] Oh oh oh")
    const timeMatches = [...line.matchAll(TIME_TAG_RE)];
    if (timeMatches.length === 0) continue;

    const text = line.replace(TIME_TAG_RE, "").trim();

    // Only keep lines with actual sung lyrics.
    // Skip empty break lines, music symbols (♪, ♫), dashes, or instrumental tags
    // so they do not cause sudden 500ms flashes of the track title.
    if (
      !text ||
      /^[♪♫\-\_\s\.\,]+$/.test(text) ||
      /^\(?(instrumental|guitar solo|solo|intro|outro|music)\)?$/i.test(text)
    ) {
      continue;
    }

    for (const m of timeMatches) {
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      const frac = m[3] ? parseInt(m[3].padEnd(3, "0"), 10) : 0;
      const rawTimeMs = min * 60_000 + sec * 1000 + frac;
      const timeMs = Math.max(0, rawTimeMs - fileOffsetMs);
      out.push({ timeMs, text });
    }
  }
  out.sort((a, b) => a.timeMs - b.timeMs);
  return out;
}

// Vocal anticipation lead: kinetic typography transitions (slam, whip, snap)
// take ~120ms to hit full visual impact. Leading by 120ms aligns the visual landing
// with the exact acoustic onset of the vocal transient.
const VOCAL_LEAD_MS = 120;

export function activeLineIndexAt(lines: LyricLine[], positionMs: number): number {
  if (lines.length === 0) return -1;
  const effectiveMs = positionMs + VOCAL_LEAD_MS;
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].timeMs <= effectiveMs) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

interface LrcLibResult {
  id?: number;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

export async function fetchLyrics(track: Track): Promise<void> {
  const seq = ++fetchSeq;
  setState({ lyricsMode: "loading", lines: [], activeLineIndex: -1, plainLyrics: null });
  const artist = track.artists[0] ?? "";
  const cleanedTitle = cleanTrackTitle(track.name);
  const targetDuration = Math.round(track.duration_ms / 1000);

  // 1. Try exact match with cleaned title
  try {
    const cleanParams = new URLSearchParams({
      track_name: cleanedTitle,
      artist_name: artist,
      duration: String(targetDuration),
    });
    const res = await fetch(`${LRCLIB_BASE}/api/get?${cleanParams.toString()}`, {
      headers: { Accept: "application/json" },
    });
    if (seq !== fetchSeq) return;
    if (res.ok) {
      const j = (await res.json()) as LrcLibResult;
      if (j && (j.syncedLyrics || j.plainLyrics || j.instrumental)) {
        applyLrcResult(j, track, seq);
        return;
      }
    }
  } catch {}

  // 2. Try exact match with raw Spotify title
  if (cleanedTitle !== track.name) {
    try {
      const rawParams = new URLSearchParams({
        track_name: track.name,
        artist_name: artist,
        duration: String(targetDuration),
      });
      const res = await fetch(`${LRCLIB_BASE}/api/get?${rawParams.toString()}`, {
        headers: { Accept: "application/json" },
      });
      if (seq !== fetchSeq) return;
      if (res.ok) {
        const j = (await res.json()) as LrcLibResult;
        if (j && (j.syncedLyrics || j.plainLyrics || j.instrumental)) {
          applyLrcResult(j, track, seq);
          return;
        }
      }
    } catch {}
  }

  // 3. Fallback to search
  await searchLyrics(track, cleanedTitle, seq).catch(() => {
    if (seq === fetchSeq) setState({ lyricsMode: "none" });
  });
}

async function searchLyrics(track: Track, cleanedTitle: string, seq: number): Promise<void> {
  const artist = track.artists[0] ?? "";
  const params = new URLSearchParams({
    track_name: cleanedTitle,
    artist_name: artist,
  });

  try {
    const res = await fetch(`${LRCLIB_BASE}/api/search?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });
    if (seq !== fetchSeq) return;
    if (!res.ok) {
      setState({ lyricsMode: "none" });
      return;
    }
    const arr = (await res.json()) as LrcLibResult[];
    if (!Array.isArray(arr) || arr.length === 0) {
      setState({ lyricsMode: "none" });
      return;
    }

    const target = Math.round(track.duration_ms / 1000);
    const targetTitle = cleanedTitle.toLowerCase();
    let best: LrcLibResult | null = null;
    let bestScore = Infinity;

    for (const cand of arr) {
      const dur = typeof cand.duration === "number" ? cand.duration : 0;
      const dScore = Math.abs(dur - target);

      // Duration must be within 15s to be considered the same track version
      if (dScore > 15) continue;

      const candTitle = cleanTrackTitle(cand.trackName ?? "").toLowerCase();
      const titleMatches = candTitle === targetTitle || candTitle.includes(targetTitle) || targetTitle.includes(candTitle);
      const titlePenalty = titleMatches ? 0 : 200;

      // Prefer synced lyrics
      const syncBonus = cand.syncedLyrics ? -100 : 0;
      const score = dScore * 2 + titlePenalty + syncBonus;

      if (score < bestScore) {
        bestScore = score;
        best = cand;
      }
    }

    if (best) {
      applyLrcResult(best, track, seq);
    } else {
      // If no candidate was within 15s, pick the closest one with plain lyrics or fallback
      const fallback = arr.find((c) => c.syncedLyrics || c.plainLyrics);
      if (fallback) applyLrcResult(fallback, track, seq);
      else setState({ lyricsMode: "none" });
    }
  } catch (e) {
    if (seq === fetchSeq) return;
    console.warn("lyrics search failed", e);
    setState({ lyricsMode: "none" });
  }
}

function applyLrcResult(j: LrcLibResult, _track: Track, seq: number): void {
  if (seq !== fetchSeq) return;
  if (j.instrumental) {
    setState({ lyricsMode: "instrumental", lines: [], activeLineIndex: -1 });
    return;
  }
  if (j.syncedLyrics) {
    const lines = parseLrc(j.syncedLyrics);
    if (lines.length > 0) {
      const idx = activeLineIndexAt(lines, getState().position_ms);
      setState({ lyricsMode: "synced", lines, activeLineIndex: idx, plainLyrics: null });
      return;
    }
  }
  if (j.plainLyrics) {
    setState({ lyricsMode: "plain", plainLyrics: j.plainLyrics, lines: [], activeLineIndex: -1 });
    return;
  }
  setState({ lyricsMode: "none" });
}

export function updateActiveLine(positionMs: number): void {
  const s = getState();
  if (s.lyricsMode !== "synced" || s.lines.length === 0) return;
  const idx = activeLineIndexAt(s.lines, positionMs);
  if (idx !== s.activeLineIndex) setState({ activeLineIndex: idx });
}

export function clearLyrics(): void {
  fetchSeq++;
  setState({ lyricsMode: "none", lines: [], activeLineIndex: -1, plainLyrics: null });
}
