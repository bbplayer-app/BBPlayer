# Homepage UI Optimization

## TL;DR

> **Quick Summary**: Optimize homepage by removing quick action buttons, creating a "Recently Played" page, replacing "Recent Playlists" section with a "Quick Access" horizontal snap-scroll section, and adding a "Play All" button to the history/date page.
>
> **Deliverables**:
>
> - Remove 4 quick action buttons from homepage
> - New "最近常听" (Recently Played) page showing weighted play history
> - New "快捷入口" (Quick Access) section with horizontal snap-scroll cards
> - "Play All" button on history/[date] page (offline-aware)
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 4 (Data Layer) → Task 5 (Recently Page) → Task 7 (Homepage Section)

---

## Context

### Original Request

优化主页UI，达到更好的效果：

1. 删除四个操作按钮（本地音乐、稍后再看、我的收藏、最近播放）
2. 创建新页面「最近常听」，按播放时长加权统计最近14天最常听的歌
3. 删除「近期歌单」栏目，改成「快捷入口」，包含三个卡片：那年今日、最近常听、稍后再看（有cookie时显示）
4. 历史记录页加「播放全部」按钮，离线时只播放已缓存歌曲

### Interview Summary

**Key Discussions**:

- **播放统计规则**: 按播放时长加权计算（durationPlayed字段求和）
- **播放全部行为**: 从第一首开始顺序播放
- **离线处理**: 只播放已缓存的歌曲，跳过未缓存的
- **卡片内容**: 3个卡片 - 那年今日、最近常听、稍后再看（条件显示）

**Research Findings**:

- 快捷按钮位于 `index.tsx:408-469` (quickActionsContainer)
- 近期歌单位于 `index.tsx:471-529` (recentPlaylistsSection)
- 历史页结构已分析，Play All 按钮位置确定
- 无现有snap滚动模式，推荐使用 ScrollView + snapToInterval

### Metis Review

**Identified Gaps** (addressed):

- Gap: 需要确认播放统计规则 → **已确认**: 按播放时长加权
- Gap: 需要确认离线处理方式 → **已确认**: 只播放已缓存歌曲
- Gap: 需要确认卡片数量和内容 → **已确认**: 3个卡片，内容确定

---

## Work Objectives

### Core Objective

优化首页用户体验，提供更直接的访问路径和更便捷的播放操作。

### Concrete Deliverables

- `apps/mobile/src/app/(tabs)/index.tsx` - 删除快捷按钮和近期歌单，添加快捷入口
- `apps/mobile/src/app/playlist/recently/index.tsx` - 新建最近常听页面
- `apps/mobile/src/app/history/[date].tsx` - 添加播放全部按钮
- `apps/mobile/src/lib/services/trackService.ts` - 新增查询方法
- `apps/mobile/src/hooks/queries/playHistory.ts` - 新增查询hook

### Definition of Done

- [ ] 主页无快捷按钮和近期歌单
- [ ] 快捷入口显示3个卡片，横向滚动有吸附效果
- [ ] 最近常听页面显示正确数据，按播放时长排序
- [ ] 历史页有播放全部按钮，离线时只播放缓存歌曲

### Must Have

- 按播放时长加权排序（durationPlayed求和）
- 只统计最近14天数据
- 最多显示10首歌曲
- 快捷入口横向滚动有吸附效果
- 播放全部按钮在离线时自动过滤未缓存歌曲

### Must NOT Have (Guardrails from Metis)

- 不得添加超过3个卡片
- 不得添加复杂动画（仅使用基础snap）
- 不得为卡片创建新组件（使用inline RectButton模式）
- 不得添加shuffle功能
- 不得添加分页功能

---

## Verification Strategy (MANDATORY)

### Test Decision

- **Infrastructure exists**: YES (Jest + @testing-library/react-native)
- **Automated tests**: YES (TDD for service/hook, component tests for UI)
- **Framework**: Jest
- **Agent-Executed QA**: ALWAYS (Playwright for browser UI, Bash for API/CLI)

### QA Policy

Every task MUST include agent-executed QA scenarios.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation - Data Layer):
├── Task 1: Add getMostPlayedTracks service method [deep]
├── Task 2: Add useMostPlayedTracks query hook [quick]
└── Task 3: Remove quick action buttons from homepage [quick]

Wave 2 (Feature Pages):
├── Task 4: Create Recently Played page [artistry]
├── Task 5: Add Play All button to history page [quick]
└── Task 6: Create Quick Access section component [visual-engineering]

Wave 3 (Integration):
└── Task 7: Replace 近期歌单 with 快捷入口 section [artistry]

