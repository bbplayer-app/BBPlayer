# macOS implementation checkpoint

User approved the complete native macOS plan on 2026-10-22 after 36 answered decisions. No decisions were parked. This file is the implementation recovery record; it must not claim unverified capabilities or performance results.

## Locked scope

- Personal Apple Silicon Mac; SwiftUI/AppKit UI, AVPlayer audio, SQLite/GRDB, local Keychain credentials.
- Search, local playlists, Bilibili favorites/collections/multipart videos; read-only following and watch-later.
- NetEase and QQ playlist import, resumable matching, result review and replacement before saving.
- Music and long-form playback, queue/repeat/shuffle/sleep timer/rate/chapters/per-track resume; highest ordinary AAC; metadata loudness normalization.
- SPL/LRC word lyrics, translation/romanization/offset/manual matching; native locked click-through floating lyrics.
- Full theme installation, static images/video/SVGA preview; spectrum/fluid background enabled by default, invisible consumers suspended. Like actions disabled, SVGA like animation available only in preview.
- Offline downloads and retry/resume; separate 1 GiB adjustable streaming LRU; pinned downloads must never be evicted by cache cleanup.
- History, recent tracks, ranking and heatmap; actual audible elapsed time rather than finished-track duration.
- QR/Cookie login. No telemetry, account credentials in logs, or private data in review prompts.
- Closing main window keeps audio/lyrics alive; menu bar restores it; explicit quit stops audio. Restore queue/rate/position without autoplay by default. Splash must not block input.

## Deferred, not silently part of v1

Local audio import (disabled entry and source interface only), other-project integration, phone backup import, continuous synchronization, Bilibili writes/likes/coins, comments, SMS login, audio export, BBPlayer account/shared playlists, automatic updater, public distribution, Intel/older-OS validation. Later sync includes playlists/history/preferences/playback handoff.

## Follow-up discussion (2026-10-23; no implementation authorized)

- Danmaku feasibility only: user initially referred to the mobile song-detail layout and later clarified that the native combined player may use an overlay crossing controls and lyrics (see next-iteration decisions below). Scrolling comments have adjustable font size, density and display region. Native rendering synchronized to the source video's playback position is a candidate, not an approved implementation plan. Live API availability, density limits and foreground resource cost remain unverified. No application code changed for this discussion.
- Instrumental / pure-music recognition: explicitly deferred until integration with the user's other project, which the user says already has this capability. This project currently lacks it. Do not implement it now or inspect/integrate the other project as part of this request. At that later integration, confirm the existing capability and reuse boundary before proceeding.

### Next-iteration requirements collection (discussion only)

- Q1 answered: danmaku is a noninteractive visual overlay and may cross controls, buttons and lyrics. Pointer input must reach underlying controls; the overlay itself is not clickable. Settings remain reachable through a danmaku button or a separate settings location. Font size, density and coverage are adjustable. No reserved strip or cover shrink is required.
- User delegated the initial 2–3 coverage presets: choose full-width upper one-third, upper half and full combined-player content area. These describe the artwork/controls/lyrics page, not the entire desktop or other navigation pages. Recommend upper one-third as the initial default; that default and detailed numeric settings are still proposals. User will give later feedback on the presets.
- Q2 answered: desktop floating lyrics preserve the complete current lyric text without a character-count cutoff or ellipsis, including enabled translation and romanization. Wrap text, grow the panel within available screen bounds, then scroll for extreme overflow; preserve readable type and manual access when unlocked. Source inspection found a two-line limit on the original text, one-line limits on translation/romanization and a 760x135 initial panel, all relevant to the later fix. This is not a request to show the entire song's lyrics simultaneously. Scrolling when word timestamps are unavailable still needs design before implementation.
- Sidebar navigation: user reports that the left page buttons feel too small and out of proportion with the visual design. Enlarge typography, icons, selection backgrounds and whole-row hit areas together while retaining the existing rounded Material style. Source currently uses a 200-point sidebar, 13-point labels, 17-point system icons / 25-point theme icon frames and 10-point vertical row padding. Candidate next-iteration dimensions: 15–16-point labels, 20–22-point visible icons, 48–52-point row height and 220–240-point sidebar width where space permits. These are recommendations, not confirmed final values. Check narrow-window content space, theme-icon visual sizing and scroll access to all navigation items; no application code changes now.
- Proposed checks for the later implementation: long Chinese and unbroken Latin text, enabled translations/romanization, narrow windows and screen changes must not discard text or strand the floating panel offscreen; danmaku must not intercept playback controls or continue drawing when its page is hidden. Performance and source-time synchronization require actual tests, not assumptions.
- New planning scope checkpoint: `.grilling/macos-next-iteration-20261023.json`; original approved v1 decisions remain intact. No application code changes or implementation authorization in this discussion.

