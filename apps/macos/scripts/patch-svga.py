#!/usr/bin/env python3
"""Replace legacy runtime-generated protobuf decoding with a bounded static reader.
Input: pinned SVGAPlayer-Web 2.3.1. Never enables unsafe-eval in the renderer.
"""
import hashlib
import json
import pathlib
import re
root = pathlib.Path(__file__).resolve().parents[1] / 'Sources/BBPlayerMac/Resources/Renderer'
vendor = root / 'svga.min.js'
source = vendor.read_text()
old = 'var i=f.inflate(e),n=o.decode(i),s={};'
new = 'var i=f.inflate(e),n=globalThis.BBPStaticSVGA.decode(i),s={};n.$type=o;'
if old in source:
    assert source.count(old) == 1
    assert hashlib.sha256(vendor.read_bytes()).hexdigest() == '3e8cb9a59e17a9b0861298eacc4beba79895ebd7178d97669687af07212509b6'
    vendor.write_text(source.replace(old, new))
else:
    assert source.count(new) == 1, 'Unexpected upstream renderer; review the integration before patching'
print('SVGA static decoding patch verified')