Critical Path: Task 1 → Task 2 → Task 4 → Task 7
Parallel Speedup: ~50% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks |
| ---- | ---------- | ------ |
| 1    | -          | 2, 4   |
| 2    | 1          | 4      |
| 3    | -          | 7      |
| 4    | 1, 2       | -      |
| 5    | -          | -      |
| 6    | -          | 7      |
| 7    | 3, 6       | -      |

---

## TODOs

### Wave 1: Foundation (Data Layer)

- [x] 1. Add getMostPlayedTracks service method to trackService

  **What to do**:
  - Open `apps/mobile/src/lib/services/trackService.ts`
  - Add new method `getMostPlayedTracksInLastDays(options: { days: number; limit: number })`
  - Query logic:
    1. Calculate cutoff time: `Date.now() - days * 24 * 60 * 60 * 1000` (convert to Unix seconds)
    2. Filter playHistory where `startTime >= cutoff` (handle both ms and seconds timestamps)
    3. Group by `trackId`, sum `durationPlayed`
    4. Order by totalDuration DESC
    5. Limit to N tracks
    6. Join with tracks and artists tables to get full track info
  - Return type: `Promise<Array<{ track: Track; totalDuration: number }>>`
  - Follow existing pattern from `getPlayCountHistoryPaginated`

  **Must NOT do**:
  - Do NOT add caching beyond what TanStack Query provides
  - Do NOT create a new service file
  - Do NOT add pagination (limit is sufficient)

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []
  - Reason: Database query with complex aggregation, needs careful thought

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 3)
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 2, Task 4

  **References**:
  - `apps/mobile/src/lib/services/trackService.ts:400-500` - `getPlayCountHistoryPaginated` method for query pattern
  - `apps/mobile/src/lib/db/schema.ts:79-97` - playHistory table schema
  - `apps/mobile/src/hooks/queries/playHistory.ts:56-99` - `usePlayHistoryByDate` for timestamp handling

  **Acceptance Criteria**:
  - [ ] Method exists on TrackService class
  - [ ] Returns tracks ordered by totalDuration DESC
  - [ ] Respects days and limit parameters
  - [ ] Handles both ms and seconds timestamps correctly

  **QA Scenarios**:

  ```
  Scenario: Query returns correct tracks ordered by duration
    Tool: Bash (node/bun REPL)
    Preconditions: Database has playHistory records with varying durations
    Steps:
      1. Import TrackService from '@/lib/services/trackService'
      2. Call trackService.getMostPlayedTracksInLastDays({ days: 14, limit: 10 })
      3. Verify result is Array<{ track, totalDuration }>
      4. Verify results are sorted by totalDuration DESC
    Expected Result: Array sorted correctly, max 10 items
    Failure Indicators: Wrong sort order, more than limit items
    Evidence: .sisyphus/evidence/task-1-query-order.txt
  ```

  **Commit**: YES (1 of 7)
  - Message: `feat(mobile): add getMostPlayedTracks service method`
  - Files: `apps/mobile/src/lib/services/trackService.ts`

---

- [x] 2. Add useMostPlayedTracks query hook

  **What to do**:
  - Open `apps/mobile/src/hooks/queries/playHistory.ts`
  - Add new query key: `topPlayed: (days: number, limit: number) => [...playHistoryKeys.all, 'topPlayed', days, limit] as const`
  - Add new hook `useMostPlayedTracks(days: number, limit: number)`
  - Use TanStack Query with the new service method
  - Set `enabled: true` and `staleTime: 60 * 1000` (1 minute)
  - Map result to include full track data with artist

  **Must NOT do**:
  - Do NOT add mutation hooks
  - Do NOT add optimistic updates
  - Do NOT over-engineer caching

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Reason: Straightforward hook following existing patterns

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 1)
  - **Parallel Group**: Sequential after Task 1
  - **Blocks**: Task 4

  **References**:
  - `apps/mobile/src/hooks/queries/playHistory.ts:9-13` - Query key pattern
  - `apps/mobile/src/hooks/queries/playHistory.ts:56-99` - Hook structure pattern

  **Acceptance Criteria**:
  - [ ] Query key factory extended
  - [ ] Hook returns correct TanStack Query result
  - [ ] Hook calls trackService method correctly

  **QA Scenarios**:

  ```
  Scenario: Hook returns query result with tracks
    Tool: Bash (bun test)
    Steps:
      1. Create test file `apps/mobile/src/hooks/queries/__tests__/playHistory.topPlayed.test.ts`
      2. Mock trackService.getMostPlayedTracksInLastDays
      3. Render hook with useMostPlayedTracks(14, 10)
      4. Verify hook returns { data, isPending, isError }
    Expected Result: Hook returns expected structure
    Evidence: .sisyphus/evidence/task-2-hook-test.txt
  ```

  **Commit**: YES (2 of 7)
  - Message: `feat(mobile): add useMostPlayedTracks query hook`
  - Files: `apps/mobile/src/hooks/queries/playHistory.ts`

