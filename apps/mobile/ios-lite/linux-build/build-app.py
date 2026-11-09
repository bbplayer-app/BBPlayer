#!/usr/bin/env python3
"""Compile, link and package BBPlayer.app from the pods built by build.py."""
import json
import os
import plistlib
import re
import shutil
import subprocess
import sys
from pathlib import Path

import build as b

MOBILE = b.MOBILE
IOS = MOBILE / 'ios'
SUPPORT = b.PODS / 'Target Support Files/Pods-BBPlayer'
APP_INT = b.INT / 'BBPlayer'
OUT = b.ROOT / 'BBPlayer.app'
JS = b.ROOT / 'js'
LD = b.ART / 'toolset/bin/ld64.lld'
PNPM_STORE = MOBILE.parent.parent / 'node_modules/.pnpm'
SCANNED ={'expo-application': 'ExpoApplication', 'expo-haptics': 'ExpoHaptics', 'expo-sqlite': 'ExpoSQLite'}
SKIP_IN_FRAMEWORK = {'Headers', 'PrivateHeaders', 'Modules', '_CodeSignature', 'dSYMs'}


class AppTarget:
    kind = 'app'
    name = 'BBPlayer'
    module = 'BBPlayer'
    product = 'BBPlayer'
    has_public_objc = False
    raw = {'headers': []}

    def __init__(self, project):
        self.derived = APP_INT / 'DerivedSources'
        self.objdir = APP_INT / 'Objects'
        self.built = b.PROD / 'BBPlayer'
        base = b.base_settings()
        base.update({'SRCROOT': str(IOS), 'PROJECT_DIR': str(IOS)})
        fixed = {
            'TARGET_NAME': 'BBPlayer', 'PRODUCT_NAME': 'BBPlayer', 'SWIFT_VERSION': '5.0',
            'IPHONEOS_DEPLOYMENT_TARGET': b.DT, 'CONFIGURATION_BUILD_DIR': str(self.built),
            'BUILT_PRODUCTS_DIR': str(self.built),
            'OTHER_SWIFT_FLAGS': '$(inherited) -D EXPO_CONFIGURATION_RELEASE',
        }
        self.s = b.Settings([base, project, b.parse_xcconfig(SUPPORT / 'Pods-BBPlayer.release.xcconfig'), fixed])
        self.swift_files = []

    def own_header_dirs(self):
        return []


def newest_match(root, pattern):
    """The file a version-stamped path resolves to, so upgrades don't need edits here."""
    matches = sorted(Path(root).glob(pattern))
    if not matches:
        raise SystemExit(f'nothing matches {pattern} in {root}')
    return matches[-1]


def patched_provider():
    """Add the @ExpoModule classes that autolinking's scan could not resolve under pnpm."""
    text = (SUPPORT / 'ExpoModulesProvider.swift').read_text()
    expo = b.node_resolve('expo')
    roots = [str(Path(b.node_resolve(name, expo if name != 'expo-sqlite' else None)) / 'ios') for name in SCANNED]
    output = json.loads(subprocess.check_output([str(b.macro_tool()), 'scan-modules'] + roots, text=True))
    classes = [item['name'] for item in output['modules']
               if item['accessLevel'] in ('public', 'open') and 'iOS' in item['platforms']]
    log = ', '.join(classes)
    print(f'  scanned modules: {log}', flush=True)
    imports = ''.join(f'internal import {module}\n' for module in SCANNED.values() if f'internal import {module}\n' not in text)
    text = text.replace('internal import ExpoModulesCore\n', 'internal import ExpoModulesCore\n' + imports, 1)
    marker = 'getModuleClasses() -> [ExpoModuleTupleType] {\n    return [\n'
    if marker not in text:
        raise SystemExit('provider format changed')
    entries = ''.join(f'      (module: {name}.self, name: nil),\n' for name in classes if f'(module: {name}.self' not in text)
    return text.replace(marker, marker + entries, 1)


def prepare_sources(target):
    src = APP_INT / 'Sources'
    src.mkdir(parents=True, exist_ok=True)
    delegate = (IOS / 'BBPlayer/AppDelegate.swift').read_text()
    delegate = delegate.replace('import FirebaseCore\n', '')
    delegate = re.sub(r'// @generated begin bootsplash-header.*?// @generated end bootsplash-header\n', '', delegate, flags=re.S)
    delegate = re.sub(r'// @generated begin bootsplash-init.*?// @generated end bootsplash-init\n', '', delegate, flags=re.S)
    files = {'AppDelegate.swift': delegate, 'SceneDelegate.swift': (IOS / 'BBPlayer/SceneDelegate.swift').read_text(),
             'ExpoModulesProvider.swift': patched_provider()}
    for name, text in files.items():
        path = src / name
        if not path.exists() or path.read_text() != text:
            path.write_text(text)
    target.swift_files = [str(src / name) for name in files]