## Acceptance targets (unmeasured until evidence is recorded)

Release on user's M2: median process-cold interactive startup <=2 s over three launches; main window hidden, lyrics off, no download jobs, five-minute steady playback CPU mean <=3% (one core=100%), app plus attributable WebKit memory <=250 MB; arm64 .app <=100 MB excluding user data. Separately measure foreground visuals and floating lyrics. Dataset: 10,000 tracks, 100 playlists, 100,000 history events.

## Execution status

- Branch: codex/macos-native-player.
- Initial repository clean; Xcode 27 installed; xcodegen unavailable.
- Pre-implementation independent review requested through the zero-cost DeepSeek wrapper; no private data sent.
- Current phase: native first version implemented and local Release packaged. Automated checks and measured baselines are recorded below; authenticated and long-duration manual acceptance remains open.

## Gate and evidence

Verified: public AAC streaming and byte-range seek, real PCM spectrum, loudness math, native floating panel, real theme images/video/SVGA. True expired-token recovery and authenticated media still need dedicated acceptance. See VALIDATION.md; do not claim all gates or all fault cases passed.


## Evidence recorded during implementation (2026-10-22)

- Added native Swift package, explicit Xcode project, SwiftUI/AppKit app, core audio/network/storage/lyrics/theme/import/download services, and local packaging script. No phone/backend source changed.
- SwiftPM Release .app builds; Xcode Debug app build succeeded. Current app approximately 9.5 MiB, arm64 only, ad-hoc local signing.
- 27 Swift tests passed: core identity/WBI/lyrics/history/cache, SPL parity, actual PCM spectrum, preview restoration, paused restart, three-failure stop, local HTTP Range pause/resume/deletion, auth/QR fixtures, and scale dataset.
- Dataset 10,000 tracks / 100 playlists / 100,000 history; combined search/page/summary queries around 0.12 seconds (one later run under concurrent builds 0.29 seconds). This does not itself verify scrolling 10,000 visible rows.
- Public BVID BV1Zu411x7mc resolved to ordinary AAC, HTTP Range worked, playback advanced, seek to 45 seconds worked, audio tap captured >1 million real PCM frames. Actual app UI showed waveform and lyrics.
- Current network returns 412 for /x/web-interface/view. WBI view endpoint works; client falls back there and then to pagelist. Public QR generation returned 200. End-to-end authenticated login still requires the human's phone confirmation.
- NetEase search/lyrics and public playlist (200 songs) worked. Bilibili theme search returned 10 results; one real pack downloaded 42 assets including static images, video, SVGA, avatar and loading images.
- Official SVGA 1.x samples rendered. Real Bilibili SVGA 2.1 initially failed because upstream protobuf decoding uses runtime code generation. An unsafe-eval proposal was rejected and was NOT applied. A bounded, schema-based static decoder replaced only that decode call; CSP remains unchanged. Native canvas retest passed: official 1.x, official sample, real Bilibili 2.1 all produced nontransparent pixels without unsafe-eval.
- Historical provisional measurement (actual window visibility was not recorded, excluded from final acceptance): startup median 0.312 s; RSS mean 130 MiB, peak 139.4 MiB; CPU 3.10% over 319 s, so no CPU pass is claimed. Raw record in validation/hidden-before-tap-suspension.json. Removed the PCM audio mix tap when no visualizer is visible; true spectrum test still passes. Final performance retest pending.
- Found and fixed initialization cancellation when replacing the loading view, zero-duration history creation on paused restarts, download-state null decoding, preview lyric restoration, per-track offline metadata, literal plus signing, and long active cache budget growth.
- Root pnpm type-check/lint were attempted. JS dependencies are absent; pnpm attempted full-workspace installation and registry access instead of running checks. These checks were stopped; no pnpm result is claimed. Generated .pnpm-store removed. Native builds/tests do not require the mobile dependency tree.
- Pre-review through the configured DeepSeek wrapper completed with zero cost. User authorized sending only the new playback/download/loader snippets for a post-review after initial disclosure rejection; both post-review attempts timed out, so no independent post-review conclusion is claimed. Continued with local reproduction and tests.

## Remaining verification before final delivery

Completed static SVGA canvas and real 1080x1618 video decode; pending: foreground/floating-lyrics/hidden Release measurements; actual floating panel after hosting-controller fix; final Xcode build; acceptance record and packaging provenance. Authenticated favorites/collections/following/watch-later, real login expiration/logout, physical media keys, multi-display/fullscreen restoration, disk exhaustion and long-duration memory behavior remain explicit manual acceptance items until exercised. Do not mark them passed from code inspection alone.

## Final stabilization checkpoint (19:05 local)

