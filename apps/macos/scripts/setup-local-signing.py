#!/usr/bin/env python3
"""Create an explicitly authorized, machine-local code-signing identity once."""
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import tempfile
import uuid


def run(*args):
    result = subprocess.run(args, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or "Signing setup command failed")
    return result.stdout.strip()


def main():
    config = Path.home() / "Library/Application Support/com.bbplayer.macos-development/signing.json"
    if config.exists():
        identity = json.loads(config.read_text())["identity_sha1"]
        if not re.fullmatch(r"[0-9A-F]{40}", identity):
            raise RuntimeError("Invalid saved signing identity; no replacement created")
        if identity not in run("security", "find-identity", "-p", "codesigning"):
            raise RuntimeError("Saved identity is unavailable; no replacement created")
        print("Existing local signing identity retained.")
        return
    keychain = run("security", "default-keychain", "-d", "user").strip('"')
    os.umask(0o077)
    with tempfile.TemporaryDirectory(prefix="bbplayer-signing-") as temporary:
        root = Path(temporary)
        certificate = root / "certificate.pem"
        key = root / "private-key.pem"
        settings = root / "openssl.cnf"
        settings.write_text("""[req]
distinguished_name=subject
prompt=no
x509_extensions=signing
[subject]
CN=BBPlayer Local Development %s
[signing]
basicConstraints=critical,CA:false
keyUsage=critical,digitalSignature
extendedKeyUsage=critical,codeSigning
subjectKeyIdentifier=hash
""" % uuid.uuid4().hex[:8])
        run("openssl", "req", "-new", "-x509", "-newkey", "rsa:3072", "-nodes", "-days", "3650", "-config", str(settings), "-keyout", str(key), "-out", str(certificate))
        fingerprint = run("openssl", "x509", "-in", str(certificate), "-noout", "-fingerprint", "-sha1").split("=", 1)[1].replace(":", "").upper()
        # Never use -A (unrestricted key access), alter trust settings, or export the key.
        identity_file = root / "identity.p12"
        container_password = secrets.token_urlsafe(24)
        run("openssl", "pkcs12", "-export", "-inkey", str(key), "-in", str(certificate), "-out", str(identity_file), "-passout", "pass:" + container_password, "-keypbe", "PBE-SHA1-3DES", "-certpbe", "PBE-SHA1-3DES", "-macalg", "sha1")
        # The import container is private, temporary, and removed with the raw key.
        run("security", "import", str(identity_file), "-k", keychain, "-f", "pkcs12", "-P", container_password, "-x", "-T", "/usr/bin/codesign")
        if fingerprint not in run("security", "find-identity", "-p", "codesigning"):
            raise RuntimeError("Imported identity could not be located; configuration was not saved")
        config.parent.mkdir(parents=True, exist_ok=True)
        staged = config.with_suffix(".tmp")
        staged.write_text(json.dumps({"identity_sha1": fingerprint}, indent=2) + "\n")
        staged.chmod(0o600)
        staged.replace(config)
    print("Local code-signing identity saved. No global certificate trust was changed.")


if __name__ == "__main__":
    main()
