#!/bin/bash
# The one command for the Linux iOS build: sets up whatever is missing, rebuilds what changed,
# packages BBPlayer.app and installs it on the iPhone.
# Usage: ios-build.sh [--no-native] [--no-install]
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/env.sh"

native=1; install=1
for arg in "$@"; do
  case "$arg" in
    --no-native) native=0 ;;
    --no-install) install=0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done
export PYTHONDONTWRITEBYTECODE=1

# setup.sh stops with instructions if the iOS SDK still has to be installed.
if [ ! -x "$SWIFT_HOME/usr/bin/swift" ] || [ ! -x "$XTOOL" ] || [ ! -f "$BB/bin/stub.dylib" ] || [ ! -d "$SDK_BUNDLE/Developer" ]; then
  "$HERE/setup.sh"
fi

# Check signing and the phone first, so a long build doesn't end in a failed install.
if [ "$install" = 1 ]; then
  # WSL reaches the iPhone through Windows' Apple Mobile Device Service; see README.md.
  wsl_gateway=""
  if grep -qi microsoft /proc/version; then
    wsl_gateway="$(ip route show default | awk '{print $3}')"
    export USBMUXD_SOCKET_ADDRESS="${USBMUXD_SOCKET_ADDRESS:-$wsl_gateway:27015}"
  fi

  auth_status="$("$XTOOL" auth status 2>&1 || true)"
  case "$auth_status" in
    "Logged in"*) ;;
    *)
      echo 'Sign in to your Apple ID, then run this again:' >&2
      echo "  \"$XTOOL\" auth login --mode password" >&2
      exit 1
      ;;
  esac

  devices="$(timeout 20 "$XTOOL" devices 2>/dev/null || true)"
  if [ -z "$devices" ]; then
    echo 'No iPhone found. Connect it with a cable, unlock it and trust this computer, then run this again.' >&2
    if [ -n "$wsl_gateway" ]; then
      cat >&2 <<EOF

On WSL the iPhone is reached through Windows. Run these once in an administrator PowerShell:

  netsh interface portproxy set v4tov4 listenaddress=$wsl_gateway listenport=27015 connectaddress=127.0.0.1 connectport=27015
  New-NetFirewallRule -DisplayName "WSL usbmuxd" -Direction Inbound -InterfaceAlias "vEthernet (WSL (Hyper-V firewall))" -Protocol TCP -LocalPort 27015 -Action Allow
EOF
    fi
    exit 1
  fi
fi

if [ ! -f "$BB/build/manifest.json" ] || { [ "$native" = 1 ] && [ "$(project_fingerprint)" != "$(cat "$BB/build/prepare.stamp" 2>/dev/null || true)" ]; }; then
  "$HERE/prepare.sh"
fi

echo '== JS bundle'
mkdir -p "$BB/build/js"
cd "$MOBILE"
if ! CI=1 EXPO_NO_TELEMETRY=1 NODE_ENV=production APP_VARIANT=production BBPLAYER_IOS_LITE=1 \
  npx --no-install expo export:embed --platform ios --dev false --entry-file index.js \
  --bundle-output "$BB/build/js/main.jsbundle" --assets-dest "$BB/build/js/assets" --reset-cache > "$BB/build/js/bundle.log" 2>&1; then
  tail -n 20 "$BB/build/js/bundle.log" >&2
  exit 1
fi

cd "$HERE"
# build.py writes this once the prebuilt frameworks and ExpoModulesJSI are both in place.
prebuilts_done="$BB/build/prebuilts.done"
if [ "$native" = 1 ] || [ ! -f "$prebuilts_done" ]; then
  skip=()
  [ ! -f "$prebuilts_done" ] || skip=(--skip-jsi --skip-prebuilts)
  python3 -u build.py "${skip[@]}"
fi
python3 -u build-app.py

if [ "$install" = 1 ]; then
  cd "$HOME"
  # xtool sometimes fails at Provisioning or hangs after installing; a retry clears both.
  for attempt in 1 2 3; do
    if timeout 300 "$XTOOL" install "$BB/build/BBPlayer.app" 2>&1 | tr '\r' '\n' | tail -n 2; then
      exit 0
    fi
    echo "  install attempt $attempt of 3 failed"
  done
  exit 1
fi
