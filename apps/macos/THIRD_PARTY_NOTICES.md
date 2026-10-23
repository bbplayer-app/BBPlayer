# Third-party notices

- GRDB.swift 7.11.1 — MIT, fetched by Swift Package Manager; pinned revision in `Package.resolved`. Source: https://github.com/groue/GRDB.swift.
- SVGAPlayer-Web 2.3.1 — Apache-2.0. Source: https://github.com/svga/SVGAPlayer-Web. Upstream `svga.min.js` SHA-256: `3e8cb9a59e17a9b0861298eacc4beba79895ebd7178d97669687af07212509b6`.
- JSZip 3.10.1 — MIT or GPLv3, used under MIT. Vendored SHA-256: `acc7e41455a80765b5fd9c7ee1b8078a6d160bbbca455aeae854de65c947d59e`.
- JSZipUtils 0.1.0 — MIT or GPLv3, used under MIT. Vendored SHA-256: `e4686a0e93c1d5ba5196e0748664bb10990c1fe115caa50fd340af14492c4d5c`.

Full renderer licenses are bundled beside the scripts in `Resources/Renderer`. The renderer runs from local resources, has no credential bridge, has no native command bridge, uses an ephemeral WebKit store, and can read only its allowlisted bundled files and the specific selected animation. It does not load scripts from a CDN at runtime. Embedded animation audio is disabled (Howler is not included).

SVGAPlayer-Web is archived. Compatibility is verified against samples, not guaranteed for every historical or future SVGA file. Failed renderers show an error without changing audio playback.

The vendored SVGA file has one local patch (`scripts/patch-svga.py`): replace runtime-generated protobuf decoding with `static-svga.js`, a bounded schema-based decoder. CSP does not allow unsafe-eval. Patched file SHA-256: `5d101032b783fbe72e15633aef9de52f3ca4a6985363f373e65f727331d6fda7`. The fixed upstream schema is reproduced under Apache-2.0.
