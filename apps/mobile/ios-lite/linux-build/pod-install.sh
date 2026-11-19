#!/bin/bash
# Runs inside the CocoaPods container started by prepare.sh.
set -eu
gem list -i '^cocoapods$' -v 1.17.0 >/dev/null 2>&1 || gem install cocoapods -v 1.17.0 --no-document
pod --version
export RCT_NEW_ARCH_ENABLED=1 NO_FLIPPER=1 EXPO_PRECOMPILED_FLAVOR=release
pod install

# When its one download check fails, CocoaPods quietly switches React Native or Hermes to a
# source build, which build.py can't compile. Fail instead, so that prepare.sh tries again.
for archive in ReactNativeCore-artifacts/reactnative-core \
  ReactNativeDependencies-artifacts/reactnative-dependencies hermes-engine-artifacts/hermes-ios; do
  if ! compgen -G "Pods/$archive-*-release.tar.gz" > /dev/null; then
    echo "Pods/$archive-*-release.tar.gz is missing because a prebuilt download check failed." >&2
    exit 1
  fi
done
