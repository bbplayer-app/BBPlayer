#!/usr/bin/env python3
"""Compile the CocoaPods build graph of BBPlayer's iOS app on Linux.

Reads the JSON manifest made by export-manifest.rb, then does the parts of
xcodebuild the app needs: resolve build settings, lay out headers and module
maps, compile Swift and C-family sources, and archive each pod.
"""
import argparse
import concurrent.futures as cf
import fnmatch
import hashlib
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import tarfile
import threading
from functools import cache
from pathlib import Path

HOME = Path.home()
SCRIPT_DIR = Path(__file__).resolve().parent
BB = Path(os.environ.get('BBPLAYER_IOS_HOME', HOME / '.local/share/bbplayer-ios'))
TOOLS = Path(os.environ.get('BBPLAYER_IOS_SWIFT', BB / 'swift-6.4.2')) / 'usr/bin'
CLANG = TOOLS / 'clang'
CLANGXX = TOOLS / 'clang++'
SWIFTC = TOOLS / 'swiftc'
LLVM_AR = TOOLS / 'llvm-ar'
ART = HOME / '.swiftpm/swift-sdks/darwin.artifactbundle'
DEV = ART / 'Developer'
SDK = DEV / 'Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS.sdk'
RES = DEV / 'Toolchains/XcodeDefault.xctoolchain/usr/lib/swift'
PLATFORM_DEV = DEV / 'Platforms/iPhoneOS.platform/Developer'
SDK_VERSION = json.loads((SDK / 'SDKSettings.json').read_text())['Version']
MOBILE = SCRIPT_DIR.parents[1]
PODS = MOBILE / 'ios/Pods'
ROOT = BB / 'build'
BUILD_DIR = ROOT / 'products'
PROD = BUILD_DIR / 'Release-iphoneos'
INT = ROOT / 'intermediates'
LOGS = ROOT / 'logs'
CACHE = ROOT / 'ModuleCache'
SHIMS = SCRIPT_DIR / 'shims'
XCFW_DIR = PROD / 'XCFrameworkIntermediates'
DT = '16.4'
ALL_HEADERS = ROOT / 'all-target-headers'
GLOBAL_IQUOTE = [PODS / 'React-Core-prebuilt/Headers/React_RCTAppDelegate', ALL_HEADERS,
                 XCFW_DIR / 'React-Core-prebuilt/React.framework/Headers']
LANG = {'.m': 'objective-c', '.mm': 'objective-c++', '.c': 'c', '.cpp': 'c++',
        '.cc': 'c++', '.cxx': 'c++', '.s': 'assembler-with-cpp'}
# Both of these define JBAnimatedTextComponentName; the library's own copy is the one it uses.
SKIP_SOURCES = {'ReactCodegen': ('JBAnimatedTextCodegen/ShadowNodes.cpp',)}
# Source fixes applied to a private copy, so node_modules stays untouched.
OVERLAYS = {
    # There is no storyboard launch screen here, so nothing will ever report it hidden.
    ('RNBootSplash', 'RNBootSplash.mm'): [
        ('if (RCTRunningInAppExtension()) {\n    return resolve(@(true));', 'if (true) {\n    return resolve(@(true));'),
    ],
}
VAR = re.compile(r'\$\(([^()$]+)\)|\$\{([^{}$]+)\}')
print_lock = threading.Lock()


def log(msg):
    with print_lock:
        print(msg, flush=True)


def node_resolve(package, base=None):
    """Find an installed package the way Node would, from `base` when it is a transitive dependency."""
    paths = f",{{paths:['{base}']}}" if base else ''
    return subprocess.check_output(
        ['node', '-p', f"require('path').dirname(require.resolve('{package}/package.json'{paths}))"],
        cwd=MOBILE, text=True).strip()


@cache
def macro_tool():
    """The Linux build of Expo's Swift macro plugin, published alongside expo-modules-macros."""
    core = node_resolve('expo-modules-core', node_resolve('expo'))
    macros = node_resolve('expo-modules-macros', core)
    return Path(node_resolve('@expo/modules-macros-linux-x64', macros)) / 'ExpoModulesMacros'


def pod_artifact(pattern):
    """The release tarball CocoaPods downloaded for the installed React Native version."""
    matches = sorted(PODS.glob(pattern))
    if len(matches) != 1:
        raise SystemExit(f'expected one {pattern} in {PODS}, found {len(matches)}')
    return matches[0]


def cond_ok(conds):
    actual = {'sdk': f'iphoneos{SDK_VERSION}', 'arch': 'arm64', 'config': 'Release'}
    for key, value in re.findall(r'\[([^\]=]+)=([^\]]+)\]', conds):
        if not fnmatch.fnmatch(actual.get(key, ''), value):
            return False
    return True


