#!/usr/bin/env bash
# Builds the Electron desktop app into dist/:
#   CanonCorps-x86_64.AppImage       Linux (itch, playtests)
#   CanonCorps-linux-x64.tar.gz      Linux folder (what a Steam depot takes)
#   CanonCorps-windows.zip           Windows x64 folder with CanonCorps.exe
#   CanonCorps-mac-arm64.zip         Apple Silicon, ad-hoc signed
#   CanonCorps-mac-x64.zip           Intel Mac, ad-hoc signed
#   bash tools/desktop/build.sh [linux] [windows] [mac]     (default: all)
# Needs node/npm and uv. appimagetool and rcodesign are fetched into tools/desktop/.cache on first use.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
GAME="$ROOT/game"
DIST="$ROOT/dist"
CACHE="$HERE/.cache"
STAGE="$HERE/.stage"
OUT="$HERE/.out"
VERSION="${VERSION:-0.1.$(date +%Y%m%d%H%M)}"
TARGETS="${*:-linux windows mac}"
want() { [[ " $TARGETS " == *" $1 "* ]]; }
mkdir -p "$DIST" "$CACHE"
cd "$HERE"
[ -d node_modules/@electron/packager ] || npm install --no-audit --no-fund

# ---- the app: Electron code + the game files (no dev scripts, no .env), version stamped -------------------
rm -rf "$STAGE" "$OUT"; mkdir -p "$STAGE/web/worlds" "$OUT"
trap 'rm -rf "$STAGE" "$OUT"' EXIT
cp main.js preload.js server.js "$STAGE/"
cp -r "$GAME/index.html" "$GAME/setup.html" "$GAME/style.css" "$GAME/js" "$GAME/assets" "$STAGE/web/"
cp "$GAME"/worlds/*.json "$STAGE/web/worlds/"   # v2 pool only (not worlds/v1, worlds/rejected)
node -e 'const p=require("./package.json");delete p.devDependencies;delete p.scripts;p.version=process.argv[1];require("fs").writeFileSync(process.argv[2],JSON.stringify(p,null,1))' \
  "$VERSION" "$STAGE/package.json"

# icon: the logon medallion, squared, as PNG, ICO and ICNS
uv run --quiet --with pillow python - "$GAME/assets/seal/medallion.png" "$CACHE" <<'PY'
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert("RGBA")
side = max(im.size); sq = Image.new("RGBA", (side, side)); sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
sq.resize((256, 256), Image.LANCZOS).save(f"{sys.argv[2]}/icon.png")
sq.resize((256, 256), Image.LANCZOS).save(f"{sys.argv[2]}/icon.ico", sizes=[(s, s) for s in (16, 24, 32, 48, 64, 128, 256)])
sq.resize((1024, 1024), Image.LANCZOS).save(f"{sys.argv[2]}/icon.icns", sizes=[(s, s) for s in (16, 32, 64, 128, 256, 512, 1024)])
PY
cp "$CACHE/icon.png" "$STAGE/icon.png"

pack() { # platform arch
  npx --no-install electron-packager "$STAGE" "Canon Corps" --platform="$1" --arch="$2" --out="$OUT" --overwrite --asar \
    --executable-name="$([ "$1" = win32 ] && echo CanonCorps || echo canon-corps)" --app-version="$VERSION" \
    --icon="$CACHE/icon" --app-bundle-id=net.canoncorps.game --app-category-type=public.app-category.games \
    --win32metadata.ProductName="Canon Corps" --win32metadata.FileDescription="Canon Corps" --win32metadata.CompanyName="Canon Corps" \
    --quiet >/dev/null
  chmod -R a+rX "$OUT/Canon Corps-$1-$2"   # packager leaves its temp dir's 0700; other users must be able to run it
  echo "$OUT/Canon Corps-$1-$2"
}

if want linux; then
  D="$(pack linux x64)"
  (cd "$OUT" && mv "Canon Corps-linux-x64" CanonCorps-linux-x64 && tar czf "$DIST/CanonCorps-linux-x64.tar.gz" CanonCorps-linux-x64)
  echo "built dist/CanonCorps-linux-x64.tar.gz ($(du -h "$DIST/CanonCorps-linux-x64.tar.gz" | cut -f1))"
  if [ ! -x "$CACHE/appimagetool" ]; then
    curl -sL -o "$CACHE/appimagetool" https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage
    chmod +x "$CACHE/appimagetool"
  fi
  AD="$OUT/AppDir"; mv "$OUT/CanonCorps-linux-x64" "$AD"
  # Chromium's sandbox needs unprivileged user namespaces, which some distros (Ubuntu 24.04+) lock away
  # from AppImages; there the app runs unsandboxed. It only ever loads its own files from localhost.
  cat > "$AD/AppRun" <<'SH'
#!/bin/sh
HERE="$(dirname "$(readlink -f "$0")")"
FLAGS=""
if [ "$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null)" = "1" ] || \
   [ "$(cat /proc/sys/kernel/unprivileged_userns_clone 2>/dev/null)" = "0" ]; then FLAGS="--no-sandbox"; fi
exec "$HERE/canon-corps" $FLAGS "$@"
SH
  chmod +x "$AD/AppRun"
  cp "$CACHE/icon.png" "$AD/canon-corps.png"
  printf '[Desktop Entry]\nType=Application\nName=Canon Corps\nExec=AppRun\nIcon=canon-corps\nCategories=Game;\nTerminal=false\n' > "$AD/canon-corps.desktop"
  rm -f "$DIST/CanonCorps-x86_64.AppImage"
  APPIMAGE_EXTRACT_AND_RUN=1 ARCH=x86_64 VERSION="$VERSION" "$CACHE/appimagetool" --no-appstream "$AD" "$DIST/CanonCorps-x86_64.AppImage" \
    >/dev/null 2>"$CACHE/appimagetool.log" || { cat "$CACHE/appimagetool.log"; exit 1; }
  echo "built dist/CanonCorps-x86_64.AppImage ($(du -h "$DIST/CanonCorps-x86_64.AppImage" | cut -f1))"
fi

if want windows; then
  D="$(pack win32 x64)"
  W="$OUT/CanonCorps-windows"; mv "$D" "$W"
  sed 's/$/\r/' "$HERE/readme/windows.txt" > "$W/READ ME FIRST.txt"
  (cd "$OUT" && rm -f "$DIST/CanonCorps-windows.zip" && zip -qr "$DIST/CanonCorps-windows.zip" CanonCorps-windows)
  echo "built dist/CanonCorps-windows.zip ($(du -h "$DIST/CanonCorps-windows.zip" | cut -f1))"
fi

if want mac; then
  RCS="$CACHE/rcodesign"
  if [ ! -x "$RCS" ]; then # Apple Silicon refuses to run an app with a broken signature, so re-sign ad hoc from here
    V=0.29.0; T="apple-codesign-$V-x86_64-unknown-linux-musl"
    curl -sL "https://github.com/indygreg/apple-platform-rs/releases/download/apple-codesign/$V/$T.tar.gz" | tar xz -C "$CACHE"
    mv "$CACHE/$T/rcodesign" "$RCS"; rm -rf "$CACHE/$T"
  fi
  for ARCH in arm64 x64; do
    D="$(pack darwin $ARCH)"
    "$RCS" sign "$D/Canon Corps.app" >"$CACHE/rcodesign.log" 2>&1 || { tail -20 "$CACHE/rcodesign.log"; exit 1; }
    cp "$HERE/readme/mac.txt" "$D/READ ME FIRST.txt"
    (cd "$D" && rm -f "$DIST/CanonCorps-mac-$ARCH.zip" && zip -qry "$DIST/CanonCorps-mac-$ARCH.zip" "Canon Corps.app" "READ ME FIRST.txt")
    echo "built dist/CanonCorps-mac-$ARCH.zip ($(du -h "$DIST/CanonCorps-mac-$ARCH.zip" | cut -f1))"
  done
fi
echo "version $VERSION"
