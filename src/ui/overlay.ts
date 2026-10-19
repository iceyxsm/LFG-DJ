import {
  beginLogin,
  finishLogin,
  isClientIdConfigured,
  logout,
} from "../auth";
import { getState, setSyncOffset } from "../state";
import {
  getModePref,
  setMode,
  transport,
} from "../player";
import { enableMic, disableMic, micEnabled } from "../mic";

let root: HTMLElement;

export function mountOverlay(el: HTMLElement): void {
  root = el;
  root.innerHTML = "";
  root.appendChild(buildTopBar());
  root.appendChild(buildLoginPane());
  root.appendChild(buildStatusToast());
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

let statusToast: HTMLElement;
let loginPane: HTMLElement;
let topBar: HTMLElement;

function buildTopBar(): HTMLElement {
  topBar = el("div", "topbar");

  const left = el("div", "topbar-left");
  const title = el("span", "brand", "LFG DJ");
  left.appendChild(title);
  const trackLabel = el("span", "track-label", "");
  trackLabel.id = "track-label";
  left.appendChild(trackLabel);
  topBar.appendChild(left);

  const right = el("div", "topbar-right");

  const modeBtn = el("button", "chip", "Mode: watcher");
  modeBtn.id = "mode-btn";
  modeBtn.onclick = async () => {
    const next = getModePref() === "sdk" ? "watcher" : "sdk";
    await setMode(next);
    modeBtn.textContent = `Mode: ${next}`;
  };
  right.appendChild(modeBtn);

  const micBtn = el("button", "chip", "Mic: off");
  micBtn.id = "mic-btn";
  micBtn.onclick = async () => {
    if (micEnabled()) {
      disableMic();
      micBtn.textContent = "Mic: off";
    } else {
      try {
        await enableMic();
        micBtn.textContent = "Mic: on";
      } catch (e) {
        toast(`Mic denied: ${e}`);
      }
    }
  };
  right.appendChild(micBtn);

  const syncBtn = el("button", "chip", "Sync: 0ms");
  syncBtn.id = "sync-btn";
  syncBtn.title = "Lyric sync offset. Click to reset, or use [ and ] keys.";
  syncBtn.onclick = () => {
    setSyncOffset(0);
    toast("Sync offset reset: 0ms");
    refreshOverlay();
  };
  right.appendChild(syncBtn);

  const prevBtn = el("button", "chip", "⏮");
  prevBtn.onclick = () => transport("prev");
  const playBtn = el("button", "chip", "⏯");
  playBtn.onclick = () => transport("playpause");
  const nextBtn = el("button", "chip", "⏭");
  nextBtn.onclick = () => transport("next");
  right.appendChild(prevBtn);
  right.appendChild(playBtn);
  right.appendChild(nextBtn);

  const logoutBtn = el("button", "chip", "Log out");
  logoutBtn.onclick = async () => {
    await logout();
    location.reload();
  };
  right.appendChild(logoutBtn);

  topBar.appendChild(right);
  return topBar;
}

function buildLoginPane(): HTMLElement {
  loginPane = el("div", "login-pane hidden");
  const card = el("div", "login-card");
  card.appendChild(el("h2", "", "Connect Spotify"));

  const note = el(
    "p",
    "dim",
    "A Spotify Premium account is required for in-app playback (SDK mode). Watcher mode works with any Spotify app already playing on your account."
  );
  card.appendChild(note);

  const loginBtn = el("button", "btn", "Open Spotify login");
  loginBtn.onclick = async () => {
    try {
      await beginLogin();
      pasteRow.classList.remove("hidden");
      toast("Log in in the browser, then paste the redirect URL (localhost:8888/callback?code=…) below.");
    } catch (e) {
      toast(String(e));
    }
  };
  card.appendChild(loginBtn);

  const pasteRow = el("div", "paste-row hidden");
  const input = el("input") as HTMLInputElement;
  input.placeholder = "Paste redirect URL or code here";
  input.className = "paste-input";
  const goBtn = el("button", "btn", "Finish login");
  goBtn.onclick = async () => {
    try {
      await finishLogin(input.value);
      loginPane.classList.add("hidden");
      location.reload();
    } catch (e) {
      toast(String(e));
    }
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") goBtn.click();
  });
  pasteRow.appendChild(input);
  pasteRow.appendChild(goBtn);
  card.appendChild(pasteRow);

  if (!isClientIdConfigured()) {
    const warn = el(
      "p",
      "warn",
      "SPOTIFY_CLIENT_ID is not set — edit src/auth.ts and paste your app's client ID. See README."
    );
    card.appendChild(warn);
  }

  loginPane.appendChild(card);
  return loginPane;
}

function buildStatusToast(): HTMLElement {
  statusToast = el("div", "status-toast hidden");
  return statusToast;
}

let toastTimer: number | null = null;
export function toast(msg: string, ms = 4000): void {
  if (!statusToast) return;
  statusToast.textContent = msg;
  statusToast.classList.remove("hidden");
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(
    () => statusToast.classList.add("hidden"),
    ms
  );
}

export function showLoginPane(): void {
  if (loginPane) loginPane.classList.remove("hidden");
}

export function refreshOverlay(): void {
  const s = getState();
  const trackLabel = document.getElementById("track-label");
  if (trackLabel) {
    trackLabel.textContent = s.track
      ? `${s.track.name} — ${s.track.artists.join(", ")}`
      : "";
  }
  const syncBtn = document.getElementById("sync-btn");
  if (syncBtn) {
    const off = s.syncOffsetMs ?? 0;
    const txt = `Sync: ${off > 0 ? "+" : ""}${off}ms`;
    if (syncBtn.textContent !== txt) {
      syncBtn.textContent = txt;
    }
  }
}

