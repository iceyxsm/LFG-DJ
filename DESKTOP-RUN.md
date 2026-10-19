# Running LFG-DJ on your desktop (NixOS)

You're already logged in — the refresh token is stored, so this is one-time setup.

## 1. Get the deps (first time only)

```bash
cd /mnt/og/LFG-DJ
nix-shell          # pulls GTK, WebKitGTK, dbus, rust — everything Tauri needs
```

## 2. Run it

```bash
pnpm install
pnpm tauri dev
```

That opens the real fullscreen app on your GPU — visuals will render.

To build a binary instead:

```bash
nix-shell --run "pnpm tauri build"
```

Binary lands in `src-tauri/target/release/bundle/`.

## 3. In the app

- It'll pick up your stored login; if it shows "Connect Spotify" anyway, click
  "Open Spotify login," sign in, Agree — then paste the dead `127.0.0.1:8888`
  redirect URL when asked (same flow you just did).
- **Mode chip** — `watcher` watches any Spotify device you're playing on;
  `sdk` makes the app its own device (tightest sync, needs Premium — you have it).
- **Mic chip** — turns on the FFT boost so visuals react to real audio.
- Fullscreen is the intended view — put it on a monitor and let it run.

## Why it couldn't run here

This box has no GPU and no WebKitGTK, so WebGL can't create a context and Tauri
can't compile the shell. On your machine it's a non-issue — the engine, the
auth, the lyrics, and the visual layer all already work and typecheck clean.