def norm_layer(layer):
    out = {}
    plain = {}
    for key, value in layer.items():
        match = re.match(r'^([A-Za-z0-9_]+)((?:\[[^\]]*\])*)$', key)
        if not match or not cond_ok(match.group(2)):
            continue
        if isinstance(value, list):
            value = ' '.join(str(item) for item in value)
        if match.group(2):
            out[match.group(1)] = str(value)
        else:
            plain[match.group(1)] = str(value)
    plain.update(out)
    return plain


def apply_mod(value, mod):
    if not mod:
        return value
    if mod in ('c99extidentifier', 'identifier'):
        return re.sub(r'[^A-Za-z0-9_]', '_', value)
    if mod == 'rfc1034identifier':
        return re.sub(r'[^A-Za-z0-9.-]', '-', value)
    return value


class Settings:
    def __init__(self, layers):
        self.layers = [norm_layer(layer) for layer in layers]

    def lookup(self, key, below):
        for index in range(below - 1, -1, -1):
            if key in self.layers[index]:
                return index, self.layers[index][key]
        return None, None

    def expand(self, value, level, key, depth=0):
        if depth > 40:
            return value

        def replace(match):
            name = match.group(1) or match.group(2)
            mod = None
            if ':' in name:
                name, mod = name.split(':', 1)
            if name == 'inherited' or name == key:
                index, raw = self.lookup(key, level)
                result = '' if raw is None else self.expand(raw, index, key, depth + 1)
            else:
                index, raw = self.lookup(name, len(self.layers))
                result = '' if raw is None else self.expand(raw, index, name, depth + 1)
            return apply_mod(result, mod)

        previous = None
        while previous != value:
            previous = value
            value = VAR.sub(replace, value)
        return value

    def get(self, key, default=''):
        index, raw = self.lookup(key, len(self.layers))
        return default if raw is None else self.expand(raw, index, key)

    def list(self, key):
        value = self.get(key)
        try:
            return shlex.split(value)
        except ValueError:
            return value.split()

    def yes(self, key, default=False):
        value = self.get(key, 'YES' if default else 'NO')
        return value.upper() in ('YES', 'TRUE', '1')

    def environ(self):
        keys = set()
        for layer in self.layers:
            keys.update(layer)
        return {key: self.get(key) for key in keys}


def parse_xcconfig(path):
    out = {}
    if not path or not Path(path).exists():
        return out
    for line in Path(path).read_text(errors='replace').splitlines():
        line = line.strip()
        if not line or line.startswith('//') or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        out[key.strip()] = value.strip()
    return out


def base_settings():
    return {
        'SRCROOT': str(PODS), 'PROJECT_DIR': str(PODS), 'SOURCE_ROOT': str(PODS),
        'SDKROOT': str(SDK), 'BUILD_DIR': str(BUILD_DIR), 'BUILD_ROOT': str(BUILD_DIR),
        'SYMROOT': str(BUILD_DIR), 'OBJROOT': str(INT), 'CONFIGURATION': 'Release',
        'EFFECTIVE_PLATFORM_NAME': '-iphoneos', 'PLATFORM_NAME': 'iphoneos',
        'ARCHS': 'arm64', 'CURRENT_ARCH': 'arm64', 'NATIVE_ARCH': 'arm64',
        'DEVELOPMENT_LANGUAGE': 'en', 'GCC_OPTIMIZATION_LEVEL': 's',
        'SWIFT_OPTIMIZATION_LEVEL': '-O', 'SWIFT_COMPILATION_MODE': 'wholemodule',
        'GCC_C_LANGUAGE_STANDARD': 'gnu11', 'CLANG_CXX_LIBRARY': 'libc++',
        'CLANG_CXX_LANGUAGE_STANDARD': 'gnu++14', 'SWIFT_VERSION': '5.0',
        'CONFIGURATION_BUILD_DIR': '$(BUILD_DIR)/$(CONFIGURATION)$(EFFECTIVE_PLATFORM_NAME)',
        'PRODUCT_NAME': '$(TARGET_NAME)',
        'PRODUCT_MODULE_NAME': '$(PRODUCT_NAME:c99extidentifier)',
        'OTHER_CPLUSPLUSFLAGS': '$(OTHER_CFLAGS)',
    }


