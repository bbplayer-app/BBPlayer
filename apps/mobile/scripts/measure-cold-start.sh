#!/usr/bin/env bash
set -euo pipefail

# Measure cold-start performance metrics N times.
# Each iteration: force-stop → cold-start → wait for metrics → pull → save.
#
# Usage:
#   ./scripts/measure-cold-start.sh [N] [PACKAGE]
#
#   N        – iterations (default 10)
#   PACKAGE  – Android package name (default com.roitium.bbplayer)

N=${1:-10}
PKG=${2:-com.roitium.bbplayer}
OUTDIR="metrics_runs/$(date +%Y%m%d_%H%M%S)"
TIMEOUT_SEC=180
POLL_INTERVAL=1
LOG_MARKER="__PERF_METRICS__"

echo "=== Cold-Start Measurement ==="
echo "  Package:  $PKG"
echo "  Runs:     $N"
echo "  Output:   $OUTDIR"
echo ""

mkdir -p "$OUTDIR"
SUMMARY_FILE="$OUTDIR/summary.csv"
echo "run,coldLaunchTime,warmLaunchTime,bundleLoadTime,timeToFirstRender,timeToInteractive" > "$SUMMARY_FILE"

for ((i = 1; i <= N; i++)); do
	echo "--- Run $i/$N ---"

	echo "  Force-stopping..."
	adb shell am force-stop "$PKG" 2>/dev/null || true
	sleep 1

	echo "  Clearing logcat..."
	adb logcat -c 2>/dev/null || true

	echo "  Cold-starting..."
	# ponytail: monkey, not `am start` — am start's process start reason isn't
	# START_REASON_LAUNCHER, so expo-app-metrics classifies it as WARM. monkey
	# simulates a launcher icon tap → COLD.
	adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1

	echo "  Waiting for metrics (timeout ${TIMEOUT_SEC}s)..."
	elapsed=0
	metrics=""
	while [ $elapsed -lt $TIMEOUT_SEC ]; do
		# Read from logcat — works on both debug & release builds
		log_line=$(adb logcat -d 2>/dev/null | grep "$LOG_MARKER" | tail -1 || true)
		if [ -n "$log_line" ]; then
			metrics=$(echo "$log_line" | sed -n "s/.*${LOG_MARKER}\(.*\)__PERF_END__.*/\1/p")
			if [ -n "$metrics" ]; then
				break
			fi
		fi
		sleep "$POLL_INTERVAL"
		elapsed=$((elapsed + POLL_INTERVAL))
	done

	if [ -z "$metrics" ]; then
		echo "  [FAIL] No metrics after ${TIMEOUT_SEC}s — skipping"
		continue
	fi

	JSON_FILE="$OUTDIR/run_${i}.json"
	echo "$metrics" > "$JSON_FILE"
	echo "  Metrics saved → $JSON_FILE"

	coldLaunchTime=$(echo "$metrics" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('coldLaunchTime',''))" 2>/dev/null || echo "")
	warmLaunchTime=$(echo "$metrics" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('warmLaunchTime',''))" 2>/dev/null || echo "")
	bundleLoadTime=$(echo "$metrics" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('bundleLoadTime',''))" 2>/dev/null || echo "")
	timeToFirstRender=$(echo "$metrics" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('timeToFirstRender',''))" 2>/dev/null || echo "")
	timeToInteractive=$(echo "$metrics" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('timeToInteractive',''))" 2>/dev/null || echo "")

	echo "$i,$coldLaunchTime,$warmLaunchTime,$bundleLoadTime,$timeToFirstRender,$timeToInteractive" >> "$SUMMARY_FILE"

	echo "  coldLaunchTime=$coldLaunchTime warmLaunchTime=$warmLaunchTime bundleLoadTime=$bundleLoadTime timeToFirstRender=$timeToFirstRender timeToInteractive=$timeToInteractive"
done

echo ""
echo "=== Done ==="
echo "Results: $OUTDIR"
echo "Summary: $SUMMARY_FILE"

python3 - "$OUTDIR" "$SUMMARY_FILE" <<'PYEOF'
import sys, os, csv

outdir = sys.argv[1]
summary_file = sys.argv[2]

rows = []
with open(summary_file) as f:
    reader = csv.DictReader(f)
    for row in reader:
        rows.append({k: row[k] for k in row})

if not rows:
    print("No valid runs.")
    sys.exit(0)

metrics_keys = ["coldLaunchTime", "warmLaunchTime", "bundleLoadTime", "timeToFirstRender", "timeToInteractive"]

print("\n=== Averages (ms) ===")
for key in metrics_keys:
    vals = []
    for r in rows:
        try:
            v = float(r[key])
            if v > 0:
                vals.append(v)
        except (ValueError, TypeError):
            pass
    if vals:
        avg = sum(vals) / len(vals)
        print(f"  {key:>22s}: avg={avg:.1f}   min={min(vals):.1f}   max={max(vals):.1f}   n={len(vals)}")
    else:
        print(f"  {key:>22s}: (no data)")

report_path = os.path.join(outdir, "report.txt")
with open(report_path, "w") as f:
    f.write(f"Runs: {len(rows)}\n")
    for key in metrics_keys:
        vals = []
        for r in rows:
            try:
                v = float(r[key])
                if v > 0:
                    vals.append(v)
            except (ValueError, TypeError):
                pass
        if vals:
            avg = sum(vals) / len(vals)
            f.write(f"{key}: avg={avg:.1f} min={min(vals):.1f} max={max(vals):.1f} n={len(vals)}\n")

print(f"\nReport: {report_path}")
PYEOF
