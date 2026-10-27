#!/usr/bin/env python3
"""Controlled local byte-range source for playback acceptance; no external traffic."""
import argparse
import http.server
import json
import threading
import time
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

parser = argparse.ArgumentParser()
parser.add_argument('--audio', required=True)
parser.add_argument('--rate', type=int, default=250000)
parser.add_argument('--rtt', type=float, default=.1)
parser.add_argument('--total', type=int)
args = parser.parse_args()
payload = Path(args.audio).read_bytes()
lock = threading.Lock()
requests = []
next_send = 0.0
paused = threading.Event()
total = args.total or len(payload)


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        global next_send
        if urlsplit(self.path).path == '/control':
            values = parse_qs(urlsplit(self.path).query)
            if values.get('paused') == ['1']: paused.set()
            else: paused.clear()
            self.send_response(200); self.send_header('Content-Length', '0'); self.end_headers()
            return
        if urlsplit(self.path).path == '/stats':
            with lock:
                body = json.dumps(requests).encode()
            self.send_response(200)
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        bounds = self.headers.get('Range', 'bytes=0-').split('=')[1].split('-')
        start = int(bounds[0])
        end = min(total-1, int(bounds[1]) if bounds[1] else total-1)
        if start > end:
            self.send_error(416)
            return
        record = {'offset': start, 'length': end-start+1, 'sent': 0,
                  'path': urlsplit(self.path).path}
        with lock:
            requests.append(record)
        time.sleep(args.rtt)
        self.send_response(206)
        self.send_header('Content-Range', f'bytes {start}-{end}/{total}')
        self.send_header('Content-Type', 'audio/mp4')
        self.send_header('Content-Length', str(end-start+1))
        self.end_headers()
        try:
            for offset in range(start, end+1, 8192):
                while paused.is_set(): time.sleep(.01)
                count = min(8192, end-offset+1)
                relative = offset % len(payload)
                block = payload[relative:relative+count]
                if len(block) < count: block += payload[:count-len(block)]
                with lock:
                    scheduled = max(time.monotonic(), next_send)
                    next_send = scheduled + len(block) / args.rate
                time.sleep(max(0, scheduled-time.monotonic()))
                self.wfile.write(block)
                self.wfile.flush()
                with lock:
                    record['sent'] += len(block)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def log_message(self, *unused):
        pass


server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
print(server.server_port, flush=True)
server.serve_forever()