class Target:
    KIND = {'com.apple.product-type.framework': 'framework',
            'com.apple.product-type.library.static': 'static',
            'com.apple.product-type.bundle': 'bundle'}

    def __init__(self, raw, project):
        self.raw = raw
        self.name = raw['name']
        self.kind = 'aggregate' if raw['isa'] == 'PBXAggregateTarget' else self.KIND[raw['product_type']]
        derived = INT / self.name / 'DerivedSources'
        fixed = {
            'TARGET_NAME': self.name,
            'IPHONEOS_DEPLOYMENT_TARGET': DT,
            'BUILT_PRODUCTS_DIR': '$(CONFIGURATION_BUILD_DIR)',
            'TARGET_BUILD_DIR': '$(CONFIGURATION_BUILD_DIR)',
            'DERIVED_SOURCES_DIR': str(derived),
            'DERIVED_FILE_DIR': str(derived),
            'TARGET_TEMP_DIR': str(INT / self.name),
        }
        self.s = Settings([base_settings(), project, {'TARGET_NAME': self.name},
                           parse_xcconfig(raw.get('xcconfig')), raw['settings'], fixed])
        self.product = self.s.get('PRODUCT_NAME')
        self.module = self.s.get('PRODUCT_MODULE_NAME') or self.product
        self.built = Path(self.s.get('CONFIGURATION_BUILD_DIR'))
        self.derived = derived
        self.objdir = INT / self.name / 'Objects'
        self.fw = self.built / f'{self.product}.framework'
        skipped = SKIP_SOURCES.get(self.name, ())
        self.sources = [item for item in raw.get('sources', [])
                        if item.get('path') and not item['path'].endswith(skipped or ('\0',))]
        self.swift_files = [item['path'] for item in self.sources if item['path'].endswith('.swift')]
        self.c_files = [item for item in self.sources if Path(item['path']).suffix.lower() in LANG]
        self.deps = list(dict.fromkeys(raw.get('deps', [])))

    @property
    def archive(self):
        return self.fw / self.product if self.kind == 'framework' else self.built / f'lib{self.product}.a'

    @property
    def has_public_objc(self):
        return any('Public' in (item['settings'].get('ATTRIBUTES') or []) for item in self.raw.get('headers', []))

    def own_header_dirs(self):
        dirs = {str(Path(item['path']).parent) for item in self.raw.get('headers', []) if item.get('path')}
        return sorted(dirs)


def search_paths(entries):
    out = []
    for entry in entries:
        if entry.endswith('/**'):
            base = entry[:-3]
            out.append(base)
            for directory, subdirs, _ in os.walk(base):
                subdirs[:] = [name for name in subdirs if not name.startswith('.') and not name.endswith('.xcframework')]
                out.append(directory)
        elif entry not in ('', '$(inherited)'):
            out.append(entry)
    return list(dict.fromkeys(out))


def clean_flags(flags):
    return [flag for flag in flags if not flag.startswith('-Werror') and flag != '-Wall']


def install_file(src, dst):
    dst = Path(dst)
    if dst.exists() or dst.is_symlink():
        dst.unlink()
    shutil.copy2(src, dst)
    os.chmod(dst, os.stat(dst).st_mode | 0o200)


def force_rmtree(path):
    subprocess.run(['chmod', '-R', 'u+rwX', str(path)], check=False)
    shutil.rmtree(path)


def copy_tree_entry(src, dst):
    src, dst = Path(src), Path(dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.is_dir() and not dst.is_symlink():
        force_rmtree(dst)
    elif dst.exists() or dst.is_symlink():
        dst.unlink()
    if src.is_dir():
        shutil.copytree(src, dst, symlinks=True)
        subprocess.run(['chmod', '-R', 'u+rwX', str(dst)], check=False)
    else:
        shutil.copy2(src, dst)
        os.chmod(dst, os.stat(dst).st_mode | 0o200)


def extract_release_tarball(tarball, dest):
    dest = Path(dest)
    stamp = dest / '.extracted'
    if stamp.exists() and stamp.read_text() == str(tarball.stat().st_mtime_ns):
        return
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True)
    with tarfile.open(tarball) as archive:
        archive.extractall(dest, filter='tar')
    stamp.write_text(str(tarball.stat().st_mtime_ns))


def prepare_prebuilts(targets):
    """Copy each vendored xcframework's device slice to where the xcconfigs expect it."""
    pattern = re.compile(r'^install_xcframework\s+(.*)$', re.M)
    for target in targets.values():
        script = PODS / 'Target Support Files' / target.name / f'{target.name}-xcframeworks.sh'
        if not script.exists():
            continue
        for match in pattern.finditer(script.read_text(errors='replace')):
            parts = shlex.split(match.group(1))
            if len(parts) < 3:
                continue
            path = parts[0].replace('${PODS_ROOT}', str(PODS))
            name = parts[1]
            slice_dir = Path(path) / 'ios-arm64'
            if not slice_dir.exists():
                candidates = [item for item in Path(path).glob('ios-arm64*') if 'simulator' not in item.name and 'catalyst' not in item.name]
                if not candidates:
                    log(f'  warning: no device slice in {path}')
                    continue
                slice_dir = candidates[0]
            out = XCFW_DIR / name
            out.mkdir(parents=True, exist_ok=True)
            for entry in slice_dir.iterdir():
                if entry.name not in ('dSYMs', '_CodeSignature'):
                    copy_tree_entry(entry, out / entry.name)
    art = ROOT / 'prebuilt'
    core = pod_artifact('ReactNativeCore-artifacts/reactnative-core-*-release.tar.gz')
    deps = pod_artifact('ReactNativeDependencies-artifacts/reactnative-dependencies-*-release.tar.gz')
    herm = pod_artifact('hermes-engine-artifacts/hermes-ios-*-release.tar.gz')
    extract_release_tarball(core, art / 'core')
    extract_release_tarball(deps, art / 'deps')
    extract_release_tarball(herm, art / 'hermes')
    copy_tree_entry(art / 'core/React.xcframework/ios-arm64/React.framework', XCFW_DIR / 'React-Core-prebuilt/React.framework')
    copy_tree_entry(art / 'deps/packages/react-native/third-party/ReactNativeDependencies.xcframework/ios-arm64/ReactNativeDependencies.framework',
                    XCFW_DIR / 'ReactNativeDependencies/ReactNativeDependencies.framework')
    copy_tree_entry(art / 'hermes/destroot/Library/Frameworks/universal/hermesvm.xcframework/ios-arm64/hermesvm.framework',
                    XCFW_DIR / 'hermes-engine/Pre-built/hermesvm.framework')
    copy_tree_entry(art / 'hermes/destroot/Library/Frameworks/universal/hermesvm.xcframework/ios-arm64/hermesvm.framework',
                    XCFW_DIR / 'hermes-engine/hermesvm.framework')


