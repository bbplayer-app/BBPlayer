#!/usr/bin/env python3
"""Keep only the verified installed BBPlayer app and remove runnable copies."""
import argparse
import hashlib
from pathlib import Path
import plistlib
import shutil
import subprocess
import tempfile


def identity(app):
    try:
        return plistlib.loads((app / "Contents/Info.plist").read_bytes()).get("CFBundleIdentifier")
    except (OSError, plistlib.InvalidFileException):
        return None


def manifest(app):
    return {str(p.relative_to(app)): hashlib.sha256(p.read_bytes()).hexdigest() for p in app.rglob("*") if p.is_file()}


def cleanup(installed, build_root, extras=(), verify=True, duplicate_apps=()):
    if installed.is_symlink() or identity(installed) != "com.bbplayer.macos":
        raise RuntimeError("Installed app identity is missing or unexpected; no cleanup performed")
    if verify:
        subprocess.run(["/usr/bin/codesign", "--verify", "--deep", "--strict", str(installed)], check=True)
    source = build_root / "BBPlayer.app"
    expected = manifest(installed)
    if source.is_symlink() or identity(source) != "com.bbplayer.macos" or manifest(source) != expected:
        raise RuntimeError("Installed app does not match the latest build; no cleanup performed")
    candidates = []
    for app in build_root.rglob("*.app"):
        if app.is_symlink() or app.is_relative_to(source) and app != source:
            continue
        if identity(app) == "com.bbplayer.macos":
            candidates.append(app)
    for app in duplicate_apps:
        if app == installed or app.is_symlink() or identity(app) != "com.bbplayer.macos":
            continue
        candidates.append(app)
    for app in extras:
        temporary = Path(tempfile.gettempdir()).resolve()
        resolved = app.resolve()
        if app.is_symlink() or not resolved.is_relative_to(temporary) or not app.parent.name.startswith("bbplayer-lyric-drag-") or identity(app) != "com.bbplayer.macos.lyric-drag-qa":
            raise RuntimeError("Unexpected diagnostic app path; no diagnostic cleanup performed")
        candidates.append(resolved)
    removed = []
    for app in dict.fromkeys(candidates):
        # Refuse symlinked ancestors rather than following them outside the build root.
        if any(parent.is_symlink() for parent in app.parents):
            raise RuntimeError("Refusing cleanup through a symlink")
        shutil.rmtree(app)
        removed.append(str(app))
    archive = build_root / "BBPlayer-macOS-arm64.zip"
    if archive.is_file() and not archive.is_symlink():
        archive.unlink()
        removed.append(str(archive))
    # SwiftPM executables are runnable copies too; keep its incremental object cache.
    cache = build_root.parent / ".build"
    if cache.is_dir() and not cache.is_symlink():
        for binary in cache.rglob("BBPlayerMac"):
            if binary.is_file() and not binary.is_symlink() and not any(p.is_symlink() for p in binary.parents):
                binary.unlink()
                removed.append(str(binary))
    return removed


def discover_duplicates(installed):
    import os
    home = Path.home()
    roots = [Path("/Applications"), home / "Applications", home / "Desktop",
             home / "Downloads", home / "Documents",
             home / "Library/Developer/Xcode/DerivedData", Path("/private/tmp"),
             Path(tempfile.gettempdir()).resolve()]
    found = set()
    for root in roots:
        for directory, folders, _ in os.walk(root, followlinks=False):
            for name in list(folders):
                app = Path(directory) / name
                if name.endswith(".app"):
                    folders.remove(name)
                    if not app.is_symlink() and app != installed and identity(app) == "com.bbplayer.macos":
                        found.add(app)
                elif name in {"node_modules", ".git"} or name.endswith(".photoslibrary"):
                    folders.remove(name)
    return sorted(found)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--installed", type=Path, default=Path("/Applications/BBPlayer.app"))
    parser.add_argument("--build-root", type=Path, default=Path(__file__).resolve().parents[1] / "build")
    parser.add_argument("--extra-app", type=Path, action="append", default=[])
    args = parser.parse_args()
    diagnostics = [app for folder in Path(tempfile.gettempdir()).glob("bbplayer-lyric-drag-*") if folder.is_dir() and not folder.is_symlink() for app in folder.glob("*.app") if identity(app) == "com.bbplayer.macos.lyric-drag-qa"]
    extras = list(dict.fromkeys(args.extra_app + diagnostics))
    removed = cleanup(args.installed, args.build_root, extras, duplicate_apps=discover_duplicates(args.installed))
    print("Verified installed app; removed %d duplicate packages and compiled executables." % len(removed))


if __name__ == "__main__":
    main()
