#!/system/bin/sh
# 在设备上运行（shell 用户），与 adb 会话脱离，拔掉 USB 后仍继续采样。
# 由 measure-background-power.sh 推送并启动，不要手动调用。
#
# 用法: device-sampler.sh <PKG> <DURATION_SEC> <INTERVAL_SEC> <OUTDIR> <SNAP_OFFSETS> <SNAP_DUR_SEC> <WARMUP_SEC> <WAIT_UNPLUG>
#   SNAP_OFFSETS: 逗号分隔的秒数（相对开始时间），在这些时间点录制详细 sched trace；空字符串表示不录
#   WAIT_UNPLUG: 1 表示先等拔线再预热，0 表示直接预热

PKG=$1
DUR=$2
INT=$3
OUT=$4
SNAPS=$5
SNAPDUR=$6
WARMUP=${7:-0}
WAIT_UNPLUG=${8:-0}
# 一直没拔线的话最多等这么久，然后照常开始（报告里会显示充电中的采样）
UNPLUG_TIMEOUT=1800
TRACEDIR=/data/misc/perfetto-traces

mkdir -p "$OUT"
cd "$OUT" || exit 1
echo $$ > sampler.pid
rm -f DONE

log() { echo "$(date +%s) $*" >> events.log; }

is_powered() {
	dumpsys battery | grep -qE '(AC|USB|Wireless|Dock) powered: true'
}

# 等拔线，再预热一段时间：刚拔线时电池还在从充电状态切换，熄屏后系统也还在收尾，
# 这段时间的电流和 CPU 都不代表稳定的后台播放
if [ "$WAIT_UNPLUG" = 1 ]; then
	log "WAIT_UNPLUG"
	waited=0
	while is_powered && [ "$waited" -lt "$UNPLUG_TIMEOUT" ]; do
		sleep 2
		waited=$((waited + 2))
	done
	if is_powered; then
		log "UNPLUG_TIMEOUT"
	else
		log "UNPLUGGED"
	fi
fi
if [ "$WARMUP" -gt 0 ]; then
	log "WARMUP ${WARMUP}s"
	sleep "$WARMUP"
fi

# 清空电池统计并开启完整 wakelock 历史，之后 batterystats 只包含本次测量（不含插线和预热阶段）
dumpsys batterystats --reset > /dev/null 2>&1
dumpsys batterystats --enable full-wake-history > /dev/null 2>&1

START=$(date +%s)
END=$((START + DUR))

app_pids=""
other_pids=""
refresh_pids() {
	app_pids=""
	other_pids=""
	ps -A -o PID,NAME > .ps 2>/dev/null
	while read -r p n; do
		case "$n" in
			"$PKG" | "$PKG":*) app_pids="$app_pids $p" ;;
			# 关注的系统进程：后台播放的功耗很多不在 app 本身
			audioserver | android.hardware.audio* | vendor.audio* | media.swcodec | media.codec | mediaserver | media.extractor | system_server | surfaceflinger | com.android.bluetooth | android.hardware.bluetooth*)
				other_pids="$other_pids $p:$n"
				;;
		esac
	done < .ps
	rm -f .ps
}

start_snapshot() {
	n=$1
	# 配置必须用管道喂给 perfetto：SELinux 不允许它读 /data/local/tmp 下的文件（包括重定向的 fd）
	if sed "s/__DUR__/$((SNAPDUR * 1000))/; s/__PKG__/$PKG/" snapshot.cfg.tpl |
		perfetto --txt -c - -o "$TRACEDIR/bbpower_snap_$n.pftrace" --background > ".snap_$n.pid" 2>> perfetto.err; then
		log "SNAPSHOT_START $n"
	else
		log "SNAPSHOT_FAIL $n"
	fi
}

# 测试条件：开始和结束各记一次，报告里据此判断几次测量能不能互相比较
record_conditions() {
	{
		for k in airplane_mode_on wifi_on bluetooth_on mobile_data low_power; do
			echo "$k=$(settings get global $k)"
		done
		# 形如 "volume is 0 in range [0..15]"
		v=$(cmd media_session volume --stream 3 --get 2>/dev/null | grep -o 'volume is [0-9]* in range \[[0-9]*\.\.[0-9]*\]')
		echo "music_volume=$(echo "$v" | sed 's/volume is \([0-9]*\).*/\1/')"
		echo "music_volume_max=$(echo "$v" | sed 's/.*\.\.\([0-9]*\)\]/\1/')"
		echo "user_app_procs=$(ps -A -o USER | grep -c '^u0_a')"
	} > "$1.txt"
	dumpsys media.audio_flinger > "$1_audio_flinger.txt" 2>&1
	dumpsys media_session > "$1_media_session.txt" 2>&1
}

{
	echo "start_epoch=$START"
	echo "duration=$DUR"
	echo "interval=$INT"
	echo "warmup=$WARMUP"
	echo "pkg=$PKG"
	echo "clk_tck=$(getconf CLK_TCK)"
	echo "model=$(getprop ro.product.model)"
	echo "manufacturer=$(getprop ro.product.manufacturer)"
	echo "sdk=$(getprop ro.build.version.sdk)"
	echo "qemu=$(getprop ro.boot.qemu)$(getprop ro.kernel.qemu)"
	echo "ncpu=$(ls -d /sys/devices/system/cpu/cpu[0-9]* | wc -l)"
	for c in /sys/devices/system/cpu/cpu[0-9]*; do
		echo "cpu_max_freq_$(basename "$c")=$(cat "$c/cpufreq/cpuinfo_max_freq" 2>/dev/null)"
	done
	echo "app_version=$(dumpsys package "$PKG" | grep -m1 versionName | tr -d ' ')"
	# 新版 dumpsys package 只有 appId=，没有 userId=，用 pm 查最稳。
	# app 同时装在其他用户空间（双开、安全文件夹）时会列出多个 uid，只要主用户的
	echo "uid=$(pm list packages -U "$PKG" | grep "^package:$PKG uid:" | sed 's/.*uid://' | cut -d, -f1)"
} > meta.txt

