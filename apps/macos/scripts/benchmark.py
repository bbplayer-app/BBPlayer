#!/usr/bin/env python3
"""Launch disposable app data, measure process-cold readiness and CPU/RSS.
No Keychain access; no account or personal library is read.
"""
import argparse
import hashlib
import json
import pathlib
import statistics
import shutil
import subprocess
import tempfile
import time

parser = argparse.ArgumentParser()
parser.add_argument('--app', type=pathlib.Path, default=pathlib.Path(__file__).resolve().parents[1] / 'build/BBPlayer.app')
parser.add_argument('--seconds', type=int, default=300)
parser.add_argument('--scene', choices=['hidden', 'foreground', 'lyrics'], default='hidden')
parser.add_argument('--theme', type=pathlib.Path)
parser.add_argument('--lyrics-fixture', type=pathlib.Path)
parser.add_argument('--probe', type=pathlib.Path)
parser.add_argument('--output', type=pathlib.Path, required=True)
args = parser.parse_args()
executable = args.app.resolve() / 'Contents/MacOS/BBPlayerMac'

def cpu_seconds(value):
    parts = value.split(':')
    return sum(float(part) * (60 ** i) for i, part in enumerate(reversed(parts)))

def processes(pid):
    output = subprocess.check_output(['ps', '-axo', 'pid=,ppid=,rss=,time=,comm='], text=True)
    records = {}
    for line in output.splitlines():
        fields = line.split(None, 4)
        if len(fields) == 5:
            records[int(fields[0])] = (int(fields[1]), int(fields[2]), cpu_seconds(fields[3]), fields[4])
    included = {pid}
    while True:
        added = {key for key, value in records.items() if value[0] in included} - included
        if not added:
            break
        included |= added
    selected = {key: records[key] for key in included if key in records}
    return sum(row[1] for row in selected.values()) * 1024, sum(row[2] for row in selected.values()), [row[3] for row in selected.values()]

with tempfile.TemporaryDirectory(prefix='bbplayer-benchmark-') as temporary:
    root = pathlib.Path(temporary)
    def prepare(name):
        destination = root / name
        if args.theme:
            folder = destination / 'themes' / 'validation-theme'
            shutil.copytree(args.theme, folder)
            shutil.copyfile(folder / 'source-manifest.json', folder / 'theme.json')
        if name == 'playback' and args.lyrics_fixture:
            if not args.probe:
                raise RuntimeError('--lyrics-fixture requires --probe')
            subprocess.run([str(args.probe.resolve()), '--seed-lyrics', str(destination), str(args.lyrics_fixture.resolve()), '1137390809'], check=True)
        return destination
    extra = ['--qa-theme', 'active'] if args.theme else []
    startup = []
    for index in range(3):
        report = root / f'start-{index}.json'
        data_root = prepare(f'launch-{index}')
        started = time.time()
        process = subprocess.Popen([str(executable), '--qa-root', str(data_root), '--qa-report', str(report)] + extra, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            deadline = time.monotonic() + 20
            while not report.exists() and time.monotonic() < deadline:
                if process.poll() is not None:
                    raise RuntimeError('App exited before readiness')
                time.sleep(0.01)
            payload = json.loads(report.read_text())
            startup.append(payload['timestamp'] - started)
        finally:
            process.terminate()
            process.wait(timeout=10)
        time.sleep(0.3)
    print('Startup seconds:', startup, flush=True)
    playback_root = prepare('playback')
    process = subprocess.Popen([str(executable), '--qa-root', str(playback_root), '--qa-report', str(root / 'play.json'), '--qa-play', 'BV1Zu411x7mc', '--qa-scene', args.scene] + extra, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        deadline = time.monotonic() + 45
        while time.monotonic() < deadline:
            report = root / 'play.json'
            if report.exists():
                state = json.loads(report.read_text())
                if state.get('playing') and state.get('position', 0) > 2:
                    break
                if state.get('error'):
                    raise RuntimeError('Playback preparation failed: ' + str(state))
            time.sleep(1)
        else:
            raise RuntimeError('Playback did not start before warmup')
        time.sleep(20)
        _, first_cpu, commands = processes(process.pid)
        begin = time.monotonic()
        samples = []
        playback_samples = []
        for second in range(args.seconds):
            time.sleep(1)
            if process.poll() is not None:
                raise RuntimeError('App exited during measurement')
            rss, cpu, commands = processes(process.pid)
            samples.append(rss)
            current = json.loads((root / 'play.json').read_text())
            playback_samples.append({'elapsed': time.monotonic() - begin, **current})
            if (second + 1) % 60 == 0:
                print(f'{args.scene}: {second + 1}s, RSS {rss / 1048576:.1f} MiB', flush=True)
        elapsed = time.monotonic() - begin
        playback = json.loads((root / 'play.json').read_text())
        if playback.get('event') != 'playback' or not playback.get('playing') or playback.get('position', 0) <= 2:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.with_suffix('.failed.json').write_text(json.dumps({'valid': False, 'playback': playback, 'samples': playback_samples}, indent=2) + '\n')
            raise RuntimeError('Playback validation failed: ' + str(playback))
        if args.scene == 'foreground' and not playback.get('mainWindowVisible'):
            raise RuntimeError('Foreground window is not visible')
        if args.scene != 'foreground' and playback.get('mainWindowVisible'):
            raise RuntimeError('Main window is still visible in a background scenario')
        result = {'nonplaying_samples': sum(not point.get('playing', False) for point in playback_samples), 'binary_sha256': hashlib.sha256(executable.read_bytes()).hexdigest(), 'playback': playback, 'theme': 'representative downloaded Bilibili theme' if args.theme else 'default', 'lyric_fixture': args.lyrics_fixture.name if args.lyrics_fixture else None, 'scene': args.scene, 'startup_seconds': startup, 'startup_median_seconds': statistics.median(startup), 'measurement_seconds': elapsed, 'cpu_percent_single_core_100': (cpu - first_cpu) / elapsed * 100, 'rss_mean_mib': statistics.mean(samples) / 1048576, 'rss_peak_mib': max(samples) / 1048576, 'rss_first_mib': samples[0] / 1048576, 'rss_last_mib': samples[-1] / 1048576, 'process_commands': commands, 'note': 'RSS (not physical footprint); app and descendant processes. SVGA preview is closed; theme name recorded separately. Audio muted; decode/render pipeline active. Source BVID fixed; no user credentials.'}
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.with_suffix('.trace.json').write_text(json.dumps(playback_samples, ensure_ascii=False) + '\n')
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps(result, ensure_ascii=False), flush=True)
    finally:
        process.terminate()
        process.wait(timeout=10)
