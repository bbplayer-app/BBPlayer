#!/usr/bin/env python3
"""Remove known obsolete BBPlayer packages only after verifying the installed app."""
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


def cleanup(installed, build_root, extras=(), verify=True):
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
        if app == source or app.is_symlink() or app.is_relative_to(source):
            continue
        if identity(app) == "com.bbplayer.macos":
            candidates.append(app)
    for app in extras:
        temporary = Path(tempfile.gettempdir()).resolve()
        resolved = app.resolve()
        if app.is_symlink() or not resolved.is_relative_to(temporary) or not app.parent.name.startswith("bbplayer-lyric-drag-") or identity(app) != "com.bbplayer.macos.lyric-drag-qa":
            raise RuntimeError("Unexpected diagnostic app path; no diagnostic cleanup performed")
        candidates.append(resolved)
    removed = []
    for app in candidates:
        # Refuse symlinked ancestors rather than following them outside the build root.
        if any(parent.is_symlink() for parent in app.parents):
            raise RuntimeError("Refusing cleanup through a symlink")
        shutil.rmtree(app)
        removed.append(str(app))
    archive = build_root / "BBPlayer-macOS-arm64.zip"
    if archive.is_file() and not archive.is_symlink():
        archive.unlink()
        removed.append(str(archive))
    return removed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--installed", type=Path, default=Path("/Applications/BBPlayer.app"))
    parser.add_argument("--build-root", type=Path, default=Path(__file__).resolve().parents[1] / "build")
    parser.add_argument("--extra-app", type=Path, action="append", default=[])
    args = parser.parse_args()
    diagnostics = [app for folder in Path(tempfile.gettempdir()).glob("bbplayer-lyric-drag-*") if folder.is_dir() and not folder.is_symlink() for app in folder.glob("*.app") if identity(app) == "com.bbplayer.macos.lyric-drag-qa"]
    extras = list(dict.fromkeys(args.extra_app + diagnostics))
    removed = cleanup(args.installed, args.build_root, extras)
    print("Verified latest installed/build packages; removed %d obsolete packages." % len(removed))


if __name__ == "__main__":
    main()
