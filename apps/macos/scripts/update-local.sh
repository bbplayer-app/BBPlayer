#!/bin/zsh
# Test/build, push verified main, rebuild after the push, then install locally.
set -euo pipefail
APP_ROOT="${0:A:h:h}"
REPO_ROOT="${APP_ROOT:h:h}"
MODE="${1:-update}"
if [[ "$MODE" == --help ]]; then
  print 'Usage: update-local.sh [--install-only|--help]'
  print 'Default: test, build Release, push main, rebuild Release after push, install.'
  print -- '--install-only: test, build and install the current branch without contacting GitHub.'
  print 'Quit BBPlayer and commit your changes first. No commits are created automatically.'
  exit 0
fi
[[ $# -le 1 && ( "$MODE" == update || "$MODE" == --install-only ) ]] || exit 2
cd "$REPO_ROOT"
die() { print -u2 -- "$*"; exit 1; }
START_BRANCH="$(git branch --show-current)"
[[ -n "$START_BRANCH" ]] || die 'Check out a branch first.'
[[ "$MODE" == --install-only || "$START_BRANCH" == main ]] || die 'Switch to main first, or use --install-only for an authorized local feature build.'
[[ -z "$(git status --porcelain --untracked-files=normal)" ]] || die 'Commit or set aside changes first.'
START_COMMIT="$(git rev-parse HEAD)"
check_revision() {
  [[ -z "$(git status --porcelain --untracked-files=normal)" ]] || die 'Worktree changed during the update; stopped.'
  [[ "$(git branch --show-current)" == "$START_BRANCH" && "$(git rev-parse HEAD)" == "$START_COMMIT" ]] || die 'Branch or commit changed during the update; stopped.'
}
check_stopped() {
  local process_status=0
  pgrep -x BBPlayerMac >/dev/null || process_status=$?
  [[ $process_status == 1 ]] || die 'Quit BBPlayer first, or check process-list access.'
}
check_stopped
if [[ "$MODE" == update ]]; then
  FETCH_URL="$(git remote get-url --all origin)"
  PUSH_URL="$(git remote get-url --push --all origin)"
  [[ "$FETCH_URL" == "$PUSH_URL" ]] || die 'Origin fetch and push URLs must match.'
  LOGIN="$(gh api user --jq .login)"
  EXPECTED_URL="https://github.com/${LOGIN}/BBPlayer-macOS.git"
  [[ "$PUSH_URL" == "$EXPECTED_URL" ]] || die 'Origin must be the signed-in account’s BBPlayer-macOS HTTPS repository.'
  PERSONAL_REPO="${LOGIN}/BBPlayer-macOS"
  [[ "$(gh api "repos/$PERSONAL_REPO" --jq .full_name)" == "$PERSONAL_REPO" ]] || die 'Repository identity mismatch.'
  [[ "$(gh api "repos/$PERSONAL_REPO/actions/permissions" --jq .enabled)" == false ]] || die 'GitHub Actions must remain disabled.'
fi
DESTINATION=/Applications/BBPlayer.app
BUNDLE_ID=com.bbplayer.macos
if [[ -e "$DESTINATION" || -L "$DESTINATION" ]]; then
  [[ -d "$DESTINATION" && ! -L "$DESTINATION" ]] || die 'The installed app must be a regular app directory.'
  [[ "$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$DESTINATION/Contents/Info.plist")" == "$BUNDLE_ID" ]] || die 'Installed app identity mismatch.'
fi
[[ -w /Applications ]] || die 'Applications is not writable; no push or installation performed.'
swift test --package-path "$APP_ROOT"
"$APP_ROOT/scripts/build-app.sh" release
SOURCE_APP="$APP_ROOT/build/BBPlayer.app"
INITIAL_SIGNING_REQUIREMENT="$(codesign -d -r- "$SOURCE_APP" 2>&1)"
[[ "$INITIAL_SIGNING_REQUIREMENT" == *'certificate '* ]] || die 'Configure persistent signing before pushing or installing; ad-hoc builds are not accepted.'
check_stopped
check_revision
if [[ "$MODE" == update ]]; then
  [[ "$(git remote get-url --all origin)" == "$EXPECTED_URL" && "$(git remote get-url --push --all origin)" == "$EXPECTED_URL" ]] || die 'Origin changed during the build; stopped.'
  git -c push.followTags=false push --no-follow-tags origin refs/heads/main:refs/heads/main
  # Build again after every successful push; install only that post-push result.
  "$APP_ROOT/scripts/build-app.sh" release
  check_stopped
  check_revision
fi
codesign --verify --deep --strict "$SOURCE_APP"
SIGNING_REQUIREMENT="$(codesign -d -r- "$SOURCE_APP" 2>&1)"
[[ "$SIGNING_REQUIREMENT" == *'certificate '* ]] || die 'Configure persistent signing before installation; ad-hoc builds are not installed.'
[[ "$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$SOURCE_APP/Contents/Info.plist")" == "$BUNDLE_ID" ]] || die 'Built app identity mismatch.'
STAGING="$(mktemp -d /Applications/.BBPlayer-update.XXXXXX)"
cleanup() {
  if [[ -d "$STAGING/previous.app" ]]; then
    print -u2 -- "Previous app preserved at $STAGING/previous.app"
  else
    rm -rf -- "$STAGING"
  fi
}
trap cleanup EXIT
ditto "$SOURCE_APP" "$STAGING/BBPlayer.app"
codesign --verify --deep --strict "$STAGING/BBPlayer.app"
check_stopped
check_revision
if [[ -d "$DESTINATION" ]]; then
  mv "$DESTINATION" "$STAGING/previous.app"
fi
if ! mv "$STAGING/BBPlayer.app" "$DESTINATION"; then
  [[ ! -d "$STAGING/previous.app" ]] || mv "$STAGING/previous.app" "$DESTINATION"
  die 'Installation failed; the previous app was restored if possible.'
fi
if ! codesign --verify --deep --strict "$DESTINATION"; then
  mv "$DESTINATION" "$STAGING/failed.app"
  [[ ! -d "$STAGING/previous.app" ]] || mv "$STAGING/previous.app" "$DESTINATION"
  die 'Installed signature verification failed; previous app restored if available.'
fi
if [[ -d "$STAGING/previous.app" ]]; then
  BACKUP_ROOT="$APP_ROOT/build/local-updates.noindex"
  mkdir -p "$BACKUP_ROOT"
  BACKUP_FOLDER="$(mktemp -d "$BACKUP_ROOT/backup.XXXXXX")"
  mv "$STAGING/previous.app" "$BACKUP_FOLDER/BBPlayer.app"
  print -- "Previous app: $BACKUP_FOLDER/BBPlayer.app"
fi
print -- "Installed: $DESTINATION"
python3 "$APP_ROOT/scripts/cleanup-local-apps.py" --installed "$DESTINATION" --build-root "$APP_ROOT/build"
print 'The app was not launched. Open it when ready.'