def compile_app(target):
    args = b.swift_args(target)
    env = dict(os.environ)
    env.pop('SDKROOT', None)
    result = subprocess.run(args, env=env, capture_output=True, text=True, errors='replace')
    (b.LOGS / 'BBPlayer-app.log').write_text(' '.join(args) + '\n\n' + result.stdout + result.stderr)
    if result.returncode:
        for line in (result.stdout + result.stderr).splitlines():
            if 'error:' in line:
                print(line[:260])
        raise SystemExit('app Swift compile failed')
    return b.swift_outputs(target)[2]


def link_app(target, obj):
    s = target.s
    runtime = newest_match(b.DEV / 'Toolchains/XcodeDefault.xctoolchain/usr/lib/clang', '*/lib/darwin/libclang_rt.ios.a')
    link = [str(LD), '-arch', 'arm64', '-platform_version', 'ios', b.DT, b.SDK_VERSION, '-syslibroot', str(b.SDK),
            '-e', '_main', '-dead_strip', str(obj), str(runtime)]
    for path in b.search_paths(s.list('LIBRARY_SEARCH_PATHS')):
        link += ['-L', path]
    for path in b.search_paths(s.list('FRAMEWORK_SEARCH_PATHS')):
        link += ['-F', path]
    link += ['-L', str(b.RES / 'iphoneos'), '-L', str(b.SDK / 'usr/lib/swift')]
    link += s.list('OTHER_LDFLAGS')
    link += ['-lc++', '-lobjc', '-lSystem']
    link += ['-rpath', '/usr/lib/swift', '-rpath', '@executable_path/Frameworks']
    link += ['-o', str(OUT / 'BBPlayer'), '-map', str(APP_INT / 'link.map')]
    (APP_INT / 'link.json').write_text(json.dumps(link, indent=1))
    result = subprocess.run(link, capture_output=True, text=True, errors='replace')
    (b.LOGS / 'BBPlayer-link.log').write_text(result.stdout + result.stderr)
    errors = [line for line in (result.stdout + result.stderr).splitlines() if 'error' in line.lower() and 'does not support linking' not in line]
    if result.returncode:
        for line in errors[:60]:
            print(line[:240])
        print(f'  ({len(errors)} error lines)')
        raise SystemExit('link failed')


def release_block(path):
    text = Path(path).read_text(errors='replace')
    match = re.search(r'if \[\[ "\$CONFIGURATION" == "Release" \]\]; then\n(.*?)\nfi', text, re.S)
    return match.group(1) if match else ''


def install_frameworks(target):
    dest = OUT / 'Frameworks'
    dest.mkdir(parents=True, exist_ok=True)
    for raw in re.findall(r'install_framework "([^"]+)"', release_block(SUPPORT / 'Pods-BBPlayer-frameworks.sh')):
        path = Path(target.s.expand(raw, len(target.s.layers), 'X'))
        out = dest / path.name
        out.mkdir(parents=True, exist_ok=True)
        for entry in path.iterdir():
            if entry.name not in SKIP_IN_FRAMEWORK:
                b.copy_tree_entry(entry, out / entry.name)


def install_resources(target):
    for raw in re.findall(r'install_resource "([^"]+)"', release_block(SUPPORT / 'Pods-BBPlayer-resources.sh')):
        path = Path(target.s.expand(raw, len(target.s.layers), 'X')).resolve()
        if not path.exists():
            print(f'  warning: missing resource {path}')
            continue
        b.copy_tree_entry(path, OUT / path.name)


def write_app_config():
    expo = b.node_resolve('expo')
    constants = Path(b.node_resolve('expo-constants', expo))
    dest = OUT / 'EXConstants.bundle'
    dest.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ, APP_VARIANT='production', NODE_ENV='production', BBPLAYER_IOS_LITE='1')
    subprocess.run(['node', str(constants / 'scripts/getAppConfig.js'), str(MOBILE), str(dest), 'ios', 'false', 'production'],
                   cwd=MOBILE, env=env, check=True, stdout=subprocess.DEVNULL)


