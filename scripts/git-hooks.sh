#!/bin/sh
set -eu

# 独立脚本避免 Windows 下 Lefthook 的多行命令引号解析问题。
action="$1"
shift

case "$action" in
  gitleaks)
    if command -v gitleaks > /dev/null 2>&1; then
      if [ -f .gitleaks-baseline.json ]; then
        gitleaks protect --staged --verbose --baseline-path .gitleaks-baseline.json
      else
        gitleaks protect --staged --verbose
      fi
    else
      echo "gitleaks is not installed; skipping secret scan."
    fi
    ;;
  format)
    if [ "$#" -gt 0 ]; then
      pnpm exec oxfmt --write --no-error-on-unmatched-pattern "$@"
    fi
    ;;
  lint)
    if [ "$#" -gt 0 ]; then
      pnpm exec oxlint --type-aware "$@"
    fi
    ;;
  *)
    echo "Unknown hook action: $action" >&2
    exit 1
    ;;
esac
