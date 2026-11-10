# Settings shared by the Linux iOS build scripts. Source this file, don't run it.
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE="$(cd "$HERE/../.." && pwd)"
REPO="$(cd "$MOBILE/../.." && pwd)"

BB="${BBPLAYER_IOS_HOME:-$HOME/.local/share/bbplayer-ios}"
SWIFT_VERSION=6.4.2
XTOOL_VERSION=1.24.0
SWIFT_HOME="$BB/swift-$SWIFT_VERSION"
XTOOL="$BB/downloads/xtool-$XTOOL_VERSION-x86_64.AppImage"
SDK_BUNDLE="$HOME/.swiftpm/swift-sdks/darwin.artifactbundle"
PODS_IMAGE=bbplayer-ios-pods
PODS_HOME="$BB/pods-home"

export BBPLAYER_IOS_HOME="$BB"
export BBPLAYER_IOS_SWIFT="$SWIFT_HOME"
export PATH="$BB/bin:$PATH"
# xtool is an AppImage; running it extracted means systems without FUSE work too.
export APPIMAGE_EXTRACT_AND_RUN=1

# Changes when the generated iOS project no longer matches the repo.
project_fingerprint() {
  (
    cd "$REPO"
    find packages/*/ios -type f \( -name '*.swift' -o -name '*.h' -o -name '*.m' -o -name '*.mm' \) | LC_ALL=C sort
    find packages -maxdepth 3 -type f \( -name '*.podspec' -o -name 'expo-module.config.json' \) | LC_ALL=C sort | xargs -r -d '\n' sha256sum
    sha256sum pnpm-lock.yaml apps/mobile/app.config.ts "$HERE/prepare.sh" "$HERE/patch-podfile.py" \
      "$HERE/autolink-filter.js" "$HERE/pod-install.sh" "$HERE/export-manifest.rb" "$HERE/Dockerfile"
  ) | sha256sum | cut -d' ' -f1
}
