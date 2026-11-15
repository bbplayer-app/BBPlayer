#!/usr/bin/env bash
set -euo pipefail

# 测量 BBPlayer 后台播放时的真实功耗与逐线程数据。
#
# 采样器推到设备上脱离 adb 运行，所以 start 之后可以（也应该）拔掉 USB：
# 插着线时手机在充电，电流/电量数据都没有意义。到时间后插回再 collect。
#
# 用法:
#   ./scripts/power/measure-background-power.sh start   [选项]   开始测量
#   ./scripts/power/measure-background-power.sh status            查看进度
#   ./scripts/power/measure-background-power.sh collect           拉取数据并生成报告
#   ./scripts/power/measure-background-power.sh stop              提前结束（之后再 collect）
#   ./scripts/power/measure-background-power.sh analyze <目录>    对已拉取的数据重新生成报告
#
# start 选项:
#   -m <分钟>        测量时长，默认 30
#   -i <秒>          采样间隔，默认 10
#   -p <包名>        默认 com.roitium.bbplayer
#   -n <个数>        详细 sched trace 快照个数（均匀分布），默认 3，0 关闭
#   -d <秒>          每个快照时长，默认 20
#   --keep-screen    不自动回桌面并熄屏
#   --wait           不拔线，主机端等待结束后自动 collect（只适合无线 adb）
#
# 设备用 ANDROID_SERIAL 指定。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEV_DIR=/data/local/tmp/bbpower
TRACE_DIR=/data/misc/perfetto-traces
VENV="${XDG_CACHE_HOME:-$HOME/.cache}/bbplayer-power-venv"

die() {
	echo "错误: $*" >&2
	exit 1
}

adb_sh() { adb shell -n "$@" | tr -d '\r'; }

check_device() {
	local n
	n=$(adb devices | awk 'NR>1 && $2=="device"' | wc -l | tr -d ' ')
	if [ -z "${ANDROID_SERIAL:-}" ] && [ "$n" -gt 1 ]; then
		adb devices -l
		die "连接了多台设备，请用 ANDROID_SERIAL=<serial> 指定"
	fi
	[ "$n" -ge 1 ] || die "没有找到 adb 设备"
}

write_configs() {
	local tmp=$1 pkg=$2 dur_ms=$3

	cat > "$tmp/long.cfg" <<EOF
buffers { size_kb: 16384 fill_policy: RING_BUFFER }
data_sources {
  config {
    name: "android.power"
    android_power_config {
      battery_poll_ms: 1000
      battery_counters: BATTERY_COUNTER_CAPACITY_PERCENT
      battery_counters: BATTERY_COUNTER_CHARGE
      battery_counters: BATTERY_COUNTER_CURRENT
      battery_counters: BATTERY_COUNTER_VOLTAGE
      collect_power_rails: true
      collect_energy_estimation_breakdown: true
    }
  }
}
data_sources {
  config {
    name: "linux.sys_stats"
    sys_stats_config {
      stat_period_ms: 5000
      stat_counters: STAT_CPU_TIMES
      stat_counters: STAT_FORK_COUNT
      cpufreq_period_ms: 2000
    }
  }
}
data_sources {
  config {
    name: "linux.process_stats"
    process_stats_config {
      scan_all_processes_on_start: true
      proc_stats_poll_ms: 10000
    }
  }
}
duration_ms: $dur_ms
write_into_file: true
file_write_period_ms: 5000
flush_period_ms: 30000
max_file_size_bytes: 300000000
EOF

	cat > "$tmp/snapshot.cfg.tpl" <<'EOF'
buffers { size_kb: 131072 fill_policy: RING_BUFFER }
buffers { size_kb: 8192 fill_policy: RING_BUFFER }
data_sources {
  config {
    name: "linux.ftrace"
    target_buffer: 0
    ftrace_config {
      ftrace_events: "sched/sched_switch"
      ftrace_events: "sched/sched_wakeup"
      ftrace_events: "sched/sched_wakeup_new"
      ftrace_events: "sched/sched_waking"
      ftrace_events: "sched/sched_process_exit"
      ftrace_events: "sched/sched_process_free"
      ftrace_events: "task/task_newtask"
      ftrace_events: "task/task_rename"
      ftrace_events: "power/cpu_frequency"
      ftrace_events: "power/cpu_idle"
      ftrace_events: "power/suspend_resume"
      ftrace_events: "power/wakeup_source_activate"
      ftrace_events: "power/wakeup_source_deactivate"
      ftrace_events: "binder/binder_transaction"
      ftrace_events: "binder/binder_transaction_received"
      atrace_categories: "audio"
      atrace_categories: "am"
      atrace_categories: "power"
      atrace_categories: "binder_driver"
      atrace_apps: "__PKG__"
      symbolize_ksyms: false
    }
  }
}
data_sources {
  config {
    name: "linux.process_stats"
    target_buffer: 1
    process_stats_config { scan_all_processes_on_start: true }
  }
}
data_sources { config { name: "android.packages_list" target_buffer: 1 } }
duration_ms: __DUR__
EOF
}

