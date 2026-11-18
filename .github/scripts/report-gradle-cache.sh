#!/usr/bin/env bash
set -euo pipefail

gradle_cache_dir="${GRADLE_USER_HOME:-$HOME/.gradle}/caches"
if [[ -d "$gradle_cache_dir" ]] && [[ -n "$(find "$gradle_cache_dir" -type f ! -name '*.lock' ! -name 'gc.properties' ! -name 'CACHEDIR.TAG' -print -quit)" ]]; then
  gradle_cache_status='Restored cache content. See the Setup Gradle cache summary for the matched keys and sizes.'
else
  gradle_cache_status='No matching cache content was restored. A regular build is needed to seed this cache.'
  echo "::warning::$gradle_cache_status"
fi

{
  echo '### Gradle cache keepalive'
  printf '\nBranch: `%s` · ABI: `%s`\n\n' "$GITHUB_REF_NAME" "$ABI_FILTERS"
  printf '%s\n\n' "$gradle_cache_status"
  echo 'Read-only restoration: no Gradle execution, dependency installation, APK build, or cache upload.'
} >> "$GITHUB_STEP_SUMMARY"
