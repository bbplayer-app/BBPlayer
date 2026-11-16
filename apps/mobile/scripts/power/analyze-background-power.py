"""解析 measure-background-power.sh 拉回来的数据，生成 report.md 和若干 CSV。

用法: python3 analyze-background-power.py <数据目录>
"""

import csv
import os
import re
import statistics
import sys
from collections import Counter, defaultdict

OUT = sys.argv[1]
REPORT = []


def p(line=""):
    REPORT.append(line)


def read(name):
    path = os.path.join(OUT, name)
    if not os.path.exists(path):
        return ""
    with open(path, errors="replace") as f:
        return f.read()


def table(headers, rows):
    p("| " + " | ".join(headers) + " |")
    p("|" + "|".join("---" for _ in headers) + "|")
    for r in rows:
        p("| " + " | ".join(str(c) for c in r) + " |")
    p()


def norm_name(name):
    # pool-7-thread-1 / binder:6751_3 / DefaultDispatch 等线程池归为一组
    return re.sub(r"\d+", "N", name)


def parse_stat(line):
    """解析 /proc/*/stat，返回 (id, comm, rest)；rest[0] 是第 3 个字段 state"""
    lp = line.index("(")
    rp = line.rindex(")")
    return int(line[:lp]), line[lp + 1 : rp], line[rp + 2 :].split()


meta = dict(
    line.split("=", 1) for line in read("meta.txt").splitlines() if "=" in line
)
CLK = int(meta.get("clk_tck", "100") or 100)


# app 同时装在其他用户空间（双开、安全文件夹）时 pm 会列出多个 uid，只要主用户的
if meta.get("uid"):
    meta["uid"] = meta["uid"].split(",")[0]


def find_app_uid():
    # 形如 u0a430；新版采样器直接记录在 meta 里，旧数据从 jobscheduler dump 中找
    if meta.get("uid"):
        n = int(meta["uid"])
        return f"u{n // 100000}a{n % 100000 - 10000}"
    m = re.search(rf"(u\d+a\d+) / {re.escape(meta.get('pkg', ''))}\b", read("jobscheduler.txt"))
    return m.group(1) if m else None


APP_UID = find_app_uid()
PKG = meta.get("pkg", "")
is_emulator = meta.get("qemu", "") not in ("", "0", "00")

# ---------------------------------------------------------------- samples.txt


class Sample:
    def __init__(self, t, up):
        self.t = t
        self.up = up
        self.pstat = {}  # (pid, starttime) -> (comm, utime+stime ticks)
        self.threads = {}  # (pid, tid, starttime) -> dict
        self.by_tid = {}  # (pid, tid) -> dict，供 schedstat / status 按 tid 回填
        self.mem = {}  # pid -> dict
        self.other = {}  # (pid, comm) -> ticks
        self.self_ticks = 0
        self.sys_cpu = None
        self.freq = []
        self.net = {}


samples = []
cur = None
section = None
section_pid = None
for line in read("samples.txt").splitlines():
    if line.startswith("=== T "):
        parts = line.split()
        cur = Sample(int(parts[2]), float(parts[3]))
        samples.append(cur)
        section = None
        continue
    if cur is None:
        continue
    if line.startswith("--- "):
        parts = line.split()
        section = parts[1]
        section_pid = int(parts[2]) if len(parts) > 2 else None
        continue
    if not line.strip():
        continue
    try:
        if section == "PSTAT":
            _, comm, r = parse_stat(line)
            # 带上 starttime：app 重启后 PID 可能被复用，不能和旧实例的累计值相减
            cur.pstat[(section_pid, int(r[19]))] = (comm, int(r[11]) + int(r[12]))
        elif section == "TSTAT":
            tid, comm, r = parse_stat(line)
            key = (section_pid, tid, int(r[19]))
            cur.threads[key] = cur.by_tid[(section_pid, tid)] = {
                "name": comm,
                "utime": int(r[11]),
                "stime": int(r[12]),
                "start": int(r[19]),
            }
        elif section == "SCHED":
            m = re.match(r"/proc/\d+/task/(\d+)/schedstat:(\d+) (\d+) (\d+)", line)
            if m:
                th = cur.by_tid.get((section_pid, int(m.group(1))))
                if th is not None:
                    th["run_ns"] = int(m.group(2))
                    th["wait_ns"] = int(m.group(3))
                    th["slices"] = int(m.group(4))
        elif section == "CTXT":
            m = re.match(
                r"/proc/\d+/task/(\d+)/status:(voluntary|nonvoluntary)_ctxt_switches:\s*(\d+)",
                line,
            )
            if m:
                th = cur.by_tid.get((section_pid, int(m.group(1))))
                if th is not None:
                    th["vcsw" if m.group(2) == "voluntary" else "ivcsw"] = int(m.group(3))
        elif section == "MEM":
            k, v = line.split(":", 1)
            cur.mem.setdefault(section_pid, {})[k] = int(v.split()[0])
        elif section == "OTHER":
            pname, line = line.split("|", 1)
            pid, _, r = parse_stat(line)
            comm = pname
            cur.other[(pid, comm)] = int(r[11]) + int(r[12])
        elif section == "SELF":
            _, _, r = parse_stat(line)
            cur.self_ticks = sum(int(x) for x in r[11:15])
        elif section == "SYS":
            vals = [int(x) for x in line.split()[1:]]
            cur.sys_cpu = (sum(vals), vals[3] + (vals[4] if len(vals) > 4 else 0))
        elif section == "FREQ":
            cur.freq.append(int(line.strip()))
        elif section == "NET":
            iface, rest = line.split(":", 1)
            v = rest.split()
            cur.net[iface.strip()] = (int(v[0]), int(v[8]))
    except (ValueError, IndexError):
        pass

if len(samples) < 2:
    print("样本不足，无法分析")
    sys.exit(1)

T0 = samples[0].t
wall = samples[-1].t - T0
events = read("events.log")

