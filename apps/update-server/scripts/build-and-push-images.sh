#!/usr/bin/env bash
# Build the linux/amd64 update-server Docker images and push them to Docker Hub.
#
# The two images are built in parallel; pushes start only after both builds
# succeed. Image tags can be overridden via UPDATE_SERVER_IMAGE and
# UPDATE_SERVER_WEB_IMAGE (same variables docker-compose.yml reads).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

WEB_IMAGE="${UPDATE_SERVER_WEB_IMAGE:-yanyaobbb/bbplayer-updates-web:latest}"
API_IMAGE="${UPDATE_SERVER_IMAGE:-yanyaobbb/bbplayer-updates:latest}"

build_api() {
	cd "$REPO_ROOT/apps/update-server"
	docker build --platform linux/amd64 -t "$API_IMAGE" .
}

build_web() {
	cd "$REPO_ROOT"
	docker build --platform linux/amd64 -t "$WEB_IMAGE" \
		-f apps/update-server/web/Dockerfile .
}

prefix_log() {
	# Prefix each line of stdin with a tag so output from parallel
	# builds/pushes stays distinguishable, and stream it live.
	local prefix="$1"
	local line
	while IFS= read -r line; do
		printf '%s %s\n' "$prefix" "$line"
	done
}

echo "==> Building $API_IMAGE"
build_api 2>&1 | prefix_log "[api] " &
API_PID=$!

echo "==> Building $WEB_IMAGE"
build_web 2>&1 | prefix_log "[web] " &
WEB_PID=$!

STATUS=0
wait "$API_PID" || { echo "API build failed" >&2; STATUS=1; }
wait "$WEB_PID" || { echo "Web build failed" >&2; STATUS=1; }
if [ "$STATUS" -ne 0 ]; then
	exit "$STATUS"
fi

echo "==> Both images built, pushing to Docker Hub"
docker push "$API_IMAGE" 2>&1 | prefix_log "[api push] " &
API_PUSH_PID=$!
docker push "$WEB_IMAGE" 2>&1 | prefix_log "[web push] " &
WEB_PUSH_PID=$!

STATUS=0
wait "$API_PUSH_PID" || { echo "API push failed" >&2; STATUS=1; }
wait "$WEB_PUSH_PID" || { echo "Web push failed" >&2; STATUS=1; }
if [ "$STATUS" -ne 0 ]; then
	exit "$STATUS"
fi

echo "==> Done: $API_IMAGE, $WEB_IMAGE"
