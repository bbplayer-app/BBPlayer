#!/usr/bin/env python3
"""Limit the generated Podfile to the native modules the Linux iOS build compiles."""
import json
import re
import sys
from pathlib import Path

EXCLUDED_EXPO_MODULES = [
    'expo-dev-client', 'expo-dev-launcher', 'expo-dev-menu', 'expo-dev-menu-interface',
    'expo-updates', 'expo-insights', 'expo-observe', 'expo-app-metrics',
]


def main():
    podfile = Path(sys.argv[1])
    autolink_filter = sys.argv[2]
    text = podfile.read_text()
    excluded = ','.join(f"'{name}'" for name in EXCLUDED_EXPO_MODULES)
    text, modules = re.subn(r'use_expo_modules!(\([^)]*\))?', lambda _: f'use_expo_modules!(exclude: [{excluded}])', text, count=1)
    marker = 'config = use_native_modules!(config_command)'
    if modules != 1 or marker not in text:
        raise SystemExit(f'{podfile} no longer has the expected Expo template lines')
    text = text.replace(marker, f"config_command = ['node', {json.dumps(autolink_filter)}]\n  {marker}", 1)
    podfile.write_text(text)


if __name__ == '__main__':
    main()