cmd_start() {
	local minutes=30 interval=10 pkg=com.roitium.bbplayer snaps=3 snapdur=20 screen_off=1 wait=0
	while [ $# -gt 0 ]; do
		case "$1" in
			-m) minutes=$2; shift 2 ;;
			-i) interval=$2; shift 2 ;;
			-p) pkg=$2; shift 2 ;;
			-n) snaps=$2; shift 2 ;;
			-d) snapdur=$2; shift 2 ;;
			--keep-screen) screen_off=0; shift ;;
			--wait) wait=1; shift ;;
			*) die "未知参数 $1" ;;
		esac
	done

	check_device

	if [ -n "$(adb_sh "cat $DEV_DIR/sampler.pid 2>/dev/null")" ] && [ -z "$(adb_sh "ls $DEV_DIR/DONE 2>/dev/null")" ]; then
		local old
		old=$(adb_sh "cat $DEV_DIR/sampler.pid")
		if [ -n "$(adb_sh "ls -d /proc/$old 2>/dev/null")" ]; then
			die "设备上已有一次测量在运行（pid $old），先 status / stop"
		fi
	fi

	local pid
	pid=$(adb_sh "pidof $pkg" || true)
	[ -n "$pid" ] || die "$pkg 没有在运行，请先打开 app 并开始播放"

	if ! adb_sh "dumpsys media_session" | grep -A20 "package=$pkg" | grep -qE "state=PLAYING|state=3[ ,)]"; then
		echo "警告: 没检测到 $pkg 处于播放状态，请确认已经在播放"
		read -r -p "继续？[y/N] " ans
		[ "$ans" = y ] || exit 1
	fi

	local qemu
	qemu=$(adb_sh "getprop ro.boot.qemu")$(adb_sh "getprop ro.kernel.qemu")
	if [ -n "$qemu" ] && [ "$qemu" != "0" ] && [ "$qemu" != "00" ]; then
		echo "警告: 这是模拟器，电池/功耗数据是假的，只有 CPU / 线程 / 唤醒数据有参考价值"
	fi

	local duration=$((minutes * 60))
	local snap_offsets=""
	if [ "$snaps" -gt 0 ]; then
		local k
		for ((k = 1; k <= snaps; k++)); do
			snap_offsets="${snap_offsets:+$snap_offsets,}$((duration * k / (snaps + 1)))"
		done
	fi

	local tmp
	tmp=$(mktemp -d)
	write_configs "$tmp" "$pkg" $(((duration + 120) * 1000))

	echo "准备设备..."
	adb_sh "rm -rf $DEV_DIR; mkdir -p $DEV_DIR; rm -f $TRACE_DIR/bbpower_*.pftrace" >/dev/null
	adb push "$SCRIPT_DIR/device-sampler.sh" "$tmp/long.cfg" "$tmp/snapshot.cfg.tpl" "$DEV_DIR/" >/dev/null
	rm -rf "$tmp"
	adb_sh "chmod 755 $DEV_DIR/device-sampler.sh"

	# 清空电池统计并开启完整 wakelock 历史，之后 batterystats 只包含本次测量
	adb_sh "dumpsys batterystats --reset" >/dev/null
	adb_sh "dumpsys batterystats --enable full-wake-history" >/dev/null || true

	# 只后台化单条命令并重定向全部 fd，否则后台子 shell 会占着 adb 的输出管道，adb shell 要等测量结束才返回
	adb_sh "nohup setsid $DEV_DIR/device-sampler.sh '$pkg' $duration $interval $DEV_DIR '$snap_offsets' $snapdur > $DEV_DIR/sampler.log 2>&1 < /dev/null &"
	sleep 2
	adb_sh "cat $DEV_DIR/events.log 2>/dev/null" || true
	[ -n "$(adb_sh "cat $DEV_DIR/sampler.pid 2>/dev/null")" ] || die "采样器没有启动，见 adb shell cat $DEV_DIR/sampler.log"

	if [ "$screen_off" = 1 ]; then
		adb_sh "input keyevent KEYCODE_HOME" >/dev/null
		sleep 1
		adb_sh "input keyevent KEYCODE_SLEEP" >/dev/null
	fi

	local end_at
	end_at=$(date -v+"${minutes}"M +%H:%M 2>/dev/null || date -d "+$minutes min" +%H:%M)
	echo ""
	echo "=== 测量已开始：${minutes} 分钟，每 ${interval}s 采样一次，预计 $end_at 结束 ==="
	[ -n "$snap_offsets" ] && echo "    详细 sched trace 快照时间点（秒）: $snap_offsets，每个 ${snapdur}s"

	if [ "$wait" = 1 ]; then
		echo "    --wait 模式：主机端等待结束..."
		while [ -z "$(adb_sh "ls $DEV_DIR/DONE 2>/dev/null")" ]; do
			sleep 30
		done
		cmd_collect
		return
	fi

	cat <<EOF