p(f"# 后台播放功耗报告：{PKG}")
p()
p(
    f"- 设备：{meta.get('manufacturer')} {meta.get('model')}（SDK {meta.get('sdk')}，{meta.get('ncpu')} 核）"
)
p(f"- 应用：{meta.get('app_version')}")
p(f"- 采样：{len(samples)} 个，覆盖 {wall / 60:.1f} 分钟，间隔 {meta.get('interval')}s")
_label = read("label.txt").strip()
if _label:
    p(f"- 别名：{_label}")
if is_emulator:
    p("- **注意：模拟器上的电池与功耗数据是虚拟的，只看 CPU / 线程 / 唤醒部分**")
restarts = [l for l in events.splitlines() if "APP_PIDS" in l]
if restarts:
    p(f"- **进程在测量中发生变化（被杀/重启）：** {'; '.join(restarts)}")
p()

# ---------------------------------------------------------------- 电池（dumpsys battery）

bat = []
for block in read("battery.txt").split("=== T ")[1:]:
    lines = block.splitlines()
    t = int(lines[0].split()[0])
    d = {}
    for l in lines[1:]:
        if ":" in l:
            k, v = l.split(":", 1)
            d[k.strip()] = v.strip()
    bat.append((t, d))

# ---------------------------------------------------------------- 测试条件

AF_FORMATS = {
    "00000001": "PCM 16 位",
    "00000003": "PCM 32 位",
    "00000004": "PCM 8.24 位",
    "00000005": "PCM float",
    "00000006": "PCM 24 位",
    "01000000": "MP3",
    "04000002": "AAC LC",
    "04000010": "HE-AAC",
    "04000100": "HE-AACv2",
    "08000000": "Opus",
    "1b000000": "FLAC",
}


def kv(text):
    return dict(l.split("=", 1) for l in text.splitlines() if "=" in l)


def parse_audio_path(text, uid):
    """从 dumpsys media.audio_flinger 找出 app 的 AudioTrack 所在的输出线程"""
    found = []
    # Android 14 及更早的 track 表里 Client 列只有 pid，靠开头的 pid / uid 对照表找出 app 的 pid
    pids = set(re.findall(rf"^\s*(\d+)\s+{uid}\s+\S+\s*$", text, re.M))
    for block in text.split("Output thread ")[1:]:
        m = re.search(r"AudioStreamOut: \S+ flags \S+ \(([^)]*)\)", block)
        flags = m.group(1).replace("AUDIO_OUTPUT_FLAG_", "") if m else "?"
        m = re.search(r"Output devices: \S+ \(([^)]*)\)", block)
        devices = m.group(1).replace("AUDIO_DEVICE_OUT_", "") if m else "?"
        # Local log 里也有形如 track 行的记录，只看它之前的 track 表
        for line in block.split("Local log:")[0].splitlines():
            toks = line.split()
            for i in range(len(toks) - 10):
                if toks[i] not in ("yes", "no"):
                    continue
                if toks[i + 1].endswith("/") and toks[i + 2] == uid:
                    o = 0  # Android 15+：Client 列是 "pid/ uid"
                elif toks[i + 1] in pids:
                    o = -1
                else:
                    continue
                srate = int(toks[i + 9 + o]) if toks[i + 9 + o].isdigit() else 0
                frames = None
                for j in range(i + 10 + o, len(toks) - 1):
                    if re.fullmatch(r"[0-9A-F]{8}", toks[j]):
                        frames = int(toks[j + 1]) if toks[j + 1].isdigit() else None
                        break
                found.append(
                    {
                        "active": toks[i] == "yes",
                        "flags": flags,
                        "devices": devices,
                        "format": AF_FORMATS.get(toks[i + 7 + o], toks[i + 7 + o]),
                        "srate": srate,
                        "frames": frames,
                    }
                )
                break
    active = [t for t in found if t["active"]]
    return active or found


def describe_audio_path(tracks):
    if not tracks:
        return "—"
    out = []
    for t in tracks:
        desc = f"{t['flags']}，{t['devices']}，{t['format']} {t['srate']} Hz"
        if "COMPRESS_OFFLOAD" in t["flags"]:
            desc += "（offload）"
        elif t["frames"] and t["srate"]:
            desc += f"，缓冲 {t['frames'] / t['srate']:.2f}s"
        if not t["active"]:
            desc += "（未在播放）"
        out.append(desc)
    return "；".join(out)


def parse_session(text, pkg):
    """媒体会话的播放状态和倍速"""
    i = text.find(f"package={pkg}")
    if i < 0:
        return None, None
    m = re.search(r"state=PlaybackState \{state=(\w+)[^}]*?speed=([0-9.]+)", text[i : i + 3000])
    if not m:
        return None, None
    # Android 12 及更早只输出数字，较新的版本输出 "PLAYING(3)"
    state = PLAYBACK_STATES.get(m.group(1), m.group(1))
    return state, float(m.group(2))


PLAYBACK_STATES = {
    "0": "NONE",
    "1": "STOPPED",
    "2": "PAUSED",
    "3": "PLAYING",
    "4": "FAST_FORWARDING",
    "5": "REWINDING",
    "6": "BUFFERING",
    "7": "ERROR",
    "8": "CONNECTING",
}


def parse_duration_s(text):
    total = 0.0
    for num, unit in re.findall(r"(\d+)(ms|h|m|s)", text):
        total += int(num) * {"h": 3600, "m": 60, "s": 1, "ms": 0.001}[unit]
    return total