27 Swift tests passed after adding: loading-toggle pause intent, natural end/restart, single-track repeat without re-resolving network media, both chapter metadata shapes, and audible-clock reset on buffering. Explicit ProcessInfo playback activity prevents App Nap while allowing normal system idle sleep. Playback diagnostics contain only state/rate/reason, no URLs or credentials. Performance failures are not passes; the benchmark now retains state samples and failed records for diagnosis. Final Release + three sequential benchmarks currently running (hidden 300 s, foreground 60 s, floating lyrics 60 s). Foreground/floating cases seed the repository’s real BVID-matched SPL fixture and use the downloaded 42-asset theme. Do not open or activate BBPlayer while hidden measurement runs. On completion update VALIDATION numbers, artifact SHA, archive; perform final Xcode build and Git scope check. No commits or PRs yet.

## Delivery state

All 27 Swift tests and the static decoder assertions passed. Release startup median 0.301 s; hidden playback CPU mean 1.47%, RSS mean 132.9 MiB / peak 136.7 MiB over 320.4 s, zero nonplaying samples. Real themed foreground: 17.28% / 185.5 MiB over 64.2 s. Floating lyrics: 4.54% / 159.5 MiB over 64.3 s. The last app change affected only QA foreground presentation; each measurement retains its actual build SHA. Normal application/core behavior did not change between those builds. Final app and archive hashes are in validation/artifact.json. Credentials/authenticated acceptance, physical media keys, multi-display/fullscreen, disk-full/crash/expiry faults, long-run resource growth remain unverified and are clearly listed in VALIDATION.md. No source outside apps/macos changed; branch codex/macos-native-player, no commit or PR created.

Final public AAC offline probe also passed: 3,397,406 bytes downloaded, >1 second local playback, 65,536 PCM frames, zero calls to the provider configured to reject all network resolution. Final Xcode independent build succeeded after the QA foreground-only update. Application SHA 84c96b3310c3b4780347371d43aabcce97cfbe4888c2523e7e7b1e2fca36ed6c. All generated .app/zip/build caches are ignored; source and compact verification records are confined to apps/macos.

## Repository migration (2026-10-23)

Migration and future development use this repository checkout and its configured `origin`. Native source, tests, resources, compact validation records, Release archive and local interview checkpoint were copied from the sibling `BBPlayer` checkout; original files remain as backup. Dependency/build output caches are not source deliverables. Local `.grilling/` is ignored by Git and its workspace identity now points to this checkout. Application source is unchanged by migration; danmaku, floating-lyrics overflow and sidebar sizing remain next-iteration planning items. Earlier validation numbers remain historical evidence, not new measurements on the fork. Migration verification is recorded in `validation/migration.json`.

## Follow-up iteration implemented (2026-10-23)

The user subsequently authorized retiring the original checkout and continuing the collected work in the fork. This supersedes the discussion-only status of the earlier collection section. The original checkout is now in macOS Trash, not at its former path. Migration baseline commit `a942a684` was pushed to the fork before retirement. All future work uses this checkout.

- Added read-only Bilibili segmented protobuf danmaku with bounded decoding, lane/density scheduling, source-media-clock motion, click-through rendering and cancellation when hidden or switched off. Coverage presets: upper third / upper half / full player. Font size, density, opacity and region persist in local UserDefaults. Initial toggle is off; no comment sending or advanced script rendering. Segments are bounded and retained only around the current position. Network failures leave audio running and provide an inline retry hint.
- Replaced the floating lyric line caps with TextKit wrapping and complete original/translation/romanization storage. Content determines panel height within the current screen; overlong lines scroll to the timed word or an estimated position within the line. Unlocked manual scroll is preserved. Screen changes constrain the whole panel to a visible screen.
- Sidebar: 224-point width, 15-point labels, 21-point default icons / 28-point theme frames and 50-point rows with full-row hit targets. Existing navigation overflow remains scrollable.
- 31 core tests plus 2 AppKit layout tests passed, including malformed danmaku, collision/density scheduling, long CJK/Latin/Emoji text and preservation of unlocked scrolling. Public CID 1137390809 returned 98 ordinary scrolling comments. Static SVGA decoder retained 10 passing assertions. SwiftPM Release and independent Xcode Debug builds passed; strict signing verification passed. An isolated muted real-playback window visibly rendered danmaku and the enlarged sidebar. Evidence: `validation/iteration-20261023.json`.
- The earlier CPU/memory/startup measurements describe v1, not new measurements of this iteration. Dense-danmaku performance, comprehensive UI seek/rate/click-through, physical media keys, accounts and multi-display acceptance remain manual items. No independent DeepSeek post-review is claimed. Instrumental recognition remains deferred until the separate future project integration.

