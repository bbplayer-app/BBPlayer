#!/usr/bin/env python3
import importlib.util
from pathlib import Path
import plistlib
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("cleanup", Path(__file__).with_name("cleanup-local-apps.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class CleanupTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="bbplayer-cleanup-check-")
        self.root = Path(self.directory.name).resolve()
        self.build = self.root / "build"
        self.installed = self.app(self.root / "installed.app", "latest")
        self.app(self.build / "BBPlayer.app", "latest")

    def tearDown(self):
        self.directory.cleanup()

    def app(self, path, version, bundle="com.bbplayer.macos"):
        (path / "Contents").mkdir(parents=True)
        (path / "Contents/Info.plist").write_bytes(plistlib.dumps({"CFBundleIdentifier": bundle}))
        (path / "Contents/version").write_text(version)
        return path

    def testOnlyKnownOldPackagesAreRemoved(self):
        old = self.app(self.build / "local-updates.noindex/backup.fixture/BBPlayer.app", "old")
        unrelated = self.app(self.build / "Other.app", "old", "com.example.other")
        archive = self.build / "BBPlayer-macOS-arm64.zip"; archive.write_bytes(b"old")
        data = self.build / "downloads"; data.mkdir(); (data / "audio.m4a").write_bytes(b"keep")
        removed = module.cleanup(self.installed, self.build, verify=False)
        self.assertEqual(len(removed), 3)
        self.assertFalse(old.exists()); self.assertFalse(archive.exists())
        self.assertTrue(unrelated.exists()); self.assertTrue((data / "audio.m4a").exists())
        self.assertTrue(self.installed.exists()); self.assertFalse((self.build / "BBPlayer.app").exists())

    def testExternalDuplicateAndRunnableBuildAreRemoved(self):
        duplicate = self.app(self.root / "Downloads/BBPlayer.app", "old")
        binary = self.root / ".build/Products/Debug/BBPlayerMac"
        binary.parent.mkdir(parents=True)
        binary.write_bytes(b"executable")
        module.cleanup(self.installed, self.build, verify=False, duplicate_apps=[duplicate])
        self.assertFalse(duplicate.exists())
        self.assertFalse(binary.exists())
        self.assertTrue(self.installed.exists())

    def testMismatchDoesNotDeleteBackup(self):
        old = self.app(self.build / "backup/BBPlayer.app", "old")
        (self.installed / "Contents/version").write_text("unexpected")
        with self.assertRaises(RuntimeError): module.cleanup(self.installed, self.build, verify=False)
        self.assertTrue(old.exists())

    def testUnexpectedInstalledIdentityStopsCleanup(self):
        (self.installed / "Contents/Info.plist").write_bytes(plistlib.dumps({"CFBundleIdentifier": "com.example.other"}))
        with self.assertRaises(RuntimeError): module.cleanup(self.installed, self.build, verify=False)

    def testSymlinkDoesNotDeleteOutsideFiles(self):
        outside = self.app(self.root / "outside.app", "old")
        link = self.build / "linked.app"; link.symlink_to(outside, target_is_directory=True)
        module.cleanup(self.installed, self.build, verify=False)
        self.assertTrue(outside.exists()); self.assertTrue(link.is_symlink())

    def testOnlyNamedTemporaryDiagnosticAppMayBeRemoved(self):
        invalid = self.app(self.root / "Other QA.app", "old", "com.bbplayer.macos.lyric-drag-qa")
        with self.assertRaises(RuntimeError): module.cleanup(self.installed, self.build, [invalid], verify=False)
        self.assertTrue(invalid.exists())
        valid = self.app(self.root / "bbplayer-lyric-drag-fixture/BBPlayer QA.app", "old", "com.bbplayer.macos.lyric-drag-qa")
        module.cleanup(self.installed, self.build, [valid], verify=False)
        self.assertFalse(valid.exists())


if __name__ == "__main__":
    unittest.main()