def make_icons():
    icons = MOBILE / 'assets/images/icon.png'
    jimp = newest_match(PNPM_STORE, 'jimp-compact@*/node_modules/jimp-compact')
    script = (
        "const J=require(process.argv[1]);(async()=>{const i=await J.read(process.argv[2]);"
        "for(const [n,s] of [['AppIcon60x60@2x.png',120],['AppIcon60x60@3x.png',180]])"
        "await i.clone().resize(s,s).writeAsync(process.argv[3]+'/'+n)})()"
    )
    subprocess.run(['node', '-e', script, str(jimp), str(icons), str(OUT)], check=True)


def substitute(value, table):
    if isinstance(value, str):
        return re.sub(r'\$\(([A-Z_]+)(?::[a-z0-9]+)?\)', lambda m: table.get(m.group(1), ''), value)
    if isinstance(value, list):
        return [substitute(item, table) for item in value]
    if isinstance(value, dict):
        return {key: substitute(item, table) for key, item in value.items()}
    return value


def write_info_plist():
    with open(IOS / 'BBPlayer/Info.plist', 'rb') as handle:
        info = plistlib.load(handle)
    version = json.loads((MOBILE / 'package.json').read_text())['version']
    info = substitute(info, {
        'PRODUCT_BUNDLE_IDENTIFIER': 'com.roitium.bbplayer', 'EXECUTABLE_NAME': 'BBPlayer',
        'PRODUCT_NAME': 'BBPlayer', 'PRODUCT_MODULE_NAME': 'BBPlayer', 'DEVELOPMENT_LANGUAGE': 'en',
        'PRODUCT_BUNDLE_PACKAGE_TYPE': 'APPL', 'MARKETING_VERSION': version, 'CURRENT_PROJECT_VERSION': '1',
    })
    info.pop('UILaunchStoryboardName', None)
    info.pop('LSMinimumSystemVersion', None)
    info.update({
        'CFBundleDisplayName': 'BBPlayer',
        'UILaunchScreen': {},
        'UIBackgroundModes': ['audio'],
        'NSAppTransportSecurity': {'NSAllowsArbitraryLoads': True},
        'UIAppFonts': sorted(path.name for path in OUT.iterdir() if path.suffix.lower() in ('.ttf', '.otf')),
        'CFBundleSupportedPlatforms': ['iPhoneOS'],
        'MinimumOSVersion': b.DT,
        'UIDeviceFamily': [1],
        'DTPlatformName': 'iphoneos',
        'DTPlatformVersion': b.SDK_VERSION,
        'DTSDKName': f'iphoneos{b.SDK_VERSION}',
        'CFBundleIcons': {'CFBundlePrimaryIcon': {'CFBundleIconFiles': ['AppIcon60x60'], 'CFBundleIconName': 'AppIcon'}},
    })
    with open(OUT / 'Info.plist', 'wb') as handle:
        plistlib.dump(info, handle)


def main():
    data = json.loads((b.ROOT / 'manifest.json').read_text())
    target = AppTarget(data['project_settings'])
    target.derived.mkdir(parents=True, exist_ok=True)
    target.objdir.mkdir(parents=True, exist_ok=True)
    target.built.mkdir(parents=True, exist_ok=True)
    b.LOGS.mkdir(parents=True, exist_ok=True)
    print('== app sources', flush=True)
    prepare_sources(target)
    print('== compile app', flush=True)
    obj = compile_app(target)
    if OUT.exists():
        b.force_rmtree(OUT)
    OUT.mkdir(parents=True)
    print('== link', flush=True)
    link_app(target, obj)
    print('== bundle', flush=True)
    install_frameworks(target)
    install_resources(target)
    write_app_config()
    make_icons()
    write_info_plist()
    expo_plist = IOS / 'BBPlayer/Supporting/Expo.plist'
    if expo_plist.exists():
        shutil.copy2(expo_plist, OUT / 'Expo.plist')
    hermesc = newest_match(PNPM_STORE, 'hermes-compiler@*/node_modules/hermes-compiler/hermesc/linux64-bin/hermesc')
    subprocess.run([str(hermesc), '-emit-binary', '-O', '-w', '-out', str(OUT / 'main.jsbundle'), str(JS / 'main.jsbundle')], check=True)
    if (JS / 'assets').exists():
        b.copy_tree_entry(JS / 'assets', OUT / 'assets')
    size = subprocess.check_output(['du', '-sh', str(OUT)], text=True).split()[0]
    print(f'built {OUT} ({size})')


if __name__ == '__main__':
    sys.exit(main())
