#!/usr/bin/env bash
# Builds test builds of Canon Corps into dist/:
#   CanonCorps-mac.zip       Canon Corps.app (Apple Silicon + Intel)
#   CanonCorps-windows.zip   CanonCorps.exe (x64)
#   CanonCorps-x86_64.AppImage
# Each is the Go launcher (main.go) with the game embedded; the player brings an OpenRouter key.
#   bash tools/release/build.sh [mac] [windows] [linux]     (default: all)
# Needs Go and uv. go-winres and appimagetool are fetched into tools/release/.cache on first use.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
GAME="$ROOT/game"
DIST="$ROOT/dist"
CACHE="$HERE/.cache"
STAMP="$(date +%Y%m%d%H%M)"
VERSION="${VERSION:-0.1.$STAMP}"
TARGETS="${*:-mac windows linux}"
mkdir -p "$DIST" "$CACHE"
want() { [[ " $TARGETS " == *" $1 "* ]]; }

# the game files to embed (no dev scripts, no .env)
rm -rf "$HERE/web"; mkdir -p "$HERE/web"
cp -r "$GAME/index.html" "$GAME/style.css" "$GAME/js" "$GAME/assets" "$HERE/web/"
mkdir -p "$HERE/web/worlds"; cp "$GAME"/worlds/*.json "$HERE/web/worlds/"   # v2 pool only (not worlds/v1, worlds/rejected)
trap 'rm -rf "$HERE/web" "$HERE"/rsrc_windows_*.syso' EXIT
cd "$HERE"
[ -f go.mod ] || go mod init canoncorps >/dev/null 2>&1

# icon: the logon medallion, squared, as PNG and ICNS
ICON="$CACHE/icon.png"
uv run --quiet --with pillow python - "$GAME/assets/seal/medallion.png" "$ICON" "$CACHE/icon.icns" <<'EOF'
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert("RGBA")
side = max(im.size); sq = Image.new("RGBA", (side, side)); sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
sq.resize((256, 256), Image.LANCZOS).save(sys.argv[2])
sq.resize((1024, 1024), Image.LANCZOS).save(sys.argv[3], sizes=[(s, s) for s in (16, 32, 64, 128, 256, 512, 1024)])
EOF

build() { CGO_ENABLED=0 GOOS=$1 GOARCH=$2 go build -trimpath -ldflags="-s -w ${3:-}" -o "$4" .; }

if want mac; then
  APP="$DIST/Canon Corps.app"
  rm -rf "$APP"; mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
  # Go ad-hoc signs darwin/arm64, which Apple Silicon requires
  build darwin arm64 "" "$APP/Contents/MacOS/canoncorps-arm64"
  build darwin amd64 "" "$APP/Contents/MacOS/canoncorps-amd64"
  cat > "$APP/Contents/MacOS/Canon Corps" <<'EOF'
#!/bin/sh
DIR="$(cd "$(dirname "$0")" && pwd)"
if [ "$(sysctl -n hw.optional.arm64 2>/dev/null)" = "1" ]; then exec "$DIR/canoncorps-arm64" "$@"; fi
exec "$DIR/canoncorps-amd64" "$@"
EOF
  chmod +x "$APP/Contents/MacOS/"*
  cp "$CACHE/icon.icns" "$APP/Contents/Resources/icon.icns"
  cat > "$APP/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Canon Corps</string>
  <key>CFBundleDisplayName</key><string>Canon Corps</string>
  <key>CFBundleIdentifier</key><string>net.canoncorps.testbuild</string>
  <key>CFBundleExecutable</key><string>Canon Corps</string>
  <key>CFBundleIconFile</key><string>icon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>LSUIElement</key><true/>
</dict></plist>
EOF
  cp "$HERE/readme/mac.txt" "$DIST/READ ME FIRST.txt"
  (cd "$DIST" && rm -f CanonCorps-mac.zip && zip -qry CanonCorps-mac.zip "Canon Corps.app" "READ ME FIRST.txt" && rm -rf "Canon Corps.app" "READ ME FIRST.txt")
  echo "built dist/CanonCorps-mac.zip ($(du -h "$DIST/CanonCorps-mac.zip" | cut -f1))"
fi

if want windows; then
  [ -x "$CACHE/go-winres" ] || GOBIN="$CACHE" go install github.com/tc-hib/go-winres@latest
  "$CACHE/go-winres" simply --arch amd64 --icon "$ICON" --manifest gui --product-name "Canon Corps" \
    --file-description "Canon Corps (test build)" --product-version "0.1.0.0" --file-version "0.1.0.0" >/dev/null
  W="$DIST/CanonCorps-windows"; rm -rf "$W"; mkdir -p "$W"
  build windows amd64 "-H windowsgui" "$W/CanonCorps.exe"   # no console window; logs go to the data dir
  rm -f "$HERE"/rsrc_windows_*.syso
  sed 's/$/\r/' "$HERE/readme/windows.txt" > "$W/READ ME FIRST.txt"
  (cd "$DIST" && rm -f CanonCorps-windows.zip && zip -qr CanonCorps-windows.zip CanonCorps-windows && rm -rf CanonCorps-windows)
  echo "built dist/CanonCorps-windows.zip ($(du -h "$DIST/CanonCorps-windows.zip" | cut -f1))"
fi

if want linux; then
  if [ ! -x "$CACHE/appimagetool" ]; then
    curl -sL -o "$CACHE/appimagetool" https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage
    chmod +x "$CACHE/appimagetool"
  fi
  AD="$CACHE/AppDir"; rm -rf "$AD"; mkdir -p "$AD"
  build linux amd64 "" "$AD/AppRun"
  cp "$ICON" "$AD/canon-corps.png"
  cat > "$AD/canon-corps.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=Canon Corps
Comment=Canon Corps (test build)
Exec=AppRun
Icon=canon-corps
Categories=Game;
Terminal=false
EOF
  rm -f "$DIST/CanonCorps-x86_64.AppImage"
  APPIMAGE_EXTRACT_AND_RUN=1 ARCH=x86_64 VERSION="$VERSION" "$CACHE/appimagetool" --no-appstream "$AD" "$DIST/CanonCorps-x86_64.AppImage" >/dev/null 2>"$CACHE/appimagetool.log" \
    || { cat "$CACHE/appimagetool.log"; exit 1; }
  rm -rf "$AD"
  echo "built dist/CanonCorps-x86_64.AppImage ($(du -h "$DIST/CanonCorps-x86_64.AppImage" | cut -f1))"
fi
echo "version $VERSION"