---

- [x] 3. Remove quick action buttons from homepage

  **What to do**:
  - Open `apps/mobile/src/app/(tabs)/index.tsx`
  - Delete lines 407-469 (entire `quickActionsContainer` View block)
  - Remove unused imports: `IconButton` if no longer used elsewhere
  - Remove unused styles: `quickActionsContainer`, `quickActionItem`, `quickActionText`

  **Must NOT do**:
  - Do NOT modify any other functionality
  - Do NOT change the WeeklyHeatMap component
  - Do NOT remove any other imports that are still used

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Reason: Simple deletion, no complex logic

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 1, 2)
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 7

  **References**:
  - `apps/mobile/src/app/(tabs)/index.tsx:407-469` - Code to delete
  - `apps/mobile/src/app/(tabs)/index.tsx:581-593` - Styles to remove

  **Acceptance Criteria**:
  - [ ] No quick action buttons visible on homepage
  - [ ] No unused imports or styles remain
  - [ ] App compiles and runs successfully

  **QA Scenarios**:

  ```
  Scenario: Homepage renders without quick actions
    Tool: Bash (pnpm lint + pnpm test)
    Steps:
      1. Run `cd apps/mobile && pnpm lint`
      2. Run `cd apps/mobile && pnpm test -- --passWithNoTests`
      3. Verify no lint errors related to unused imports
    Expected Result: Lint passes, tests pass
    Evidence: .sisyphus/evidence/task-3-lint-output.txt
  ```

  **Commit**: YES (3 of 7)
  - Message: `refactor(mobile): remove quick action buttons from homepage`
  - Files: `apps/mobile/src/app/(tabs)/index.tsx`

---

### Wave 2: Feature Pages

- [x] 4. Create Recently Played page

  **What to do**:
  - Create `apps/mobile/src/app/playlist/recently/index.tsx`
  - Copy structure from `toview.tsx` but adapt:
    - Title: "最近常听"
    - Subtitle: "最近14天最常播放的歌曲"
    - Use `useMostPlayedTracks(14, 10)` instead of `useGetToViewVideoList`
    - Sort by `totalDuration` (already sorted from service)
    - Remove progress display (not applicable)
  - Handle empty state: show "暂无播放记录" text when no data
  - Handle loading/error states using `PlaylistPageSkeleton` and `PlaylistError`

  **Must NOT do**:
  - Do NOT add filter/sort options for user
  - Do NOT add selection mode (keep simple)
  - Do NOT create custom item renderer (use default TrackListItem)

  **Recommended Agent Profile**:
  - **Category**: `artistry`
  - **Skills**: []
  - Reason: UI composition with existing patterns, needs careful adaptation

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 5, 6)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 7

  **References**:
  - `apps/mobile/src/app/playlist/remote/toview.tsx:1-317` - Full structure to copy
  - `apps/mobile/src/features/playlist/remote/components/RemoteTrackList.tsx` - TrackList component
  - `apps/mobile/src/features/playlist/remote/components/PlaylistHeader.tsx` - Header component
  - `apps/mobile/src/features/playlist/skeletons/PlaylistSkeleton.tsx` - Loading state

  **Acceptance Criteria**:
  - [ ] Page renders at `/playlist/recently`
  - [ ] Shows tracks ordered by play duration
  - [ ] Shows empty state when no plays in last 14 days
  - [ ] Play button starts playback from selected track

  **QA Scenarios**:

  ```
  Scenario: Recently Played page shows correct tracks
    Tool: Bash (pnpm android + manual verification)
    Steps:
      1. Navigate to /playlist/recently
      2. Verify page title is "最近常听"
      3. Verify tracks are displayed
      4. Tap a track, verify playback starts
    Expected Result: Page works correctly
    Evidence: .sisyphus/evidence/task-4-page-screenshot.png
  ```

  **Commit**: YES (4 of 7)
  - Message: `feat(mobile): create Recently Played page`
  - Files: `apps/mobile/src/app/playlist/recently/index.tsx`

---