cond = {"start": kv(read("conditions_start.txt")), "end": kv(read("conditions_end.txt"))}
if cond["start"]:
    uid_num = meta.get("uid", "")
    if not uid_num and APP_UID:
        # 旧数据的 meta 里没有 uid，从 u0a430 换算回 10430
        m = re.fullmatch(r"u(\d+)a(\d+)", APP_UID)
        uid_num = str(int(m.group(1)) * 100000 + 10000 + int(m.group(2))) if m else ""
    paths = {k: parse_audio_path(read(f"conditions_{k}_audio_flinger.txt"), uid_num) for k in cond}
    sessions = {k: parse_session(read(f"conditions_{k}_media_session.txt"), PKG) for k in cond}
    normalized = os.path.exists(os.path.join(OUT, "restore.txt")) or os.path.exists(
        os.path.join(OUT, "restore.done")
    )

    def onoff(v):
        return {"0": "关", "1": "开", "2": "开"}.get(v, v or "—")

    def volume(c):
        if not c.get("music_volume"):
            return "—"
        return f"{c['music_volume']} / {c.get('music_volume_max') or '?'}"

    def session(k):
        state, speed = sessions[k]
        return f"{state}，{speed}x" if state else "—"

    rows = [
        ["飞行模式", onoff(cond["start"].get("airplane_mode_on")), onoff(cond["end"].get("airplane_mode_on"))],
        ["Wi-Fi", onoff(cond["start"].get("wifi_on")), onoff(cond["end"].get("wifi_on"))],
        ["蓝牙", onoff(cond["start"].get("bluetooth_on")), onoff(cond["end"].get("bluetooth_on"))],
        ["移动数据", onoff(cond["start"].get("mobile_data")), onoff(cond["end"].get("mobile_data"))],
        ["省电模式", onoff(cond["start"].get("low_power")), onoff(cond["end"].get("low_power"))],
        ["媒体音量", volume(cond["start"]), volume(cond["end"])],
        ["后台 app 进程数", cond["start"].get("user_app_procs", "—"), cond["end"].get("user_app_procs", "—")],
        ["播放状态 / 倍速", session("start"), session("end")],
        ["音频通路", describe_audio_path(paths["start"]), describe_audio_path(paths["end"])],
    ]

    warns = []
    b_first = bat[0][1] if bat else {}
    level = int(b_first.get("level", 0) or 0)
    temp = int(b_first.get("temperature", 0) or 0) / 10
    if level >= 95:
        warns.append(f"起始电量 {level}%：接近满电时电池会在充满和放电之间切换，电流读数可能不准")
    elif level and (level < 50 or level > 90):
        warns.append(f"起始电量 {level}%，不在 50%~90% 之间")
    if temp > 32:
        warns.append(f"起始电池温度 {temp:.1f}°C，偏高")
    for key, name in [("airplane_mode_on", "飞行模式"), ("wifi_on", "Wi-Fi"), ("bluetooth_on", "蓝牙"),
                      ("mobile_data", "移动数据"), ("low_power", "省电模式"), ("music_volume", "媒体音量")]:
        a, b = cond["start"].get(key), cond["end"].get(key)
        if cond["end"] and a != b:
            warns.append(f"{name}在测量中途变了（{a} → {b}）")
    if cond["start"].get("low_power") == "1":
        warns.append("省电模式开着")
    if cond["start"].get("music_volume") not in (None, "", "0"):
        warns.append(f"媒体音量是 {cond['start']['music_volume']}，只能和同音量的测量比较电流")
    devices = " ".join(t["devices"] for t in paths["start"])
    if cond["start"].get("bluetooth_on") == "1" and "BLUETOOTH" not in devices:
        warns.append("蓝牙开着但音频没走蓝牙：系统可能在持续扫描，会抬高电流")
    for k, label in [("start", "开始"), ("end", "结束")]:
        state, speed = sessions[k]
        if state and not state.startswith("PLAYING"):
            warns.append(f"{label}时没有在播放（{state}）")
        elif speed and speed != 1.0:
            warns.append(f"{label}时倍速是 {speed}x")
        if cond[k] and not paths[k]:
            warns.append(f"{label}时在 AudioFlinger 里没找到 app 的 AudioTrack")
    if paths["start"] and paths["end"]:
        def route(tracks):
            return sorted((t["flags"], t["devices"]) for t in tracks)

        if route(paths["start"]) != route(paths["end"]):
            warns.append("音频输出通路在测量中途变了")

    # 无线模块的内核唤醒锁：两次测量差距大时，电流不能直接比
    full = read("batterystats_full.txt")
    radio = []
    span = wall or 1
    for label, pat in [("蓝牙 HAL", r"hal_bluetooth_lock"), ("蓝牙串口", r"[\w.,]*uart"), ("蜂窝网络", r"rmnet_ctl")]:
        m = re.search(rf"Kernel Wake lock ({pat}): (.+?) \((\d+) times\)", full)
        if m:
            secs = parse_duration_s(m.group(2))
            radio.append([label, m.group(1), f"{secs:.0f}s（{secs / span * 100:.0f}%）", m.group(3)])
            if label == "蓝牙 HAL" and secs / span > 0.05:
                warns.append(f"蓝牙活动明显（{label} 唤醒锁占 {secs / span * 100:.0f}% 的时间）")
            if label == "蜂窝网络" and secs / span > 0.10:
                warns.append(f"蜂窝网络活动明显（唤醒锁占 {secs / span * 100:.0f}% 的时间）")

    p("## 0. 测试条件")
    p()
    p(f"- 统一条件（--normalize）：{'是' if normalized else '否'}")
    # 解码方式从 app 的线程推断：FFmpeg 有 SimpleDecoder 线程，MediaCodec 有 MediaCodec_loop 线程
    _app_pids = {k[0] for smp in samples for k in smp.pstat}
    _names = {th["name"] for smp in samples for k, th in smp.threads.items() if k[0] in _app_pids}
    _decoders = [
        name
        for name, prefix in [("FFmpeg", "ExoPlayer:Simpl"), ("MediaCodec", "MediaCodec_loop")]
        if any(n.startswith(prefix) for n in _names)
    ]
    if any("COMPRESS_OFFLOAD" in t["flags"] for k in paths for t in paths[k]):
        _decoders.append("offload（音频芯片）")
    p(f"- 解码方式：{'、'.join(_decoders) or '未知'}")
    if meta.get("warmup"):
        p(f"- 拔线后预热：{meta['warmup']}s（预热期间不计入测量）")
    if bat:
        p(f"- 起始电量 {level}%，温度 {temp:.1f}°C")
    p()
    table(["条件", "开始", "结束"], rows)
    if radio:
        p("无线模块的内核唤醒锁（占测量时长的比例）：")
        p()
        table(["模块", "唤醒锁", "累计持有", "次数"], radio)
    if warns:
        p("**以下条件会影响电流数据的可比性**（CPU / 线程 / 唤醒数据基本不受影响）：")
        p()
        for w in warns:
            p(f"- {w}")
    else:
        p("没有发现影响可比性的条件。")
    p()

