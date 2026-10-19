# Setup

LFG-DJ needs one thing from you before it can log in: a **Spotify Client ID**. It uses OAuth PKCE — no client secret, nothing to hide.

## 1. Make a Spotify app

1. Go to <https://developer.spotify.com/dashboard> and log in.
2. **Create app**. Name it whatever (`LFG DJ` is fine). Description doesn't matter.
3. In the app's **Settings**, add this **Redirect URI** exactly:

   ```
   http://localhost:8888/callback
   ```

   Hit **Add**, then **Save** at the bottom. This must match the `REDIRECT_URI` constant in `src/auth.ts` — it's already set to that URL.
4. While you're in there, under *"Which API/SDKs are you planning to use"* tick **Web Playback SDK** (needed for the `streaming` scope in SDK mode) and **Web API**.
5. Copy the **Client ID** — the long hex string at the top of the app's page.

No client secret is used or needed. PKCE proves the app is you without one.

## 2. Give the app your Client ID

Open `src/auth.ts` and edit line 4:

```ts
export const SPOTIFY_CLIENT_ID: string = "YOUR_SPOTIFY_CLIENT_ID";
```

Replace `"YOUR_SPOTIFY_CLIENT_ID"` with the real ID you copied. That's the only config the app needs — there's no `.env` to fill in (`.env.example` is just a reminder of the one value). `isClientIdConfigured()` in `src/auth.ts:103` checks for the placeholder, so the login button will refuse to work until you change it.

## 3. Install & run

```bash
pnpm install
```

**To run the real desktop app** (Tauri shell — this is the intended experience):

```bash
pnpm tauri dev
```

This kicks off `pnpm dev` (Vite on <http://localhost:1420>) and opens the window.

**To just preview the visuals in a browser** (no Rust, no Tauri — everything except the native refresh-token store still works):

```bash
pnpm dev
```

then open <http://localhost:1420>.

### Linux build deps (first `pnpm tauri dev` only)

The Tauri shell compiles against WebKitGTK. On a fresh Debian/Ubuntu-ish box:

```bash
sudo apt install \
  libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev \
  librsvg2-dev libsoup-3.0-dev libjavascriptcoregtk-4.1-dev \
  build-essential curl wget file pkg-config
```

You also need a Rust toolchain (`rustup`) and Node ≥ 18. If `pnpm tauri dev` fails on a missing `glib`/`webkit` pkg-config file, that's the list to install. Fedora/Arch package names differ — see <https://tauri.app/start/prerequisites/>.

## 4. Log in

1. Click **Open Spotify login**. Your browser opens Spotify's authorize page — approve it.
2. The browser gets sent to `http://localhost:8888/callback?code=…`. **The page won't load** — nothing is listening on 8888, and that's expected.
3. Copy the **entire URL** out of the address bar.
4. Back in the app, paste it into the box that appeared under the login button and hit **Finish login**.

That's it. The refresh token is saved (in the Tauri app-data dir as `spotify_refresh_token`, mode `0600`; in `localStorage` when running in a plain browser) and access tokens refresh themselves. You stay logged in across restarts until you click **Log out**.

## 5. Use it

Top-right chips in the overlay:

- **Mode: watcher / sdk** — toggles how the app hears Spotify.
  - **Watcher** (default): polls "what's playing" once a second. Works with *any* Spotify client already playing on your account — phone, desktop, web, whatever. No Premium needed for the visuals to react.
  - **SDK**: the app *becomes* a Spotify Connect device ("LFG DJ" shows up in your device picker) and pulls audio + position itself for frame-tight sync. **Requires Spotify Premium.** If the SDK isn't ready yet it falls back to watching.
- **Mic: off / on** — turns on `getUserMedia` + an FFT analyser. Feeds a normalized `energy` (0–1) and `bass/mid/treble` bands into the visuals every frame, so the room sound pushes the scene around. All local — nothing is recorded or sent anywhere.
- **⏮ ⏯ ⏭** — transport; routed to whichever mode is active.
- **Log out** — clears tokens and reloads.

For fullscreen, maximize or hit your WM's fullscreen key — the canvas is a single borderless surface, there's no in-app fullscreen button.

## Troubleshooting

- **"SPOTIFY_CLIENT_ID is not set"** — you haven't done step 2, or the ID is still the placeholder/`""`. Edit `src/auth.ts:4`.
- **Login button does nothing / Spotify shows an error about redirect URI** — the URI in your Spotify app's settings doesn't exactly match `http://localhost:8888/callback`. Fix it in the dashboard and re-save.
- **Pasted the URL but "No authorization code found"** — copy the *whole* address-bar URL including `?code=…`, not just the code.
- **SDK mode errors with "account error"** — you need Spotify **Premium** for the Web Playback SDK. Use **Watcher** mode instead; everything except in-app playback still works.
- **"LFG DJ" doesn't appear as a device / SDK not ready** — give it a few seconds after switching to SDK mode; if it stays unready it'll keep watching your other device. Premium required.
- **No lyrics** — lyrics come from [LRClib](https://lrclib.net). Coverage is community-driven: mainstream tracks usually have synced LRC, obscure/local files often don't. If LRClib has nothing you'll get `none`/instrumental state — that's coverage, not a bug.
- **Mic does nothing** — the OS/browser denied permission. In the Tauri shell the WebView asks once; if you blocked it, restart the app and allow. Some Linux WebKitGTK builds need the mic exposed via PulseAudio/PipeWire.
- **`pnpm tauri dev` fails to compile the shell** — missing WebKitGTK dev packages, see step 3's apt line.