- [x] 5. Add Play All button to history/[date] page

  **What to do**:
  - Open `apps/mobile/src/app/history/[date].tsx`
  - Add `Button` import from `@/components/common/Button`
  - Add `useCallback` for `handlePlayAll`:
    ```typescript
    const handlePlayAll = useCallback(async () => {
    	const allTracks = aggregatedTracks.map((t) => t.track)
    	const playableTracks = allTracks.filter((track) => {
    		// Check if track is cached/downloaded
    		// For bilibili tracks: check if downloaded
    		// For local tracks: always playable
    		return track.source === 'local' || isTrackDownloaded(track)
    	})
    	if (playableTracks.length === 0) {
    		toast.error('没有可播放的歌曲')
    		return
    	}
    	await addToQueue({
    		tracks: playableTracks,
    		playNow: true,
    		clearQueue: true,
    		playNext: false,
    	})
    }, [aggregatedTracks])
    ```
  - Add Button between `totalDurationSurface` and `contentContainer`
  - Button style: `mode='contained'`, `icon='play'`

  **Must NOT do**:
  - Do NOT add shuffle button
  - Do NOT add progress indicator
  - Do NOT disable button for empty state (condition will hide it)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Reason: Straightforward addition following existing pattern

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 4, 6)
  - **Parallel Group**: Wave 2
  - **Blocks**: None

  **References**:
  - `apps/mobile/src/features/playlist/local/components/LocalPlaylistHeader.tsx:92-100` - Button pattern
  - `apps/mobile/src/utils/player.ts:70-90` - addToQueue function
  - `apps/mobile/src/app/history/[date].tsx:144-157` - Insertion point

  **Acceptance Criteria**:
  - [ ] Play All button visible when tracks exist
  - [ ] Button clears queue and starts from first track
  - [ ] Offline: only cached tracks are queued
  - [ ] Empty state: button not shown or shows "暂无数据"

  **QA Scenarios**:

  ```
  Scenario: Play All button queues correct tracks
    Tool: Bash (pnpm android + manual)
    Steps:
      1. Navigate to history/[date] page with tracks
      2. Verify Play All button is visible
      3. Tap Play All
      4. Verify queue is cleared and playback starts from first track
    Expected Result: Queue replaced, playback starts
    Evidence: .sisyphus/evidence/task-5-play-all.txt
  ```

  **Commit**: YES (5 of 7)
  - Message: `feat(mobile): add Play All button to history date page`
  - Files: `apps/mobile/src/app/history/[date].tsx`

---

- [x] 6. Create Quick Access section component infrastructure

  **What to do**:
  - Define the section structure in `index.tsx` (inline, not separate component)
  - Create horizontal ScrollView with snap:
    ```typescript
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={CARD_WIDTH + CARD_GAP}  // 156 = 140 + 16
      snapToAlignment='start'
      decelerationRate='fast'
      contentContainerStyle={styles.quickAccessScrollContent}
    >
      {/* Card items */}
    </ScrollView>
    ```
  - Card dimensions: width 140, gap 16
  - Section title: "快捷入口"
  - Three cards:
    1. "那年今日" - icon `calendar-star`, navigate to `/history/${todayLastYear}` (calculate in component)
    2. "最近常听" - icon `history`, navigate to `/playlist/recently`
    3. "稍后再看" - icon `clock-outline`, navigate to `/playlist/remote/toview`, only show if `hasBilibiliCookie()`

  **Must NOT do**:
  - Do NOT create a separate QuickAccessCard component
  - Do NOT add more than 3 cards
  - Do NOT add complex animations

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: []
  - Reason: UI layout with snap scroll, visual polish needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 4, 5)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 7

  **References**:
  - `apps/mobile/src/app/(tabs)/index.tsx:480-527` - Existing horizontal scroll pattern
  - `apps/mobile/src/app/(tabs)/index.tsx:83` - hasBilibiliCookie pattern
  - `apps/mobile/src/components/common/IconButton.tsx` - IconButton usage

  **Acceptance Criteria**:
  - [ ] Section shows "快捷入口" title
  - [ ] Three cards display correctly with icons
  - [ ] Horizontal scroll has snap effect
  - [ ] "稍后再看" card hidden when no cookie

  **QA Scenarios**:

  ```
  Scenario: Quick Access section snaps correctly
    Tool: Bash (pnpm android + manual)
    Steps:
      1. Navigate to homepage
      2. Scroll the Quick Access section horizontally
      3. Verify snap-to-card behavior
      4. Verify all cards are visible and tap target works
    Expected Result: Snap works, cards navigate correctly
    Evidence: .sisyphus/evidence/task-6-snap-scroll.mp4
  ```

  **Commit**: NO (groups with Task 7)

---

