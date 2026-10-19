import "./styles/base.css";
import "./styles/overlay.css";
import "./styles/lyric-layer.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { restoreSession, api } from "./auth";
import { getState, publishDjState, setState, setSyncOffset } from "./state";
import {
  setTrackChangeHandler,
  setMode,
  startWatcher,
  estimatePositionMs,
} from "./player";
import { fetchLyrics, clearLyrics, updateActiveLine } from "./lyrics";
import { sampleMic } from "./mic";
import {
  mountOverlay,
  refreshOverlay,
  showLoginPane,
  toast,
} from "./ui/overlay";
import { App } from "./App";

const overlay = document.getElementById("overlay") as HTMLElement;
const rootEl = document.getElementById("root") as HTMLElement;

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
);

async function main(): Promise<void> {
  mountOverlay(overlay);

  // Keyboard Sync Calibration Shortcuts ([ = later / delay, ] = earlier / advance, \ = reset)
  window.addEventListener("keydown", (e) => {
    if (
      (e.target as HTMLElement)?.tagName === "INPUT" ||
      (e.target as HTMLElement)?.tagName === "TEXTAREA"
    ) {
      return;
    }
    const s = getState();
    if (e.key === "[") {
      const next = (s.syncOffsetMs ?? 0) - 100;
      setSyncOffset(next);
      toast(`Sync Offset: ${next > 0 ? "+" : ""}${next}ms (Lyrics later)`);
      refreshOverlay();
    } else if (e.key === "]") {
      const next = (s.syncOffsetMs ?? 0) + 100;
      setSyncOffset(next);
      toast(`Sync Offset: ${next > 0 ? "+" : ""}${next}ms (Lyrics earlier)`);
      refreshOverlay();
    } else if (e.key === "\\") {
      setSyncOffset(0);
      toast("Sync Offset: 0ms (Default)");
      refreshOverlay();
    }
  });

  setTrackChangeHandler((t) => {
    if (t) fetchLyrics(t).catch((e) => console.warn("lyrics", e));
    else clearLyrics();
  });

  let lastError: string | null = null;
  const frame = () => {
    const pos = estimatePositionMs();
    setState({ position_ms: pos });
    updateActiveLine(pos);
    sampleMic();
    publishDjState();
    const s = getState();
    if (s.error && s.error !== lastError) {
      lastError = s.error;
      toast(s.error, 6000);
      setState({ error: null });
    }
    refreshOverlay();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  const ok = await restoreSession().catch(() => false);
  if (!ok) {
    setState({ statusMessage: "Log in to Spotify to begin." });
    showLoginPane();
    return;
  }

  try {
    const meRes = await api("/v1/me");
    if (meRes.ok) {
      const me = await meRes.json();
      setState({
        auth: {
          loggedIn: true,
          userName: me?.display_name ?? null,
          product: me?.product ?? null,
        },
      });
      if (me?.product !== "premium") {
        toast(
          "Note: in-app playback (SDK mode) needs Spotify Premium. Watcher mode will still work.",
          7000
        );
      }
    }
  } catch {}

  await setMode("watcher");
  startWatcher();
  toast("Watching Spotify — play a track on any device, or switch to SDK mode.");
}

main().catch((e) => {
  console.error(e);
  toast(`Startup failed: ${e}`);
});