p("## 1. 电量与电流")
p()
charging_samples = [
    t
    for t, d in bat
    if d.get("USB powered") == "true"
    or d.get("AC powered") == "true"
    or d.get("Wireless powered") == "true"
]
if bat:
    b0, b1 = bat[0][1], bat[-1][1]
    hours = (bat[-1][0] - bat[0][0]) / 3600 or 1e-9
    rows = [
        ["电量 %", b0.get("level"), b1.get("level")],
        ["电压 mV", b0.get("voltage"), b1.get("voltage")],
        [
            "温度 °C",
            int(b0.get("temperature", 0)) / 10,
            int(b1.get("temperature", 0)) / 10,
        ],
        ["Charge counter µAh", b0.get("Charge counter"), b1.get("Charge counter")],
    ]
    table(["", "开始", "结束"], rows)
    try:
        dq = (int(b0["Charge counter"]) - int(b1["Charge counter"])) / 1000
        p(
            f"- 按 charge counter：消耗 **{dq:.1f} mAh**，平均 **{dq / hours:.1f} mA**（{(bat[-1][0] - bat[0][0]) / 60:.0f} 分钟）"
        )
    except (KeyError, ValueError):
        pass
    if charging_samples:
        p(
            f"- **警告：{len(charging_samples)}/{len(bat)} 次电池采样时处于外部供电状态，这些时段的电量/电流数据无效**"
        )
    p()

# ---------------------------------------------------------------- perfetto 长 trace

try:
    from perfetto.trace_processor import TraceProcessor
except ImportError:
    TraceProcessor = None


def tp_rows(tp, sql):
    return list(tp.query(sql))


long_trace = os.path.join(OUT, "traces", "bbpower_long.pftrace")
if TraceProcessor and os.path.exists(long_trace):
    try:
        tp = TraceProcessor(trace=long_trace)
        counters = {
            r.name: r
            for r in tp_rows(
                tp,
                """select t.name, count(*) n, min(c.ts) t0, max(c.ts) t1,
                          avg(c.value) avg, min(c.value) mn, max(c.value) mx
                   from counter c join counter_track t on c.track_id = t.id
                   where t.name like 'batt.%' group by t.name""",
            )
        }
        if counters:
            p("### 电池 HAL 实时计数（perfetto，1s 一次）")
            p()
            cur_c = counters.get("batt.current_ua")
            volt_c = counters.get("batt.voltage_uv")
            if cur_c:
                # 放电电流的符号因厂商而异；以多数样本的符号为放电方向，
                # 反向的样本（开头还插着线、在充电）剔除掉
                cur_rows = tp_rows(
                    tp,
                    """select c.ts, c.value from counter c join counter_track t on c.track_id=t.id
                       where t.name='batt.current_ua' order by c.ts""",
                )
                volt_rows = tp_rows(
                    tp,
                    """select c.ts, c.value from counter c join counter_track t on c.track_id=t.id
                       where t.name='batt.voltage_uv' order by c.ts""",
                )
                pos = sum(1 for r in cur_rows if r.value > 0)
                sign = 1 if pos * 2 >= len(cur_rows) else -1
                dis = [r for r in cur_rows if r.value * sign > 0]
                if dis:
                    vals = [abs(r.value) / 1000 for r in dis]
                    dropped = len(cur_rows) - len(dis)
                    p(
                        f"- 平均放电电流 **{statistics.mean(vals):.1f} mA**（中位数 {statistics.median(vals):.0f} / 最小 {min(vals):.0f} / 最大 {max(vals):.0f} mA，{len(dis)} 个点"
                        + (f"，剔除了 {dropped} 个充电中的点" if dropped else "")
                        + "）"
                    )
                    if volt_rows:
                        vi = 0
                        pw = []
                        for r in dis:
                            while vi + 1 < len(volt_rows) and volt_rows[vi + 1].ts <= r.ts:
                                vi += 1
                            pw.append(abs(r.value) * volt_rows[vi].value / 1e9)
                        p(f"- 平均功率 **{statistics.mean(pw):.0f} mW**（整机）")
            ch = counters.get("batt.charge_uah")
            if ch:
                first_last = tp_rows(
                    tp,
                    """select c.value from counter c join counter_track t on c.track_id=t.id
                       where t.name='batt.charge_uah' order by c.ts""",
                )
                dq = (first_last[0].value - first_last[-1].value) / 1000
                hrs = (ch.t1 - ch.t0) / 3.6e12
                if hrs > 0:
                    p(f"- Charge counter 差值 {dq:.1f} mAh → {dq / hrs:.1f} mA")
            p()
            # 每分钟电流，方便看是否有尖峰
            per_min = tp_rows(
                tp,
                f"""select cast((c.ts - {cur_c.t0 if cur_c else 0}) / 60e9 as int) m, avg(abs(c.value)) a, max(abs(c.value)) mx
                    from counter c join counter_track t on c.track_id=t.id
                    where t.name='batt.current_ua' and c.value * {sign if cur_c else 1} > 0 group by m order by m""",
            )
            if per_min:
                with open(os.path.join(OUT, "battery_current_per_min.csv"), "w") as f:
                    w = csv.writer(f)
                    w.writerow(["minute", "avg_ma", "max_ma"])
                    for r in per_min:
                        w.writerow([r.m, round(r.a / 1000, 1), round(r.mx / 1000, 1)])
                med = statistics.median(r.a for r in per_min)
                spikes = [r for r in per_min if r.a > med * 1.5]
                if spikes:
                    p(
                        "- 平均电流明显高于中位数（>1.5×）的分钟："
                        + ", ".join(f"第 {r.m} 分钟 {r.a / 1000:.0f}mA" for r in spikes)
                    )
                    p()

        rails = tp_rows(
            tp,
            """select t.name, min(c.ts) t0, max(c.ts) t1,
                      max(c.value) - min(c.value) energy
               from counter c join counter_track t on c.track_id = t.id
               where t.name like 'power.%' group by t.name order by energy desc""",
        )
        if rails:
            p("### 功耗轨（ODPM，硬件实测）")
            p()
            rows = []
            total = sum(r.energy for r in rails)
            for r in rails:
                secs = (r.t1 - r.t0) / 1e9 or 1
                rows.append(
                    [
                        r.name.replace("power.", ""),
                        f"{r.energy / 1e6:.1f}",
                        f"{r.energy / 1e3 / secs:.1f}",
                        f"{r.energy / total * 100:.1f}%",
                    ]
                )
            table(["功耗轨", "能量 J", "平均 mW", "占比"], rows)
        else:
            p("（此设备不支持功耗轨 ODPM，没有分模块的硬件功耗数据）")
            p()
        tp.close()
    except Exception as e:  # noqa: BLE001
        p(f"（解析长 trace 失败：{e}）")
        p()