### Wave 3: Integration

- [x] 7. Replace 近期歌单 with 快捷入口 section

  **What to do**:
  - Open `apps/mobile/src/app/(tabs)/index.tsx`
  - Delete lines 471-529 (entire `recentPlaylistsSection` block)
  - Delete unused `recentPlaylists` query (lines 99-111)
  - Delete unused `useLiveQuery` import if no longer used
  - Insert the Quick Access section from Task 6 after the WeeklyHeatMap component
  - Remove unused styles: `recentPlaylistsSection`, `sectionTitle`, `horizontalScrollContent`, `playlistCard`, `playlistCover`, `playlistInfo`, `playlistTitle`
  - Add new styles for Quick Access section

  **Must NOT do**:
  - Do NOT modify WeeklyHeatMap
  - Do NOT change any other sections
  - Do NOT keep dead code

  **Recommended Agent Profile**:
  - **Category**: `artistry`
  - **Skills**: []
  - Reason: Integration task, needs care to not break existing functionality

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Tasks 3, 6)
  - **Parallel Group**: Wave 3 (Final)
  - **Blocks**: None

  **References**:
  - `apps/mobile/src/app/(tabs)/index.tsx:99-111` - Query to remove
  - `apps/mobile/src/app/(tabs)/index.tsx:471-529` - Section to replace
  - `apps/mobile/src/app/(tabs)/index.tsx:594-624` - Styles to clean up

  **Acceptance Criteria**:
  - [ ] Homepage shows WeeklyHeatMap + Quick Access section
  - [ ] No 近期歌单 visible
  - [ ] All navigation works correctly

  **QA Scenarios**:

  ```
  Scenario: Homepage displays correctly
    Tool: Bash (pnpm lint + pnpm android)
    Steps:
      1. Run `pnpm lint` in apps/mobile
      2. Build and run app
      3. Navigate to homepage
      4. Verify WeeklyHeatMap is visible
      5. Verify Quick Access section is below heatmap
      6. Verify no quick action buttons
      7. Verify no recent playlists section
    Expected Result: Lint passes, app displays correctly
    Evidence: .sisyphus/evidence/task-7-homepage-final.png
  ```

  **Commit**: YES (6 & 7 of 7)
  - Message: `feat(mobile): replace 近期歌单 with 快捷入口 section`
  - Files: `apps/mobile/src/app/(tabs)/index.tsx`

---

## Final Verification Wave (MANDATORY)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [ ] F1. Plan Compliance Audit — `oracle`
      Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run if applicable). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/.
      Output: `Must Have [4/4] | Must NOT Have [4/4] | Tasks [7/7] | VERDICT: APPROVE/REJECT`

- [ ] F2. Code Quality Review — `unspecified-high`
      Run `tsc --noEmit` + `pnpm lint` in apps/mobile. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names.
      Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Files [N clean/N issues] | VERDICT`

- [ ] F3. Real Manual QA — `unspecified-high`
      Start from clean build. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (features working together). Test edge cases: empty state, no cookie, offline. Save to `.sisyphus/evidence/final-qa/`.
      Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. Scope Fidelity Check — `deep`
      For each task: read "What to do", compare with actual diff (git diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination.
      Output: `Tasks [7/7 compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| Commit | Message                                                       | Files                       | Pre-commit  |
| ------ | ------------------------------------------------------------- | --------------------------- | ----------- |
| 1      | `feat(mobile): add getMostPlayedTracks service method`        | trackService.ts             | `pnpm test` |
| 2      | `feat(mobile): add useMostPlayedTracks query hook`            | playHistory.ts              | `pnpm test` |
| 3      | `refactor(mobile): remove quick action buttons from homepage` | index.tsx                   | `pnpm lint` |
| 4      | `feat(mobile): create Recently Played page`                   | playlist/recently/index.tsx | `pnpm lint` |
| 5      | `feat(mobile): add Play All button to history date page`      | history/[date].tsx          | `pnpm lint` |
| 6-7    | `feat(mobile): add Quick Access section to homepage`          | index.tsx                   | `pnpm lint` |

---

## Success Criteria

### Verification Commands

```bash
# Lint check
cd apps/mobile && pnpm lint

# Type check
cd apps/mobile && pnpm tsc --noEmit

# Build check
cd apps/mobile && pnpm android
```

### Final Checklist

- [ ] All "Must Have" features present
- [ ] All "Must NOT Have" absent
- [ ] No console.log in production code
- [ ] All imports use `@/*` alias
- [ ] No TypeScript errors
- [ ] Lint passes
- [ ] App builds and runs on Android