record_conditions conditions_start
refresh_pids
log "START app_pids=$app_pids"

# 长时轻量 trace：电池电流/电压/电量、功耗轨（Pixel 等支持 ODPM 的机型）、CPU 频率
if cat long.cfg | perfetto --txt -c - -o "$TRACEDIR/bbpower_long.pftrace" --background > /dev/null 2>> perfetto.err; then
	log "LONG_TRACE_START"
else
	log "LONG_TRACE_FAIL"
fi

snap_list=$(echo "$SNAPS" | tr ',' ' ')
last_min=-1
while :; do
	now=$(date +%s)
	[ "$now" -ge "$END" ] && break
	elapsed=$((now - START))
	min=$((elapsed / 60))

	# 每分钟：刷新进程列表（app 可能被杀后重启）、记录电池状态，并按周期抓 wakelock / meminfo
	if [ "$min" -ne "$last_min" ]; then
		last_min=$min
		old="$app_pids"
		refresh_pids
		[ "$old" != "$app_pids" ] && log "APP_PIDS $app_pids"
		{
			echo "=== T $now"
			dumpsys battery
		} >> battery.txt
		if [ $((min % 2)) -eq 0 ]; then
			{
				echo "=== T $now"
				dumpsys power | sed -n '/Wake Locks: size/,/^$/p'
			} >> wakelocks.txt
		fi
		if [ $((min % 5)) -eq 0 ]; then
			{
				echo "=== T $now"
				dumpsys meminfo "$PKG"
			} >> meminfo.txt
		fi
	fi

	{
		read -r up _ < /proc/uptime
		echo "=== T $now $up"
		for p in $app_pids; do
			[ -d /proc/$p ] || continue
			echo "--- PSTAT $p"
			cat /proc/$p/stat
			echo "--- TSTAT $p"
			cat /proc/$p/task/*/stat 2>/dev/null
			echo "--- SCHED $p"
			grep -H "" /proc/$p/task/*/schedstat 2>/dev/null
			echo "--- CTXT $p"
			grep -H ctxt_switches /proc/$p/task/*/status 2>/dev/null
			echo "--- MEM $p"
			grep -E '^(VmRSS|VmSwap|Threads|RssAnon|RssFile)' /proc/$p/status
		done
		echo "--- OTHER"
		# 主线程 comm 可能被改名（如 binder:452_2），所以带上 ps 里的进程名
		for e in $other_pids; do
			read -r st < /proc/${e%%:*}/stat 2>/dev/null && echo "${e#*:}|$st"
		done
		echo "--- SELF"
		cat /proc/$$/stat
		echo "--- SYS"
		head -1 /proc/stat
		echo "--- FREQ"
		cat /sys/devices/system/cpu/cpu[0-9]*/cpufreq/scaling_cur_freq 2>/dev/null
		echo "--- NET"
		grep -E '(wlan|rmnet|eth|ccmni|seth|rmnet_data)[0-9]*:' /proc/net/dev
	} >> samples.txt

	# 详细 sched trace 快照
	idx=0
	for off in $snap_list; do
		idx=$((idx + 1))
		if [ "$elapsed" -ge "$off" ] && [ ! -f ".snap_$idx.pid" ]; then
			start_snapshot $idx
		fi
	done

	sleep "$INT"
done

log "SAMPLING_END"
record_conditions conditions_end

# 结束时（此时通常仍未插线）立即导出系统统计，避免插线后数据被充电状态污染
{
	echo "=== T $(date +%s)"
	dumpsys battery
} >> battery.txt
dumpsys batterystats "$PKG" > batterystats_pkg.txt 2>&1
dumpsys batterystats > batterystats_full.txt 2>&1
dumpsys batterystats --usage > batterystats_usage.txt 2>&1
dumpsys alarm > alarm.txt 2>&1
dumpsys jobscheduler > jobscheduler.txt 2>&1
dumpsys deviceidle > deviceidle.txt 2>&1
dumpsys media_session > media_session.txt 2>&1
dumpsys cpuinfo > cpuinfo.txt 2>&1
dumpsys meminfo "$PKG" > meminfo_final.txt 2>&1
dumpsys power > power_final.txt 2>&1

# long trace 的 duration 比采样多留了余量，这里主动结束让它落盘
# （--background 的输出被重定向时 perfetto 不会打印 pid，所以按参数找）
pkill -TERM -f 'bbpower_l[o]ng' 2>/dev/null
# 快照的录制时长超出测量窗口时（比如 -d 很长）可能还在录，最多等一个快照时长，再同样主动结束
waited=0
while pgrep -f 'bbpower_s[n]ap' > /dev/null && [ "$waited" -lt "$SNAPDUR" ]; do
	sleep 1
	waited=$((waited + 1))
done
pkill -TERM -f 'bbpower_s[n]ap' 2>/dev/null
# 等 perfetto 把 trace 写完退出，collect 才不会拉到写了一半的文件
waited=0
while pgrep -f 'bbpower_(l[o]ng|s[n]ap)' > /dev/null && [ "$waited" -lt 30 ]; do
	sleep 1
	waited=$((waited + 1))
done
log "DONE"
date +%s > DONE
