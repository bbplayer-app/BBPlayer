#!/bin/bash
# Runs inside the CocoaPods container started by prepare.sh.
set -eu
gem list -i '^cocoapods$' -v 1.17.0 >/dev/null 2>&1 || gem install cocoapods -v 1.17.0 --no-document
pod --version
export RCT_NEW_ARCH_ENABLED=1 NO_FLIPPER=1 EXPO_PRECOMPILED_FLAVOR=release
exec pod install
