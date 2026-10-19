import { invoke } from "@tauri-apps/api/core";
import { open as shellOpen } from "@tauri-apps/plugin-shell";

export const SPOTIFY_CLIENT_ID: string = "2f54bb4bc4ac4eef9e3d4cf4aa48a162";

export const REDIRECT_URI = "http://127.0.0.1:8888/callback";

const AUTH_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";

export const SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
].join(" ");

interface TokenSet {
  access_token: string;
  refresh_token: string | null;
  expires_at: number;
  token_type: string;
}

let tokens: TokenSet | null = null;
let refreshTimer: number | null = null;

const LS_KEY = "lfg_dj_tokens_v1";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function persistRefreshToken(rt: string | null): Promise<void> {
  try {
    if (isTauri()) {
      if (rt) await invoke("save_refresh_token", { token: rt });
      else await invoke("clear_refresh_token");
    } else if (rt) {
      localStorage.setItem("lfg_dj_rt", rt);
    } else {
      localStorage.removeItem("lfg_dj_rt");
    }
  } catch (e) {
    console.warn("persist refresh token failed", e);
  }
}

async function loadPersistedRefreshToken(): Promise<string | null> {
  try {
    if (isTauri()) {
      const t = await invoke<string | null>("load_refresh_token");
      return t ?? null;
    }
    return localStorage.getItem("lfg_dj_rt");
  } catch (e) {
    console.warn("load refresh token failed", e);
    return null;
  }
}

function persistTokens(): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(tokens));
  } catch {}
}

function loadPersistedTokens(): void {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const t = JSON.parse(raw);
    if (t && typeof t.access_token === "string") tokens = t;
  } catch {}
}

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(plain: string): Promise<string> {
  const data = new TextEncoder().encode(plain);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return b64url(digest);
}

function randomString(len: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  let s = "";
  for (const v of arr) s += chars[v % chars.length];
  return s;
}

let pendingVerifier: string | null = null;

export function isClientIdConfigured(): boolean {
  return SPOTIFY_CLIENT_ID !== "YOUR_SPOTIFY_CLIENT_ID" && SPOTIFY_CLIENT_ID.length > 8;
}

export async function beginLogin(): Promise<void> {
  if (!isClientIdConfigured()) {
    throw new Error(
      "SPOTIFY_CLIENT_ID is not set. Edit src/auth.ts and paste your Spotify app's client ID (see README)."
    );
  }
  const verifier = randomString(64);
  const challenge = await sha256(verifier);
  pendingVerifier = verifier;
  sessionStorage.setItem("lfg_dj_pkce_verifier", verifier);

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: challenge,
    scope: SCOPES,
    show_dialog: "false",
  });
  const url = `${AUTH_URL}?${params.toString()}`;
  if (isTauri()) {
    try {
      await shellOpen(url);
      return;
    } catch (e) {
      console.warn("shell open failed, falling back to window.open", e);
    }
  }
  window.open(url, "_blank");
}

export function extractCodeFromRedirect(input: string): string | null {
  try {
    const u = new URL(input.trim());
    const code = u.searchParams.get("code");
    if (code) return code;
    const err = u.searchParams.get("error");
    if (err) throw new Error(`Spotify auth error: ${err}`);
    return null;
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Spotify auth error")) throw e;
    const raw = input.trim();
    if (/^[\w-]{20,}$/.test(raw)) return raw;
    return null;
  }
}

export async function finishLogin(redirectUrlOrCode: string): Promise<void> {
  const code = extractCodeFromRedirect(redirectUrlOrCode);
  if (!code) throw new Error("No authorization code found in that input.");
  const verifier =
    pendingVerifier ?? sessionStorage.getItem("lfg_dj_pkce_verifier");
  if (!verifier) throw new Error("PKCE verifier missing — restart login.");
  await exchangeCode(code, verifier);
}

async function exchangeCode(code: string, verifier: string): Promise<void> {
  const body = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Token exchange failed ${res.status}: ${txt}`);
  }
  const j = await res.json();
  applyTokenResponse(j);
  await persistRefreshToken(tokens!.refresh_token);
}

function applyTokenResponse(j: any): void {
  const expires_in = typeof j.expires_in === "number" ? j.expires_in : 3600;
  tokens = {
    access_token: j.access_token,
    refresh_token: j.refresh_token ?? tokens?.refresh_token ?? null,
    expires_at: Date.now() + expires_in * 1000 - 30_000,
    token_type: j.token_type ?? "Bearer",
  };
  persistTokens();
  scheduleRefresh();
}

function scheduleRefresh(): void {
  if (refreshTimer !== null) {
    window.clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  if (!tokens) return;
  const delay = Math.max(5_000, tokens.expires_at - Date.now() - 60_000);
  refreshTimer = window.setTimeout(() => {
    refreshAccessToken().catch((e) => console.error("refresh failed", e));
  }, delay);
}

export async function refreshAccessToken(): Promise<void> {
  const rt = tokens?.refresh_token ?? (await loadPersistedRefreshToken());
  if (!rt) throw new Error("No refresh token");
  const body = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token: rt,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 400 || res.status === 401) {
      await logout();
    }
    throw new Error(`Refresh failed ${res.status}: ${txt}`);
  }
  const j = await res.json();
  applyTokenResponse(j);
  if (j.refresh_token) await persistRefreshToken(j.refresh_token);
}

export async function getAccessToken(): Promise<string | null> {
  if (!tokens) loadPersistedTokens();
  if (!tokens) {
    const rt = await loadPersistedRefreshToken();
    if (rt) {
      tokens = {
        access_token: "",
        refresh_token: rt,
        expires_at: 0,
        token_type: "Bearer",
      };
    } else {
      return null;
    }
  }
  if (Date.now() >= tokens.expires_at) {
    await refreshAccessToken();
  }
  return tokens?.access_token ?? null;
}

export function isLoggedIn(): boolean {
  return tokens !== null && tokens.access_token.length > 0;
}

export async function api(path: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not logged in");
  const url = path.startsWith("http") ? path : `https://api.spotify.com${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401) {
    await refreshAccessToken();
    const token2 = await getAccessToken();
    return fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token2}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  }
  return res;
}

export async function logout(): Promise<void> {
  tokens = null;
  if (refreshTimer !== null) {
    window.clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  try {
    localStorage.removeItem(LS_KEY);
  } catch {}
  await persistRefreshToken(null);
}

export async function restoreSession(): Promise<boolean> {
  loadPersistedTokens();
  if (tokens && tokens.refresh_token) {
    try {
      if (Date.now() >= tokens.expires_at) await refreshAccessToken();
      return true;
    } catch {
      return false;
    }
  }
  const rt = await loadPersistedRefreshToken();
  if (rt) {
    tokens = {
      access_token: "",
      refresh_token: rt,
      expires_at: 0,
      token_type: "Bearer",
    };
    try {
      await refreshAccessToken();
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