def build_jsi():
    """Build the real ExpoModulesJSI framework and install it for the pods."""
    out = XCFW_DIR / 'ExpoModulesJSI/ExpoModulesJSI.framework'
    core = node_resolve('expo-modules-core', node_resolve('expo'))
    jsi = Path(node_resolve('expo-modules-jsi', core))
    rn = node_resolve('react-native')
    src = ROOT / 'jsi-src'
    if not (src / 'Package.swift').exists():
        src.mkdir(parents=True, exist_ok=True)
        for name in ('Package.swift', 'Sources', 'APINotes', 'scripts', 'Tests', 'Benchmarks'):
            copy_tree_entry(jsi / 'apple' / name, src / name)
        subprocess.run(['chmod', '-R', 'u+w', str(src)], check=True)
    env = dict(os.environ, PATH=f'{TOOLS}:{os.environ["PATH"]}', PODS_ROOT=str(PODS), RN_ROOT=rn, EXPO_CUSTOM_BUILD_ROOT=str(src))
    env.pop('SDKROOT', None)
    subprocess.run(['bash', 'scripts/generate-modulemap.sh'], cwd=src, env=env, check=True, capture_output=True)
    inc = str(TOOLS.parent / 'include')
    cmd = ['swift', 'build', '--build-system', 'native', '--swift-sdk', 'arm64-apple-ios', '-c', 'release',
           '--product', 'ExpoModulesJSI', '-j', '16', '-Xcxx', f'-I{inc}', '-Xcc', f'-I{inc}',
           '-Xswiftc', '-Xcc', '-Xswiftc', f'-I{inc}', '-Xswiftc', '-enable-experimental-feature',
           '-Xswiftc', 'AssumeResilientCxxTypes', '-Xlinker', '-install_name', '-Xlinker',
           '@rpath/ExpoModulesJSI.framework/ExpoModulesJSI']
    LOGS.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(cmd, cwd=src, env=env, capture_output=True, text=True, errors='replace')
    (LOGS / 'ExpoModulesJSI.log').write_text(result.stdout + result.stderr)
    if result.returncode:
        raise SystemExit('ExpoModulesJSI build failed, see ' + str(LOGS / 'ExpoModulesJSI.log'))
    headers_tar = jsi / 'prebuilds/output/headers/xcframeworks/ExpoModulesJSIHeaders.tar.gz'
    extract = ROOT / 'prebuilt/jsi-headers'
    extract_release_tarball(headers_tar, extract)
    slice_dir = extract / 'ExpoModulesJSIHeaders.xcframework/ios-arm64'
    if out.exists():
        force_rmtree(out)
    (out / 'Headers').mkdir(parents=True)
    (out / 'Modules').mkdir(parents=True)
    install_file(src / '.build/arm64-apple-ios/release/libExpoModulesJSI.dylib', out / 'ExpoModulesJSI')
    for header in ('ExpoModulesJSI-Swift.h', 'NativeState.h'):
        install_file(slice_dir / 'Headers/ExpoModulesJSI' / header, out / 'Headers' / header)
    modulemap = (slice_dir / 'Headers/ExpoModulesJSI/module.modulemap').read_text()
    (out / 'Modules/module.modulemap').write_text('framework ' + modulemap)
    copy_tree_entry(slice_dir / 'ExpoModulesJSI.swiftmodule', out / 'Modules/ExpoModulesJSI.swiftmodule')
    (out / 'Info.plist').write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" '
        '"http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>'
        '<key>CFBundleExecutable</key><string>ExpoModulesJSI</string>'
        '<key>CFBundleIdentifier</key><string>host.exp.ExpoModulesJSI</string>'
        '<key>CFBundlePackageType</key><string>FMWK</string>'
        '<key>CFBundleShortVersionString</key><string>1.0</string>'
        '<key>CFBundleVersion</key><string>1</string>'
        '<key>MinimumOSVersion</key><string>16.4</string></dict></plist>\n')