现在请：
  1. 拔掉 USB 线（插着线会充电，功耗数据无效）
  2. 保持手机锁屏、不要操作，让它在后台播放
  3. $end_at 之后插回 USB，运行：
       $0 collect

中途想看进度可以插线运行 $0 status（会短暂充电，尽量少用）
EOF
}

cmd_status() {
	check_device
	adb_sh "cat $DEV_DIR/events.log 2>/dev/null" || true
	local start dur now
	start=$(adb_sh "grep start_epoch $DEV_DIR/meta.txt | cut -d= -f2")
	dur=$(adb_sh "grep ^duration $DEV_DIR/meta.txt | cut -d= -f2")
	now=$(adb_sh "date +%s")
	[ -n "$start" ] || die "设备上没有测量数据"
	echo "已进行 $(((now - start) / 60)) / $((dur / 60)) 分钟，样本数 $(adb_sh "grep -c '^=== T' $DEV_DIR/samples.txt 2>/dev/null")"
	if [ -n "$(adb_sh "ls $DEV_DIR/DONE 2>/dev/null")" ]; then
		echo "已完成，可以 collect"
	fi
}

cmd_stop() {
	check_device
	local p
	p=$(adb_sh "cat $DEV_DIR/sampler.pid 2>/dev/null")
	[ -n "$p" ] || die "没有在运行的测量"
	# 把结束时间改成现在：直接改 duration 不行，给采样器发 TERM 后手动补做收尾
	adb_sh "kill $p 2>/dev/null; pkill -TERM -f 'bbpower_[ls]' 2>/dev/null" || true
	adb_sh "cd $DEV_DIR && echo \"\$(date +%s) STOPPED_MANUALLY\" >> events.log && dumpsys batterystats \$(grep ^pkg= meta.txt | cut -d= -f2) > batterystats_pkg.txt && dumpsys batterystats > batterystats_full.txt && dumpsys batterystats --usage > batterystats_usage.txt 2>&1; dumpsys alarm > alarm.txt; dumpsys jobscheduler > jobscheduler.txt; dumpsys power > power_final.txt; date +%s > DONE"
	sleep 3
	echo "已停止，现在可以 collect"
}

ensure_perfetto_py() {
	if python3 -c "import perfetto" 2>/dev/null; then
		PY=python3
		return
	fi
	if [ ! -x "$VENV/bin/python" ]; then
		echo "首次运行：在 $VENV 安装 perfetto trace processor（用于解析电池/功耗 trace）..."
		python3 -m venv "$VENV" && "$VENV/bin/pip" install -q perfetto || {
			echo "安装失败，将跳过 trace 分析，只生成基于 /proc 的报告"
			PY=python3
			return
		}
	fi
	PY="$VENV/bin/python"
}

cmd_collect() {
	check_device
	[ -n "$(adb_sh "ls $DEV_DIR/DONE 2>/dev/null")" ] || die "测量还没结束（status 查看进度，或 stop 提前结束）"

	local out
	out="$MOBILE_DIR/metrics_runs/power_$(date +%Y%m%d_%H%M%S)"
	mkdir -p "$out/traces"
	adb pull "$DEV_DIR/." "$out/" >/dev/null
	for f in $(adb_sh "ls $TRACE_DIR/ 2>/dev/null | grep '^bbpower_'"); do
		adb pull "$TRACE_DIR/$f" "$out/traces/" >/dev/null
	done
	echo "数据已拉取到 $out"

	cmd_analyze "$out"
}

cmd_analyze() {
	local out=${1:?需要数据目录}
	ensure_perfetto_py
	"$PY" -I "$SCRIPT_DIR/analyze-background-power.py" "$out"
	echo ""
	echo "报告: $out/report.md"
}

case "${1:-}" in
	start) shift; cmd_start "$@" ;;
	status) cmd_status ;;
	stop) cmd_stop ;;
	collect) cmd_collect ;;
	analyze) shift; cmd_analyze "$@" ;;
	*) sed -n '3,25p' "$0"; exit 1 ;;
esac
