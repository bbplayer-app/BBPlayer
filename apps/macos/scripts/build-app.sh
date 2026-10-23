#!/bin/zsh
set -euo pipefail
TASK_ROOT="${0:A:h:h}"
BUILD_CONFIGURATION="${1:-release}"
if [[ "$BUILD_CONFIGURATION" != release && "$BUILD_CONFIGURATION" != debug ]]; then
  print -u2 'Usage: build-app.sh [release|debug]'
  exit 2
fi
swift build --package-path "$TASK_ROOT" -c "$BUILD_CONFIGURATION" --product BBPlayerMac
BUILD_BIN="$(swift build --package-path "$TASK_ROOT" -c "$BUILD_CONFIGURATION" --show-bin-path)"
BUILD_APP="$TASK_ROOT/build/BBPlayer.app"
mkdir -p "$BUILD_APP/Contents/MacOS" "$BUILD_APP/Contents/Resources"
cp "$BUILD_BIN/BBPlayerMac" "$BUILD_APP/Contents/MacOS/BBPlayerMac"
cp "$TASK_ROOT/THIRD_PARTY_NOTICES.md" "$BUILD_APP/Contents/Resources/THIRD_PARTY_NOTICES.md"
cp "$TASK_ROOT/Info.plist" "$BUILD_APP/Contents/Info.plist"
for RESOURCE_BUNDLE in "$BUILD_BIN"/*.bundle(N); do
  ditto "$RESOURCE_BUNDLE" "$BUILD_APP/Contents/Resources/${RESOURCE_BUNDLE:t}"
done
codesign --force --deep --sign - "$BUILD_APP"
print "$BUILD_APP"
du -sh "$BUILD_APP"