## Repository boundary (2026-10-23; authoritative current rule)

Use this checkout and its sole configured remote, `origin`. The remote previously named `upstream` has been removed. GitHub fork provenance from `bbplayer-app/BBPlayer` remains solely for attribution. No fetch, push, pull request, merge, comment, review request or other interaction with `bbplayer-app/BBPlayer` is authorized. This supersedes earlier workflow wording about synchronization or publication to that repository. Pull requests, merges, publication, deployment and additional external review require separate explicit authorization. Verify the target owner and repository from local Git configuration before an authorized operation.

## Local library improvements (2026-10-23)

Current backlog is `TODO.md`. Subsequent authorized work added deletion confirmation and persistent latest-deletion undo, deduplicated/batch queue append and native queue sorting, full local-playlist playback/filtering across pages, loaded-row multi-selection and batch downloads/playlist addition, date-specific listening sessions, resizable sidebar and available stream specification display. Automatic backups, stalled-playback recovery, mini player and source replacement remain pending; explicitly deferred features remain deferred.

Latest verification: 43 core + 3 AppKit tests, isolated model workflows and four visually inspected native renders; local Release app packaging and strict signature verification passed. Evidence is in `VALIDATION.md` and `validation/library-workflows-20261023.json`. Pointer interaction, new performance measurements and authenticated acceptance remain open. Work is uncommitted on `feature/library-workflow-improvements`; no merge, push or installed-app replacement occurred.


## Playback startup, prefetch and rolling cache (2026-10-26)

Implemented the approved native playback scope on the current feature branch. Highest ordinary AAC selection is unchanged. Chapters are fetched independently with playback-generation checks; track inspection and spectrum setup no longer block initial item creation. The custom loader delivers 16 KiB network increments while persisting complete 256 KiB cache blocks asynchronously. AVPlayer prediction waiting is disabled; buffer recovery retains playback intent and waits for approximately two seconds of playable media after an underrun. Pausing, switching, preview changes and shutdown cancel obsolete work.

The public long-track fixture exposed an additional container issue: AVFoundation scanned large portions of a fragmented MP4 before becoming ready, even with early data delivery. On macOS 27, a bounded flat-sidx reader exposes the existing initialization and fragment byte ranges through a private loopback HLS view. AAC payloads and the persistent chunk format are unchanged. The listener uses a random per-load path, accepts at most six connections, limits request headers, sends no-store responses and closes with its loader. Remote addresses and credentials never appear in the playlist. Earlier macOS versions and unsupported/unindexed containers retain the compatible custom file loader. This preserves their existing audio-tap functionality, but does not establish fast startup for those cases. The new track-mix tap follows output mute; nonzero spectrum is verified with a brief quiet generated tone.

Current and prefetched playback share the same sequential/shuffle/list-loop next-selection logic. After two seconds of stable playback, one background attempt prepares the actual next track and fetches at most 1 MiB including head/tail ranges. Foreground misses and buffering cancel that work. Single-track repeat, preview and disabled caching suppress it. Queue/mode changes invalidate the source and pending generation; failed optional preparation neither retries repeatedly nor creates history. Resolved sources stay in memory, use the URL deadline minus a safety margin, and otherwise expire after two minutes. The new preference defaults on when absent in old JSON and is visibly disabled when cache retention is off.

The default managed temporary-cache budget remains 1 GiB. A utility writer maintains a size/LRU index and reserves actual encoded bytes before atomic writes, including temporary replacement space. Reads protect individual chunks; old consumed chunks may be evicted from the same long resource. Slow disk operations do not hold the playback-admission lock. Pending payload writes are bounded to 8 MiB and discarded when full; disk failures do not prevent delivery. At most four foreground chunk transfers and four recent completed chunks are retained per active loader. Manual downloads remain separate and preserve asynchronously acquired chapters in offline metadata.

Verification: 68 core and 10 AppKit tests passed; Release packaging and persistent-signature verification passed. Controlled aggregate 2 Mb/s / 100 ms RTT tests passed five ordinary cold starts, five unprefetched switches, five indexed cold starts and five prefetched switches, all below two seconds. Complete phases, retained real-network failures and limits are in `validation/startup-streaming-20261026.json` and `VALIDATION.md`. Large offsets/lengths are simulated rather than claimed as a real multi-GiB transfer. At the 2026-10-26 verification checkpoint, no commit, push, merge, installation or external review had been performed. The Release was subsequently installed locally on 2026-10-27 after explicit authorization, with persistent-signature and complete-file verification followed by duplicate cleanup. Existing mobile edits remain unmodified, unvalidated and excluded from this Mac delivery. Any subsequent push requires a rebuild and verified local replacement from the pushed source.