def setup_target(target):
    target.derived.mkdir(parents=True, exist_ok=True)
    target.objdir.mkdir(parents=True, exist_ok=True)
    target.built.mkdir(parents=True, exist_ok=True)
    if target.kind != 'framework':
        return
    headers = target.fw / 'Headers'
    private = target.fw / 'PrivateHeaders'
    headers.mkdir(parents=True, exist_ok=True)
    (target.fw / 'Modules').mkdir(parents=True, exist_ok=True)
    for item in target.raw.get('headers', []):
        attrs = item['settings'].get('ATTRIBUTES') or []
        if 'Public' in attrs:
            install_file(item['path'], headers / item['name'])
        elif 'Private' in attrs:
            private.mkdir(parents=True, exist_ok=True)
            install_file(item['path'], private / item['name'])
    for phase in target.raw.get('copy_files', []):
        dst = phase.get('dst_path', '')
        base = None
        if dst.startswith('$(PUBLIC_HEADERS_FOLDER_PATH)'):
            base = headers / dst[len('$(PUBLIC_HEADERS_FOLDER_PATH)'):].lstrip('/')
        elif dst.startswith('$(PRIVATE_HEADERS_FOLDER_PATH)'):
            base = private / dst[len('$(PRIVATE_HEADERS_FOLDER_PATH)'):].lstrip('/')
        if base is None:
            continue
        base.mkdir(parents=True, exist_ok=True)
        for item in phase['files']:
            if item.get('path'):
                install_file(item['path'], base / item['name'])
    modulemap = target.s.get('MODULEMAP_FILE')
    if modulemap:
        source = Path(modulemap)
        if not source.is_absolute():
            source = PODS / modulemap
        install_file(source, target.fw / 'Modules/module.modulemap')


def swift_outputs(target):
    if target.kind == 'framework':
        module_dir = target.fw / 'Modules' / f'{target.module}.swiftmodule'
    else:
        module_dir = target.built / f'{target.module}.swiftmodule'
    return module_dir, target.derived / f'{target.module}-Swift.h', target.objdir / f'{target.module}.swift.o'


def swift_args(target):
    s = target.s
    module_dir, header, obj = swift_outputs(target)
    module_dir.mkdir(parents=True, exist_ok=True)
    args = [str(SWIFTC), '-module-name', target.module, '-target', f'arm64-apple-ios{DT}', '-sdk', str(SDK),
            '-resource-dir', str(RES), '-swift-version', s.get('SWIFT_VERSION').split('.')[0], '-O', '-wmo',
            '-parse-as-library', '-suppress-warnings', '-no-color-diagnostics', '-c', '-o', str(obj),
            '-emit-module', '-emit-module-path', str(module_dir / 'arm64-apple-ios.swiftmodule'),
            '-emit-objc-header', '-emit-objc-header-path', str(header),
            '-module-cache-path', str(CACHE),
            '-Xfrontend', '-enable-cross-import-overlays',
            '-F', str(target.built), '-I', str(target.built),
            '-Xcc', f'-I{target.derived}', '-Xcc', '-Wno-error', '-Xcc', '-w']
    for path in search_paths(s.list('FRAMEWORK_SEARCH_PATHS')):
        args += ['-F', path]
    for path in search_paths(s.list('SWIFT_INCLUDE_PATHS')):
        args += ['-I', path]
    for path in search_paths(s.list('HEADER_SEARCH_PATHS')):
        args += ['-Xcc', f'-I{path}']
    for directory in target.own_header_dirs() + [str(path) for path in GLOBAL_IQUOTE]:
        args += ['-Xcc', f'-iquote{directory}']
    for define in s.list('GCC_PREPROCESSOR_DEFINITIONS'):
        args += ['-Xcc', f'-D{define}']
    for define in s.list('SWIFT_ACTIVE_COMPILATION_CONDITIONS'):
        args += ['-D', define]
    swift_flags = clean_flags(s.list('OTHER_SWIFT_FLAGS'))
    for index, flag in enumerate(swift_flags):
        if flag.endswith('expo-modules-macros/apple/ExpoModulesMacros#ExpoModulesMacros'):
            swift_flags[index] = f'{macro_tool()}#ExpoModulesMacros'
    args += swift_flags
    if s.get('SWIFT_OBJC_INTEROP_MODE') == 'objcxx':
        args += ['-cxx-interoperability-mode=default', '-Xcc', f'-I{TOOLS.parent / "include"}',
                 '-Xcc', f'-std={s.get("CLANG_CXX_LANGUAGE_STANDARD")}']
    if target.kind == 'framework' and target.has_public_objc and '-import-underlying-module' not in args:
        args.append('-import-underlying-module')
    if target.s.yes('BUILD_LIBRARY_FOR_DISTRIBUTION'):
        args.append('-enable-library-evolution')
    return args + target.swift_files


