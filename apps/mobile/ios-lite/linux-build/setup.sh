#!/bin/bash
# Installs the Linux iOS build toolchain: Swift and xtool. ios-build.sh runs this when needed.
# Safe to run again; finished steps are skipped.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/env.sh"

for tool in curl docker git gpg node npx pnpm python3 zip unzip; do
  command -v "$tool" >/dev/null || { echo "Missing required tool: $tool" >&2; exit 1; }
done
mkdir -p "$BB/downloads" "$BB/bin"

fetch() {
  [ -s "$2" ] && return 0
  # A connection can stall without ever failing, so treat a minute of no progress as an error.
  curl -fL --retry 20 --retry-all-errors --retry-delay 3 --speed-limit 1024 --speed-time 60 -C - -o "$2.part" "$1"
  mv "$2.part" "$2"
}

if [ ! -x "$SWIFT_HOME/usr/bin/swift" ]; then
  echo '== Swift toolchain'
  source /etc/os-release
  swift_name="swift-$SWIFT_VERSION-RELEASE-ubuntu$VERSION_ID"
  swift_url="${BBPLAYER_SWIFT_URL:-https://download.swift.org/swift-$SWIFT_VERSION-release/ubuntu${VERSION_ID/./}/swift-$SWIFT_VERSION-RELEASE/$swift_name.tar.gz}"
  tarball="$BB/downloads/$swift_name.tar.gz"
  fetch "$swift_url" "$tarball"
  fetch "$swift_url.sig" "$tarball.sig"
  keyring="$(mktemp -d)"
  trap 'rm -rf "$keyring"' EXIT
  curl -fsSL --compressed --retry 5 https://www.swift.org/keys/all-keys.asc | GNUPGHOME="$keyring" gpg --batch --quiet --import
  if ! GNUPGHOME="$keyring" gpg --batch --quiet --verify "$tarball.sig" "$tarball"; then
    rm -f "$tarball" "$tarball.sig"
    echo 'The Swift download failed verification and was removed. Run this again to download it afresh.' >&2
    exit 1
  fi
  # Extract to the side first, so an interrupted run can't pass for a finished install.
  rm -rf "$SWIFT_HOME.partial"
  mkdir -p "$SWIFT_HOME.partial"
  tar -xzf "$tarball" --strip-components=1 -C "$SWIFT_HOME.partial"
  rm -rf "$SWIFT_HOME"
  mv "$SWIFT_HOME.partial" "$SWIFT_HOME"
fi
if ! swift_version="$("$SWIFT_HOME/usr/bin/swift" --version 2>&1)"; then
  printf '%s\n' "$swift_version" >&2
  echo 'Swift could not start. Install the system libraries listed in README.md, then run this again.' >&2
  exit 1
fi
echo "$swift_version" | head -n 1

echo '== xtool'
fetch "https://github.com/xtool-org/xtool/releases/download/$XTOOL_VERSION/xtool-x86_64.AppImage" "$XTOOL"
chmod +x "$XTOOL"

if [ ! -d "$SDK_BUNDLE/Developer" ]; then
  cat >&2 <<EOF

The iOS SDK is not installed yet. Download Xcode.xip from
https://developer.apple.com/download/all/ and then run:

  PATH="$SWIFT_HOME/usr/bin:\$PATH" APPIMAGE_EXTRACT_AND_RUN=1 "$XTOOL" sdk install /path/to/Xcode.xip
  APPIMAGE_EXTRACT_AND_RUN=1 "$XTOOL" auth login --mode password

After that, run ios-build.sh again.
EOF
  exit 1
fi

# Expo's precompiled-module step links a small framework, which the xcrun shim stands in for.
if [ ! -f "$BB/bin/stub.dylib" ]; then
  echo 'void bbplayer_stub(void){}' | "$SWIFT_HOME/usr/bin/clang" -target arm64-apple-macos13 \
    -isysroot "$SDK_BUNDLE/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk" \
    -fuse-ld="$SDK_BUNDLE/toolset/bin/ld64.lld" -mlinker-version=1000 -x c - -dynamiclib -nostdlib \
    -Wl,-undefined,dynamic_lookup -install_name @rpath/Stub.framework/Stub -o "$BB/bin/stub.dylib"
fi

echo 'Toolchain ready.'
