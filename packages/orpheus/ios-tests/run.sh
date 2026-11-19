#!/bin/bash
# Runs the iOS player's logic tests on Linux. See README.md.
# Usage: run.sh [directory with another copy of the ios sources]
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ios="${1:-$here/../ios}"

# Any Linux Swift will do. Without one on hand, use the toolchain the Linux iOS build installs.
swiftc="${SWIFTC:-}"
if [ -z "$swiftc" ]; then
  source "$here/../../../apps/mobile/ios-lite/linux-build/env.sh"
  swiftc="$SWIFT_HOME/usr/bin/swiftc"
  [ -x "$swiftc" ] || swiftc="$(command -v swiftc || true)"
fi
if [ -z "$swiftc" ] || [ ! -x "$swiftc" ]; then
  echo 'No Swift compiler found. Set SWIFTC, or run the Linux iOS build once to install its toolchain.' >&2
  exit 1
fi

out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT

# The sources import Apple frameworks by name, so each name gets an empty module here.
for module in AVFoundation MediaPlayer ExpoModulesCore MMKV; do
  "$swiftc" -emit-module -parse-as-library -module-name "$module" \
    -emit-module-path "$out/$module.swiftmodule" "$here/Placeholder.swift"
done

# Linux has no Objective-C runtime, so selectors become names and their handlers plain methods.
sed -E 's/@objc private func/func/; s/#selector\(([A-Za-z]+)\)/"\1"/' \
  "$ios/OrpheusPlayerManager.swift" > "$out/OrpheusPlayerManager.swift"

"$swiftc" -I "$out" -module-name OrpheusTests -suppress-warnings -o "$out/tests" \
  "$here/Mocks.swift" "$here/main.swift" "$out/OrpheusPlayerManager.swift" \
  "$ios/OrpheusQueueManager.swift" "$ios/GeneralStorage.swift" "$ios/OrpheusModels.swift"

# The player logs its retries, which would bury the results.
"$out/tests" 2> >(grep -v '\[OrpheusPlayer\]' >&2)