def post_swift(target):
    """Publish the generated Swift header, the job of Xcode's post-compile steps."""
    _, header, _ = swift_outputs(target)
    if target.kind == 'framework' and header.exists():
        install_file(header, target.fw / 'Headers' / header.name)
        modulemap = target.fw / 'Modules/module.modulemap'
        if modulemap.exists():
            text = modulemap.read_text()
            marker = f'module {target.module}.Swift'
            if marker not in text:
                modulemap.write_text(text + f'\n\n{marker} {{\n  header "{header.name}"\n  requires objc\n}}\n')
    env = dict(os.environ, PATH=f'{SHIMS}:{os.environ["PATH"]}')
    env.update(target.s.environ())
    for script in target.raw.get('scripts', []):
        if script['name'] == 'Copy generated compatibility header':
            result = subprocess.run(['bash', '-c', script['script']], env=env, capture_output=True, text=True, errors='replace')
            if result.returncode:
                raise RuntimeError(f'{target.name}: compatibility header step failed: {result.stderr}')


def file_stamp(paths):
    digest = hashlib.sha256()
    for path in paths:
        try:
            digest.update(f'{path}:{os.stat(path).st_mtime_ns}\n'.encode())
        except OSError:
            digest.update(f'{path}:missing\n'.encode())
    return digest.hexdigest()


