# LFG-DJ — NixOS dev shell for the Tauri desktop build.
#
# Tauri on Linux needs GTK + WebKitGTK + dbus + friends at build time. On NixOS
# those come from a dev shell, not apt. Drop into it before running pnpm tauri:
#
#   cd /mnt/og/LFG-DJ
#   nix-shell          # pulls the deps below, drops you in a bash shell
#   pnpm install
#   pnpm tauri dev     # dev run — the real fullscreen app
#
# or, for a packaged binary:
#   nix-shell --run "pnpm tauri build"
#
{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    pkg-config

    # Tauri / webview runtime + build deps
    gtk3
    webkitgtk_4_1
    libsoup_3
    cairo
    pango
    gdk-pixbuf
    glib
    atk

    # tauri-plugin-shell / system integration
    dbus
    openssl

    # misc Tauri requires on some setups
    curl
    wget
    appimagekit        # only needed if you package AppImages

    # toolchain
    cargo
    rustc
    rustfmt
    clippy
    pkgconf
    nodejs_22          # pnpm assumed via corepack or already installed
  ];

  # WebKit needs this so the webview can find its GTK modules at runtime.
  GIO_MODULE_DIR = "${pkgs.glib-networking}/lib/gio/modules";
  # Some NixOS setups need this for TLS inside the webview.
  shellHook = ''
    export GIO_MODULE_DIR="${pkgs.glib-networking}/lib/gio/modules"
    export LD_LIBRARY_PATH="${pkgs.lib.makeLibraryPath [
      pkgs.webkitgtk_4_1
      pkgs.gtk3
      pkgs.libsoup_3
      pkgs.glib
      pkgs.openssl
      pkgs.dbus
    ]}:$LD_LIBRARY_PATH"
    export PKG_CONFIG_PATH="${pkgs.webkitgtk_4_1.dev}/lib/pkgconfig:${pkgs.libsoup_3.dev}/lib/pkgconfig:${pkgs.gtk3.dev}/lib/pkgconfig:$PKG_CONFIG_PATH"
    echo "LFG-DJ dev shell — run: pnpm install && pnpm tauri dev"
  '';
}
