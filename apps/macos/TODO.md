# macOS backlog

Updated: 2026-10-23. Recording a task does not authorize implementation. Candidate priorities are recommendations; unchecked acceptance items have not passed. Use this list together with `IMPLEMENTATION.md` and `VALIDATION.md`; historical discussion entries do not override later implementation evidence.

## Candidate improvements (recommended order)

- [ ] 1. Backup and deletion protection: playlist deletion confirmation, undo, local automatic snapshots, manual export/restore, and a preserved pre-restore copy. Exclude credentials from backups.
  - [x] Deletion confirmation implemented with the playlist name and explicit cancel/delete actions. Runtime dialog interaction remains to be checked.
  - [x] Undo the most recent local playlist deletion, including its full ordered membership and metadata. The recovery record survives restart, is replaced by the next successful deletion, and is cleared after successful restore. Deletion/restore failures roll back; conflicting existing playlists are never overwritten. Core regressions pass; banner interaction remains to be checked. Automatic snapshots and manual backup export/restore remain pending.
- [ ] 2. Playback recovery: detect stalled progress without an error, bounded retries and network recovery; preserve part, position and rate, and respect manual pause.
  - [x] Buffer exhaustion recovery now retains playback intent, waits for approximately two playable seconds, respects pause/shutdown and cancels obsolete tasks. Synthetic network recovery, rapid switches and indexed preview/position/rate restoration passed. A general watchdog for a frozen media clock without buffer/status events remains open.
- [ ] 3. Queue management: deduplicate appends, move existing entries for play-next, distinguish append/replace, drag sorting, batch enqueue, and explicit whole-playlist behavior across pagination.
  - [x] Deduplicate appends by content identity and move existing play-next entries without reloading current audio. Different video parts remain distinct; selecting the active track for play-next is a no-op. Regression tests pass.
  - [x] Queue drag sorting implemented using native List move handling, with existing arrow buttons retained. Single/block moves preserve the active occurrence, paused/playing state and progress, including legacy duplicate entries. Core regressions pass; actual pointer drag interaction remains to be checked.
  - [x] Batch enqueue preserves input order and skips duplicates. Whole local playlist playback, enqueue and downloads include unloaded pages and respect the local filter. Remote/search list operations are explicitly limited to loaded entries. Pointer-driven batch menu acceptance remains pending.
- [ ] 4. Native mini player: artwork, playback controls, progress, volume and queue; share the existing playback engine and preserve uninterrupted audio during window switching.
- [ ] 5. Source replacement and library organization: replace sources of saved tracks, multi-selection, batch moves/downloads, explain matching scores and distinguish alternate versions.
  - [x] Multi-select loaded tracks for queue append, downloads and transactional batch addition to another local playlist. Local playlist search covers title/artist across all pages. Source replacement, batch move/removal and matching explanations remain pending.
- [x] 6. Interactive history implemented: heatmap/date selection shows paginated individual listening sessions, while recent songs remain deduplicated. Local-day boundaries handle DST; isolated workflow and rendering checks passed. Actual heatmap/date-control pointer interactions remain pending.
- [ ] 7. Lyrics and window customization: font size, spacing, translation proportions, highlight colors and contrast; resizable, persistent sidebar width.
  - [x] Sidebar width can be dragged between 180 and 300 points, persists locally and resets to 224 on double-click; accessibility adjustment is available. Pointer interaction and narrow-window acceptance remain pending. Lyric appearance controls remain pending.
- [ ] 8. Audio format information and selection: display actual stream specifications first; evaluate permissions, decoding and playback before adding Hi-Res/Dolby options.
  - [x] Display codec, bitrate and sample rate when returned for the selected stream, and preserve metadata in new offline downloads. Legacy downloads without these fields still decode. Live-provider display acceptance and advanced format selection remain pending.

Research references (README and selected source inspection only, not runtime verification):

- https://github.com/IblankD/BBPlayerForWin — recovery, backup, undo and queue semantics.
- https://github.com/mikotossd/BBplayerDesktop — backup/restore and interoperability patterns. Its database is not directly compatible with this native schema.
- https://github.com/gubei2736/Bili-Player — mini player, library workflows and interactive history. Advanced audio claims remain unverified here.

## Implemented paths awaiting dedicated acceptance

- [ ] Keychain acceptance: persistent machine-local signing identity has been configured and used for Release packaging. Two changed, identically signed probe binaries successfully shared a disposable credential with authentication UI prohibited; the test item was deleted. The initial LAContext-only fix still prompted for legacy login-keychain ACLs; a follow-up now also scopes legacy interaction suppression. A restricted temporary legacy-keychain test passed, and the replacement installed app was launched with existing local data: the main window showed the explicit unlock action without a startup password prompt. Still verify the real account's authorization retention, quit/relaunch and subsequent updates, plus a fresh machine when available; these are not established by fixture results. The unlock action only retries reading the existing item; no credential migration or ACL update is implemented.
- [ ] 9. Real QR confirmation, expired Cookie and logout flows.
- [ ] 10. Authenticated favorites, collections, following and watch-later workflows.
- [ ] 11. Physical media keys and Control Center controls.
- [ ] 12. Floating lyrics: menu-bar access, unlock/drag/relock, multiple displays and position recovery after fullscreen changes.
  - [x] Explicit native window dragging from unlocked lyric text, independent of background-event propagation, with a visible hint and open-hand cursor. Synthetic AppKit mouse-down regression verifies unlocked dispatch and locked/click-through suppression; long-text scroll regressions still pass. Actual pointer drag and multi-display acceptance remain pending.
- [ ] 13. Danmaku: pause, seek, playback-rate synchronization, pointer pass-through and suspension while hidden.
- [ ] 14. Current-iteration performance: dense danmaku and updated foreground/background/floating-lyric CPU and memory. Historical v1 measurements are not current-iteration evidence.
- [ ] 15. Truly expired CDN URLs, prolonged disconnection and network recovery.
- [ ] 16. Disk exhaustion, abnormal termination and recovery of large download/import batches.
- [ ] 17. Long-distance scrolling and responsiveness with 10,000 actual list entries; SQL benchmarks alone are insufficient.
- [ ] 18. Long-form rate/chapter behavior and audible loudness-normalization quality.
- [ ] 19. Repeated large-theme switching, corrupt resources and long-term WebKit reclamation after SVGA preview closes.
- [ ] 20. Several-hour playback stability and memory growth.
- [ ] 21. Recheck the supplemental Kugou lyric provider's TLS failure without disabling certificate validation.

## Explicitly deferred (separate scope decisions required)

- [ ] 22. Instrumental/pure-music recognition through later other-project integration; verify capability and reuse boundaries at that time.
- [ ] 23. Local audio file import.
- [ ] 24. Phone backup import and data interoperability; native schema conversion is required.
- [ ] 25. Continuous cross-device sync: playlists, history, preferences and playback handoff.
- [ ] 26. Bilibili write operations: likes, coins and favorites modification.
- [ ] 27. Comments.
- [ ] 28. SMS login.
- [ ] 29. Audio file export.
- [ ] 30. BBPlayer accounts and shared-playlist services.
- [ ] 31. Automatic application updates, separate from the existing local update script.
- [ ] 32. Public distribution, signing, notarization and distribution acceptance.
- [ ] 33. Intel and older-macOS compatibility validation.

## Already implemented

Basic read-only danmaku, complete floating-lyric text with overflow handling, and enlarged sidebar navigation were implemented in the follow-up iteration. Do not re-add them as missing features. Their remaining acceptance work is listed above. See `validation/iteration-20261023.json` for recorded checks.
