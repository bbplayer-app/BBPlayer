# Task 5: Play All Button - Learnings

## Patterns Discovered

### Type Union Handling in Filter

When filtering a union type (`Track = BilibiliTrack | LocalTrack`) where only one variant has a certain property:

```typescript
// This fails: Property doesn't exist on BilibiliTrack
;(track) => track.source === 'local' || !!track.localMetadata

// This works: Cast through unknown
;(track) =>
	track.source === 'local' ||
	!!(track as unknown as { localMetadata?: unknown }).localMetadata
```

### Button Component Pattern

BBPlayer uses a custom Button component at `@/components/common/Button`:

- Props: `mode`, `icon`, `onPress`, children
- Modes: 'text', 'outlined', 'contained', 'elevated', 'contained-tonal'

### Toast Usage

Import from `@/utils/toast` (wraps sonner-native):

```typescript
import toast from '@/utils/toast'
toast.error('message')
```

### addToQueue Pattern

From `@/utils/player`:

```typescript
await addToQueue({
	tracks: playableTracks,
	playNow: true,
	clearQueue: true,
	playNext: false,
})
```