elif not TraceProcessor:
    p("（未安装 perfetto python 包，跳过 trace 分析）")
    p()

# ---------------------------------------------------------------- 进程 CPU

p("## 2. 进程 CPU")
p()


def ticks_delta(first, last):
    return (last - first) / CLK


rows = []
app_total = 0.0
# 遍历所有样本里出现过的进程实例，测量中途重启过的也算进来
for key in {k for s in samples for k in s.pstat}:
    present = [s for s in samples if key in s.pstat]
    if len(present) < 2:
        continue
    secs = ticks_delta(present[0].pstat[key][1], present[-1].pstat[key][1])
    span = present[-1].t - present[0].t or 1
    app_total += secs
    rows.append(
        [
            present[0].pstat[key][0] + f" ({key[0]})",
            f"{secs:.1f}",
            f"{secs / span * 100:.2f}%",
        ]
    )

other_first = {}
other_last = {}
for s in samples:
    for k, v in s.other.items():
        other_first.setdefault(k, (s.t, v))
        other_last[k] = (s.t, v)
for k in other_first:
    (t0, v0), (t1, v1) = other_first[k], other_last[k]
    if t1 > t0:
        secs = (v1 - v0) / CLK
        rows.append([f"{k[1]} ({k[0]})", f"{secs:.1f}", f"{secs / (t1 - t0) * 100:.2f}%"])

self_secs = (samples[-1].self_ticks - samples[0].self_ticks) / CLK
rows.append(["(采样器自身开销)", f"{self_secs:.1f}", f"{self_secs / wall * 100:.2f}%"])
rows.sort(key=lambda r: -float(r[1]))
p("CPU% 为单核百分比（100% = 占满一个核）。")
p()
table(["进程", "CPU 秒", "平均 CPU%"], rows)

if samples[0].sys_cpu and samples[-1].sys_cpu:
    tot = samples[-1].sys_cpu[0] - samples[0].sys_cpu[0]
    idle = samples[-1].sys_cpu[1] - samples[0].sys_cpu[1]
    ncpu = int(meta.get("ncpu", 1) or 1)
    if tot:
        p(
            f"- 整机 CPU 忙碌 {(tot - idle) / tot * 100:.1f}%（{ncpu} 核平均），app 占整机忙碌时间的 {app_total / ((tot - idle) / CLK) * 100:.1f}%"
        )
        p()

# ---------------------------------------------------------------- 线程

threads = {}  # key -> accumulated
timeline = []  # rows for CSV
minute_cpu = defaultdict(Counter)  # minute -> name -> cpu sec
minute_wake = defaultdict(Counter)
minute_cover = Counter()  # minute -> 被采样区间覆盖的秒数
born = []