class Builder:
    def __init__(self, targets, jobs):
        self.targets = targets
        self.jobs = jobs
        self.failed = {}
        self.skipped = set()
        self.swift_stamps = {}
        self.errors = []

    def transitive_swift_stamp(self, target):
        digest = hashlib.sha256()
        for dep in sorted(target.deps):
            digest.update(self.swift_stamps.get(dep, '').encode())
        return digest.hexdigest()

    def compile_swift(self, target):
        args = swift_args(target)
        _, header, obj = swift_outputs(target)
        key = hashlib.sha256(json.dumps(args).encode()).hexdigest() + file_stamp(target.swift_files) + self.transitive_swift_stamp(target)
        stamp = INT / target.name / 'swift.stamp'
        self.swift_stamps[target.name] = hashlib.sha256(key.encode()).hexdigest()
        if stamp.exists() and stamp.read_text() == key and obj.exists():
            post_swift(target)
            return True
        env = dict(os.environ)
        env.pop('SDKROOT', None)
        result = subprocess.run(args, env=env, capture_output=True, text=True, errors='replace')
        log_path = LOGS / target.name / 'swift.log'
        log_path.parent.mkdir(parents=True, exist_ok=True)
        log_path.write_text(' '.join(shlex.quote(item) for item in args) + '\n\n' + result.stdout + result.stderr)
        if result.returncode:
            self.record_errors(target, result.stdout + result.stderr, 'swift')
            return False
        stamp.write_text(key)
        post_swift(target)
        return True

    def record_errors(self, target, output, kind):
        lines = [line for line in output.splitlines() if re.search(r'\berror:', line)]
        self.failed.setdefault(target.name, []).append(kind)
        with print_lock:
            self.errors.append((target.name, kind, lines[:40]))

    def swift_phase(self, only):
        pending = {name: t for name, t in self.targets.items() if t.swift_files and (only is None or name in only)}
        done = set()
        running = {}
        ordered_deps = {name: self.swift_closure(self.targets[name]) & set(pending) for name in pending}
        with cf.ThreadPoolExecutor(max_workers=max(2, self.jobs // 2)) as pool:
            while pending or running:
                for name in list(pending):
                    deps = ordered_deps[name]
                    if deps & (set(self.failed) | self.skipped):
                        self.skipped.add(name)
                        pending.pop(name)
                        log(f'  skip {name}: dependency failed')
                        continue
                    if deps <= done and len(running) < max(2, self.jobs // 2):
                        log(f'  swift {name} ({len(self.targets[name].swift_files)} files)')
                        running[pool.submit(self.compile_swift, pending.pop(name))] = name
                if not running:
                    continue
                finished, _ = cf.wait(running, return_when=cf.FIRST_COMPLETED)
                for future in finished:
                    name = running.pop(future)
                    try:
                        ok = future.result()
                    except Exception as error:
                        self.failed.setdefault(name, []).append('swift-post')
                        self.errors.append((name, 'swift-post', [str(error)]))
                        ok = False
                    if ok:
                        done.add(name)

    def swift_closure(self, target):
        seen = set()
        stack = list(target.deps)
        while stack:
            name = stack.pop()
            if name in seen or name not in self.targets:
                continue
            seen.add(name)
            stack.extend(self.targets[name].deps)
        return seen

    def c_args(self, target, item):
        s = target.s
        src = Path(item['path'])
        lang = LANG[src.suffix.lower()]
        cxx = lang in ('c++', 'objective-c++')
        objc = lang.startswith('objective')
        args = [str(CLANGXX if cxx else CLANG), '-x', lang, '-target', f'arm64-apple-ios{DT}', '-isysroot', str(SDK),
                '-fno-color-diagnostics', '-fmessage-length=0', '-w', f'-O{s.get("GCC_OPTIMIZATION_LEVEL")}', '-g0']
        if cxx:
            args += [f'-std={s.get("CLANG_CXX_LANGUAGE_STANDARD")}', f'-stdlib={s.get("CLANG_CXX_LIBRARY")}',
                     '-nostdinc++', '-isystem', str(SDK / 'usr/include/c++/v1')]
        elif lang != 'assembler-with-cpp':
            args += [f'-std={s.get("GCC_C_LANGUAGE_STANDARD")}']
        if objc:
            if s.yes('CLANG_ENABLE_OBJC_ARC'):
                args.append('-fobjc-arc')
            if s.yes('CLANG_ENABLE_OBJC_WEAK'):
                args.append('-fobjc-weak')
            if s.yes('CLANG_ENABLE_MODULES'):
                args += ['-fmodules', f'-fmodules-cache-path={CACHE}', '-fmodules-validate-once-per-build-session',
                         f'-fbuild-session-file={ROOT / ".session"}']
                if cxx:
                    args.append('-fno-cxx-modules')
        for define in s.list('GCC_PREPROCESSOR_DEFINITIONS'):
            args.append(f'-D{define}')
        args += [f'-I{target.derived}', f'-I{target.built / "include"}', f'-F{target.built}', f'-I{target.built}']
        for directory in target.own_header_dirs() + [str(path) for path in GLOBAL_IQUOTE]:
            args.append(f'-iquote{directory}')
        for path in search_paths(s.list('USER_HEADER_SEARCH_PATHS')):
            args.append(f'-iquote{path}')
        for path in search_paths(s.list('HEADER_SEARCH_PATHS')):
            args.append(f'-I{path}')
        for path in search_paths(s.list('FRAMEWORK_SEARCH_PATHS')):
            args.append(f'-F{path}')
        if s.yes('GCC_SYMBOLS_PRIVATE_EXTERN'):
            args.append('-fvisibility=hidden')
        flags = clean_flags(s.list('OTHER_CPLUSPLUSFLAGS' if cxx else 'OTHER_CFLAGS'))
        if lang == 'c++':
            flags = [flag for flag in flags if not flag.startswith('-fmodule-map-file=')]
        args += flags
        prefix = s.get('GCC_PREFIX_HEADER')
        if prefix:
            path = Path(prefix)
            args += ['-include', str(path if path.is_absolute() else PODS / prefix)]
        if item['settings'].get('COMPILER_FLAGS'):
            args += clean_flags(shlex.split(target.s.expand(item['settings']['COMPILER_FLAGS'], len(s.layers), 'COMPILER_FLAGS')))
        return args

    def overlay_item(self, target, item):
        patches = OVERLAYS.get((target.name, Path(item['path']).name))
        if not patches:
            return item, []
        original = Path(item['path'])
        text = original.read_text()
        for old, new in patches:
            if old not in text:
                raise RuntimeError(f'overlay no longer applies to {original}')
            text = text.replace(old, new, 1)
        path = INT / target.name / 'overlay' / original.name
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists() or path.read_text() != text:
            path.write_text(text)
        return dict(item, path=str(path)), [f'-iquote{original.parent}']

    def compile_c(self, target, item):
        item, extra = self.overlay_item(target, item)
        args = self.c_args(target, item) + extra
        src = item['path']
        name = hashlib.sha256(src.encode()).hexdigest()[:12] + '-' + Path(src).stem
        obj = target.objdir / (name + '.o')
        dep = obj.with_suffix('.d')
        args = args + ['-MD', '-MF', str(dep), '-c', src, '-o', str(obj)]
        key = hashlib.sha256(json.dumps(args).encode()).hexdigest()
        stamp = obj.with_suffix('.stamp')
        if obj.exists() and stamp.exists() and stamp.read_text() == key and dep.exists():
            try:
                text = dep.read_text().replace('\\\n', ' ')
                paths = shlex.split(text.split(':', 1)[1])
                limit = obj.stat().st_mtime
                if all(os.path.exists(p) and os.stat(p).st_mtime <= limit for p in paths):
                    return obj
            except Exception:
                pass
        env = dict(os.environ)
        env.pop('SDKROOT', None)
        result = subprocess.run(args, env=env, capture_output=True, text=True, errors='replace')
        if result.returncode:
            log_path = LOGS / target.name / (name + '.log')
            log_path.parent.mkdir(parents=True, exist_ok=True)
            log_path.write_text(' '.join(shlex.quote(a) for a in args) + '\n\n' + result.stdout + result.stderr)
            self.record_errors(target, result.stdout + result.stderr, Path(src).name)
            return None
        stamp.write_text(key)
        return obj

    def c_phase(self, only):
        tasks = []
        for name, target in self.targets.items():
            if (only is None or name in only) and name not in self.skipped and target.c_files:
                tasks += [(target, item) for item in target.c_files]
        log(f'  compiling {len(tasks)} C-family files')
        objects = {}
        count = 0
        with cf.ThreadPoolExecutor(max_workers=self.jobs) as pool:
            futures = {pool.submit(self.compile_c, target, item): target.name for target, item in tasks}
            for future in cf.as_completed(futures):
                count += 1
                if count % 200 == 0:
                    log(f'    {count}/{len(tasks)}')
                result = future.result()
                if result is not None:
                    objects.setdefault(futures[future], []).append(result)
        return objects

    def archive_phase(self, objects, only):
        for name, target in self.targets.items():
            if (only is not None and name not in only) or name in self.failed or name in self.skipped:
                continue
            if target.kind not in ('framework', 'static') or not target.sources:
                continue
            objs = list(objects.get(name, []))
            if target.swift_files:
                objs.append(swift_outputs(target)[2])
            if not objs:
                continue
            archive = target.archive
            archive.parent.mkdir(parents=True, exist_ok=True)
            if archive.exists():
                archive.unlink()
            subprocess.run([str(LLVM_AR), '--format=darwin', 'rcs', str(archive)] + [str(obj) for obj in sorted(objs)], check=True)


def copy_bundles(targets):
    for target in targets.values():
        if target.kind != 'bundle':
            continue
        out = target.built / f'{target.product}.bundle'
        out.mkdir(parents=True, exist_ok=True)
        for item in target.raw.get('resources', []):
            if item.get('path') and Path(item['path']).exists():
                copy_tree_entry(item['path'], out / item['name'])
        info = target.s.get('INFOPLIST_FILE')
        if info:
            path = Path(info) if Path(info).is_absolute() else PODS / info
            if path.exists():
                text = path.read_text(errors='replace')
                bundle_id = f'org.cocoapods.{re.sub(r"[^A-Za-z0-9.-]", "-", target.product)}'
                text = text.replace('${PRODUCT_BUNDLE_IDENTIFIER}', bundle_id).replace('${PRODUCT_NAME}', target.product)
                text = text.replace('${EXECUTABLE_NAME}', target.product).replace('${PODS_DEVELOPMENT_LANGUAGE}', 'en')
                (out / 'Info.plist').write_text(text)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--only', help='comma separated targets')
    parser.add_argument('-j', '--jobs', type=int, default=os.cpu_count())
    parser.add_argument('--skip-jsi', action='store_true')
    parser.add_argument('--skip-prebuilts', action='store_true')
    parser.add_argument('--clean-logs', action='store_true', default=True)
    options = parser.parse_args()
    data = json.loads((ROOT / 'manifest.json').read_text())
    targets = {raw['name']: Target(raw, data['project_settings']) for raw in data['targets']}
    only = None
    if options.only:
        only = set(options.only.split(','))
    if LOGS.exists() and only is None:
        shutil.rmtree(LOGS)
    LOGS.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    (ROOT / '.session').touch()
    if not options.skip_prebuilts:
        log('== prebuilt frameworks')
        prepare_prebuilts(targets)
    if not options.skip_jsi:
        log('== ExpoModulesJSI')
        build_jsi()
    log('== target layout')
    # Stands in for Xcode's all-non-framework-target-headers header map.
    if ALL_HEADERS.exists():
        shutil.rmtree(ALL_HEADERS)
    ALL_HEADERS.mkdir(parents=True)
    for target in targets.values():
        if target.kind == 'static':
            for item in target.raw.get('headers', []):
                link = ALL_HEADERS / item['name']
                if item.get('path') and not link.exists() and not link.is_symlink():
                    link.symlink_to(item['path'])
    for target in targets.values():
        if target.kind in ('framework', 'static'):
            setup_target(target)
    copy_bundles(targets)
    builder = Builder(targets, options.jobs)
    log('== Swift')
    builder.swift_phase(only)
    log('== C family')
    objects = builder.c_phase(only)
    log('== archive')
    builder.archive_phase(objects, only)
    summary = ROOT / 'last-errors.txt'
    with summary.open('w') as out:
        for name, kind, lines in builder.errors:
            out.write(f'### {name} [{kind}]\n')
            out.write('\n'.join(lines) + '\n')
    log(f'\nfailed targets: {len(builder.failed)}  skipped: {len(builder.skipped)}')
    for name, kinds in sorted(builder.failed.items()):
        log(f'  {name}: {len(kinds)} failing unit(s): {", ".join(kinds[:4])}')
    if builder.skipped:
        log('  skipped: ' + ', '.join(sorted(builder.skipped)))
    return 1 if builder.failed else 0


if __name__ == '__main__':
    sys.exit(main())
