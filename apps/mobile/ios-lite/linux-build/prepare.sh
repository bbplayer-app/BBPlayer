#!/bin/bash
# Generates apps/mobile/ios and its CocoaPods project, then exports the build graph for build.py.
# ios-build.sh runs this when the project is missing or no longer matches the repo.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/env.sh"

[ -f "$BB/bin/stub.dylib" ] || { echo 'Run setup.sh first.' >&2; exit 1; }
mkdir -p "$BB/build" "$PODS_HOME"

echo '== dependencies'
(cd "$REPO" && pnpm install --frozen-lockfile)

echo '== CocoaPods image'
docker build -q -t "$PODS_IMAGE" "$HERE"

echo '== expo prebuild'
cd "$MOBILE"
# Prebuild rewrites tracked splash assets, so undo that unless they already had local changes.
assets_status="$(git status --porcelain -- assets)"
CI=1 EXPO_NO_GIT_STATUS=1 EXPO_NO_TELEMETRY=1 APP_VARIANT=production \
  npx --no-install expo prebuild --platform ios --no-install --clean
if [ -z "$assets_status" ]; then
  git checkout -- assets
  git clean -fdq -- assets
fi
python3 "$HERE/patch-podfile.py" "$MOBILE/ios/Podfile" "$HERE/autolink-filter.js"

# Large downloads stall over HTTP/2 inside the container, so pin curl and git to HTTP/1.1.
printf 'http1.1\nretry = 5\nconnect-timeout = 30\n' > "$PODS_HOME/.curlrc"
printf '[http]\n\tversion = HTTP/1.1\n\tlowSpeedLimit = 1000\n\tlowSpeedTime = 60\n[core]\n\tcompression = 0\n' > "$PODS_HOME/.gitconfig"

node_root="$(dirname "$(dirname "$(readlink -f "$(command -v node)")")")"
pods_container() {
  docker run --rm -u "$(id -u):$(id -g)" \
    -v "$REPO:$REPO" -v "$BB:$BB" -v "$node_root:$node_root:ro" \
    -e HOME="$PODS_HOME" -e GEM_HOME="$PODS_HOME/gems" -e GEM_PATH="$PODS_HOME/gems" \
    -e CP_HOME_DIR="$PODS_HOME/cocoapods" -e CP_CACHE_DIR="$PODS_HOME/cache" \
    -e BBPLAYER_IOS_SDK="$SDK_BUNDLE" -e BBPLAYER_IOS_STUB="$BB/bin/stub.dylib" \
    -e RCT_REACT_NATIVE_MAVEN_MIRROR_ENABLED=0 -e TAR_OPTIONS=--wildcards \
    -e LANG=C.UTF-8 -e LC_ALL=C.UTF-8 -e COCOAPODS_DISABLE_STATS=1 \
    -e PATH="$HERE/pods-bin:$PODS_HOME/gems/bin:$node_root/bin:/usr/local/bin:/usr/bin:/bin" \
    -w "$MOBILE/ios" "$PODS_IMAGE" "$@"
}

echo '== pod install'
log="$BB/build/pod-install.log"
for attempt in 1 2 3 4 5; do
  pods_container bash "$HERE/pod-install.sh" > "$log" 2>&1 && break
  echo "  attempt $attempt of 5 failed, see $log"
  tail -n 3 "$log" | cut -c1-200
  [ "$attempt" != 5 ] || exit 1
done

echo '== build graph'
pods_container ruby "$HERE/export-manifest.rb" "$MOBILE/ios/Pods" "$BB/build/manifest.json"

# These came from the previous Pods checkout, so the next build has to recreate them.
rm -rf "$BB/build/products/Release-iphoneos/XCFrameworkIntermediates" "$BB/build/jsi-src"

project_fingerprint > "$BB/build/prepare.stamp"
echo 'iOS project ready.'