def minute_shares(t0, t1):
    """把区间 [t0, t1)（相对 T0 的秒）按与每一分钟的重叠拆开，返回 [(分钟, 占比)]"""
    shares = []
    a = t0
    while a < t1:
        m = int(a // 60)
        b = min(t1, (m + 1) * 60)
        shares.append((m, (b - a) / (t1 - t0)))
        a = b
    return shares


for prev, s in zip(samples, samples[1:]):
    dt = s.t - prev.t or 1
    shares = minute_shares(prev.t - T0, s.t - T0) or [(int((s.t - T0) // 60), 1.0)]
    for m, share in shares:
        minute_cover[m] += share * (s.t - prev.t)
    for key, th in s.threads.items():
        old = prev.threads.get(key)
        if old is None:
            # 两次采样之间新建的线程：从 0 开始计
            if th["start"] / CLK > prev.up:
                old = {"utime": 0, "stime": 0, "run_ns": 0, "wait_ns": 0, "vcsw": 0, "ivcsw": 0}
                born.append((s.t - T0, key[0], key[1], th["name"]))
            else:
                continue
        acc = threads.setdefault(
            key,
            {
                "name": th["name"],
                "pid": key[0],
                "tid": key[1],
                "cpu": 0.0,
                "user": 0.0,
                "sys": 0.0,
                "wait": 0.0,
                "vcsw": 0,
                "ivcsw": 0,
                "first": prev.t,
                "last": s.t,
                "peak": 0.0,
            },
        )
        acc["name"] = th["name"]
        acc["last"] = s.t
        if "run_ns" in th and "run_ns" in old:
            cpu = (th["run_ns"] - old["run_ns"]) / 1e9
            acc["wait"] += (th.get("wait_ns", 0) - old.get("wait_ns", 0)) / 1e9
        else:
            cpu = (th["utime"] + th["stime"] - old["utime"] - old["stime"]) / CLK
        acc["cpu"] += cpu
        acc["user"] += (th["utime"] - old["utime"]) / CLK
        acc["sys"] += (th["stime"] - old["stime"]) / CLK
        # 线程在读 stat 和 status 之间退出时会缺计数，缺了就不算这个区间，不能当 0 相减
        dv = th["vcsw"] - old["vcsw"] if "vcsw" in th and "vcsw" in old else 0
        di = th["ivcsw"] - old["ivcsw"] if "ivcsw" in th and "ivcsw" in old else 0
        acc["vcsw"] += dv
        acc["ivcsw"] += di
        acc["peak"] = max(acc["peak"], cpu / dt * 100)
        for m, share in shares:
            minute_cpu[m][th["name"]] += cpu * share
            minute_wake[m][th["name"]] += dv * share
        if cpu > 0 or dv > 0:
            timeline.append([s.t - T0, key[0], key[1], th["name"], round(cpu * 1000, 2), dv, di])

with open(os.path.join(OUT, "threads_timeline.csv"), "w") as f:
    w = csv.writer(f)
    w.writerow(["t_sec", "pid", "tid", "name", "cpu_ms", "voluntary_csw", "involuntary_csw"])
    w.writerows(timeline)

thread_sum = sum(t["cpu"] for t in threads.values())

p("## 3. 线程")
p()
p(
    f"线程累计 CPU {thread_sum:.1f}s；进程累计 {app_total:.1f}s，差值 {app_total - thread_sum:.1f}s 来自测量中途退出的线程（它们最后一个区间的数据无法采到）。"
)
p()
p(
    "**唤醒/s** 是自愿上下文切换速率：线程每次阻塞后被唤醒计一次。后台播放时 CPU 时间不高但唤醒频繁的线程会让 CPU 无法进入深度睡眠，这是后台耗电的常见元凶。"
)
p()

p("### 3.1 按 CPU 时间排序（Top 40）")
p()
rows = []
for t in sorted(threads.values(), key=lambda t: -t["cpu"])[:40]:
    span = (t["last"] - t["first"]) or 1
    rows.append(
        [
            t["name"],
            t["tid"],
            f"{t['cpu']:.2f}",
            f"{t['cpu'] / app_total * 100:.1f}%" if app_total else "-",
            f"{t['cpu'] / span * 100:.2f}%",
            f"{t['peak']:.1f}%",
            f"{t['user']:.1f}/{t['sys']:.1f}",
            f"{t['vcsw'] / span:.2f}",
            f"{t['ivcsw'] / span:.2f}",
            f"{t['wait']:.2f}",
        ]
    )
table(
    ["线程", "tid", "CPU 秒", "占 app", "平均 CPU%", "峰值 CPU%", "user/sys 秒", "唤醒/s", "被抢占/s", "就绪等待秒"],
    rows,
)

p("### 3.2 按唤醒频率排序（Top 30）")
p()
rows = []
for t in sorted(
    threads.values(), key=lambda t: -(t["vcsw"] / ((t["last"] - t["first"]) or 1))
)[:30]:
    span = (t["last"] - t["first"]) or 1
    rows.append(
        [
            t["name"],
            t["tid"],
            f"{t['vcsw'] / span:.2f}",
            t["vcsw"],
            f"{t['cpu']:.2f}",
            f"{t['cpu'] * 1000 / t['vcsw']:.2f}" if t["vcsw"] else "-",
        ]
    )
table(["线程", "tid", "唤醒/s", "唤醒总数", "CPU 秒", "每次唤醒 CPU ms"], rows)
p("每次唤醒只干很少的活（< 0.1ms）却唤醒很频繁的线程，通常是轮询/定时器，值得优先排查。")
p()

p("### 3.3 按线程组聚合（线程池合并）")
p()
groups = defaultdict(lambda: {"cpu": 0.0, "vcsw": 0, "n": 0})
for t in threads.values():
    g = groups[norm_name(t["name"])]
    g["cpu"] += t["cpu"]
    g["vcsw"] += t["vcsw"]
    g["n"] += 1
rows = [
    [k, v["n"], f"{v['cpu']:.2f}", f"{v['vcsw'] / wall:.2f}"]
    for k, v in sorted(groups.items(), key=lambda kv: -kv[1]["cpu"])[:30]
]
table(["线程组", "线程数", "CPU 秒", "唤醒/s"], rows)

p("### 3.4 线程创建")
p()
if born:
    born_groups = Counter(norm_name(b[3]) for b in born)
    p(
        f"测量期间新建了 {len(born)} 个线程（{len(born) / (wall / 60):.1f} 个/分钟）。频繁创建线程本身就耗电，通常意味着线程池没有复用。"
    )
    p()
    table(["线程名", "新建次数"], born_groups.most_common(15))
else:
    p("测量期间没有新建线程。")
    p()

# ---------------------------------------------------------------- 时间线

p("## 4. 每分钟时间线")
p()
p("用于定位间歇性的尖峰：某一分钟 CPU 明显高于中位数时，看那一分钟是哪个线程在跑。")
p()
mins = sorted(minute_cpu)
totals = {m: sum(minute_cpu[m].values()) for m in mins}
median = statistics.median(totals.values()) if totals else 0
rows = []
with open(os.path.join(OUT, "per_minute.csv"), "w") as f:
    w = csv.writer(f)
    w.writerow(["minute", "app_cpu_sec", "app_cpu_pct", "wakeups", "top_threads"])
    for m in mins:
        top = ", ".join(f"{n} {v:.2f}s" for n, v in minute_cpu[m].most_common(3))
        wakes = round(sum(minute_wake[m].values()))
        # 按实际覆盖的秒数算，第 0 分钟和最后一分钟通常不满 60 秒
        pct = totals[m] / (minute_cover[m] or 60) * 100
        flag = " ⚠" if median and totals[m] > median * 2 and totals[m] > 0.5 else ""
        rows.append([f"{m}{flag}", f"{totals[m]:.2f}", f"{pct:.1f}%", wakes, top])
        w.writerow([m, round(totals[m], 3), round(pct, 2), wakes, top])
table(["分钟", "app CPU 秒", "CPU%", "唤醒数", "最忙的线程"], rows)
snap_events = [l for l in events.splitlines() if "SNAPSHOT_START" in l]
if snap_events:
    p(
        "注：以下时间点录制了详细 sched trace，trace 本身会略微增加这几分钟的 CPU："
        + ", ".join(f"第 {(int(l.split()[0]) - T0) // 60} 分钟" for l in snap_events)
    )
    p()

# ---------------------------------------------------------------- 内存

p("## 5. 内存")
p()
for pid in sorted({pid for s in samples for pid in s.mem}):
    rss = [(s.t - T0, s.mem[pid].get("VmRSS", 0)) for s in samples if pid in s.mem]
    thr = [s.mem[pid].get("Threads", 0) for s in samples if pid in s.mem]
    if len(rss) < 2:
        continue
    span_min = (rss[-1][0] - rss[0][0]) / 60 or 1
    # 线性回归斜率，判断是否持续增长
    xs = [x for x, _ in rss]
    ys = [y for _, y in rss]
    mx, my = statistics.mean(xs), statistics.mean(ys)
    denom = sum((x - mx) ** 2 for x in xs) or 1
    slope = sum((x - mx) * (y - my) for x, y in rss) / denom * 600 / 1024
    p(
        f"- pid {pid}：RSS {rss[0][1] / 1024:.0f} → {rss[-1][1] / 1024:.0f} MB（最高 {max(ys) / 1024:.0f} MB），趋势 {slope:+.1f} MB/10 分钟；线程数 {thr[0]} → {thr[-1]}（最多 {max(thr)}）"
    )
mi = read("meminfo.txt")
if mi:
    rows = []
    for block in mi.split("=== T ")[1:]:
        t = int(block.split()[0])

        def grab(label, text=block):
            m = re.search(rf"^\s*{label}:?\s+(\d+)", text, re.M)
            return f"{int(m.group(1)) / 1024:.1f}" if m else "-"

        rows.append(
            [
                (t - T0) // 60,
                grab("TOTAL PSS"),
                grab("Java Heap"),
                grab("Native Heap"),
                grab("Graphics"),
                grab("Code"),
            ]
        )
    p()
    p("dumpsys meminfo（MB）：")
    p()
    table(["分钟", "Total PSS", "Java Heap", "Native Heap", "Graphics", "Code"], rows)
p()

# ---------------------------------------------------------------- 网络 / CPU 频率

p("## 6. 网络与 CPU 频率")
p()
net_rows = []
ifaces = set(samples[0].net) & set(samples[-1].net)
for iface in sorted(ifaces):
    rx = samples[-1].net[iface][0] - samples[0].net[iface][0]
    tx = samples[-1].net[iface][1] - samples[0].net[iface][1]
    if rx or tx:
        net_rows.append([iface, f"{rx / 1048576:.2f}", f"{tx / 1048576:.2f}"])
if net_rows:
    p("整机网卡流量（不仅是本 app）：")
    p()
    table(["网卡", "下行 MB", "上行 MB"], net_rows)
    # 统计有流量的采样区间数：流式播放是持续小流量还是集中下载
    active = 0
    for prev, s in zip(samples, samples[1:]):
        d = sum(
            s.net[i][0] - prev.net[i][0] for i in ifaces if i in s.net and i in prev.net
        )
        if d > 50 * 1024:
            active += 1
    p(
        f"- {active}/{len(samples) - 1} 个采样区间有 >50KB 下行流量。比例高说明是在边播边小块下载，无线模块长期无法休眠，整首缓存/批量预取会更省电。"
    )
    p()

ncpu = len(samples[0].freq)
if ncpu:
    avg = [statistics.mean(s.freq[i] for s in samples if len(s.freq) == ncpu) for i in range(ncpu)]
    maxf = [int(meta.get(f"cpu_max_freq_cpu{i}", 0) or 0) for i in range(ncpu)]
    p(
        "各核平均频率（MHz，采样瞬时值，睡眠时可能偏高）："
        + ", ".join(
            f"cpu{i} {a / 1000:.0f}" + (f"/{m / 1000:.0f}" if m else "")
            for i, (a, m) in enumerate(zip(avg, maxf))
        )
    )
    p()

# ---------------------------------------------------------------- batterystats / wakelock / alarm / job

p("## 7. 系统统计（batterystats 等）")
p()
wl = read("wakelocks.txt")
if wl:
    held = Counter()
    snaps = wl.count("=== T ")
    for line in wl.splitlines():
        if PKG in line or "uid=" in line and "WAKE_LOCK" in line:
            m = re.search(r"'([^']*)'", line)
            if m and ("ACQ" in line or "WAKE_LOCK" in line):
                held[m.group(1) + ("" if PKG in line else " [其他]")] += 1
    if held:
        p(f"wakelock 抽查（共 {snaps} 次，每 2 分钟一次）：")
        p()
        table(["wakelock", "被看到持有的次数"], held.most_common(20))

bs = read("batterystats_pkg.txt")
if bs:
    keep = []
    for line in bs.splitlines():
        s = line.strip()
        if re.search(
            r"(Wake lock|Wakeup alarm|Job |Sync |Network:|Mobile network|Wifi|Cpu:|Foreground|Background|Total cpu time|Estimated power|Computed drain|Power use|mAh|Audio|Bluetooth|sensor|Sensor)",
            s,
        ):
            keep.append(line.rstrip())
    if keep:
        p("dumpsys batterystats（本 app 相关行，完整内容见 batterystats_pkg.txt）：")
        p()
        p("```")
        p("\n".join(keep[:120]))
        p("```")
        p()

usage = read("batterystats_usage.txt")
if usage and PKG:
    lines = [l for l in usage.splitlines() if APP_UID and f"UID {APP_UID}:" in l]
    if lines:
        p("BatteryUsageStats（本 app）：")
        p()
        p("```")
        p("\n".join(lines[:30]))
        p("```")
        p()

for name, title in (("alarm.txt", "alarm"), ("jobscheduler.txt", "job")):
    text = read(name)
    hits = [l.strip() for l in text.splitlines() if PKG in l]
    if hits:
        p(f"{title} 中提到本 app 的行（前 25 行，完整见 {name}）：")
        p()
        p("```")
        p("\n".join(hits[:25]))
        p("```")
        p()

# ---------------------------------------------------------------- 快照 trace

snap_files = sorted(
    f for f in os.listdir(os.path.join(OUT, "traces")) if f.startswith("bbpower_snap_")
) if os.path.isdir(os.path.join(OUT, "traces")) else []
if snap_files and TraceProcessor:
    p("## 8. 详细 sched trace 快照")
    p()
    p("可以直接把 traces/ 里的 .pftrace 拖进 https://ui.perfetto.dev 看。")
    p()
    for fn in snap_files:
        try:
            tp = TraceProcessor(trace=os.path.join(OUT, "traces", fn))
            dur_s = tp_rows(tp, "select (trace_end() - trace_start()) / 1e9 d")[0].d or 1
            p(f"### {fn}（{dur_s:.0f}s）")
            p()
            rows = tp_rows(
                tp,
                """select coalesce(p.name, '?') pname, coalesce(t.name, '?') tname, t.tid, sum(s.dur) / 1e6 ms, count(*) n
                   from sched s join thread t using(utid) left join process p using(upid)
                   where t.tid != 0 group by s.utid order by ms desc limit 20""",
            )
            p("全系统 CPU 占用 Top 20：")
            p()
            table(
                ["进程", "线程", "tid", "CPU ms", "CPU%", "调度次数"],
                [[r.pname, r.tname, r.tid, f"{r.ms:.1f}", f"{r.ms / 10 / dur_s:.2f}%", r.n] for r in rows],
            )
            app_filter = f"(p.name = '{PKG}' or p.name like '{PKG}:%')"
            rows = tp_rows(
                tp,
                f"""select t.name tname, t.tid, count(*) n
                    from thread_state ts join thread t using(utid) join process p using(upid)
                    where {app_filter} and ts.state = 'R' and ts.waker_utid is not null
                    group by ts.utid order by n desc limit 15""",
            )
            if rows:
                p("app 线程被唤醒次数：")
                p()
                table(
                    ["线程", "tid", "唤醒次数", "次/s"],
                    [[r.tname, r.tid, r.n, f"{r.n / dur_s:.1f}"] for r in rows],
                )
            rows = tp_rows(
                tp,
                f"""select coalesce(wp.name, 'kernel/irq') wproc, coalesce(wt.name, '?') wthread, t.name tname, count(*) n
                    from thread_state ts
                    join thread t using(utid) join process p using(upid)
                    left join thread wt on wt.utid = ts.waker_utid
                    left join process wp on wp.upid = wt.upid
                    where {app_filter} and ts.state = 'R' and ts.waker_utid is not null
                    group by wproc, wthread, tname order by n desc limit 20""",
            )
            if rows:
                p("谁在唤醒 app 线程（唤醒者 → 被唤醒）：")
                p()
                table(
                    ["唤醒者进程", "唤醒者线程", "被唤醒的 app 线程", "次数"],
                    [[r.wproc, r.wthread, r.tname, r.n] for r in rows],
                )
            rows = tp_rows(
                tp,
                f"""select s.name, count(*) n, sum(s.dur) / 1e6 ms
                    from slice s join thread_track tt on s.track_id = tt.id
                    join thread t using(utid) join process p using(upid)
                    where {app_filter} group by s.name order by ms desc limit 15""",
            )
            if rows:
                p("app 内 trace section（atrace）：")
                p()
                table(["section", "次数", "总时长 ms"], [[r.name[:80], r.n, f"{r.ms:.1f}"] for r in rows])
            rows = tp_rows(
                tp,
                """select count(*) n from slice where name like 'syscore_resume%' or name like 'suspend_enter%'""",
            )
            if rows and rows[0].n:
                p(f"- 期间系统挂起/恢复 {rows[0].n} 次")
                p()
            tp.close()
        except Exception as e:  # noqa: BLE001
            p(f"（解析 {fn} 失败：{e}）")
            p()

p("## 产出文件")
p()
p("- `threads_timeline.csv`：每个采样区间、每个线程的 CPU ms 与上下文切换数，可以做透视表/画图")
p("- `per_minute.csv`：每分钟 app CPU、唤醒数、最忙线程")
p("- `battery_current_per_min.csv`：每分钟平均/最大电流（需要 perfetto 包）")
p("- `samples.txt` / `battery.txt` / `wakelocks.txt` / `meminfo.txt`：原始采样")
p("- `batterystats_*.txt` / `alarm.txt` / `jobscheduler.txt` / `deviceidle.txt` / `power_final.txt`：结束时的系统 dump")
p("- `traces/`：perfetto trace，可在 https://ui.perfetto.dev 打开")

with open(os.path.join(OUT, "report.md"), "w") as f:
    f.write("\n".join(REPORT) + "\n")
print("\n".join(REPORT[:60]))
print("...")
