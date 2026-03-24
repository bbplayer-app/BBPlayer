# BBPlayer Mobile App

**Location:** `apps/mobile/`
**Type:** React Native (Expo) Application

---

## OVERVIEW

Main BBPlayer mobile application. Bilibili audio player with offline playback, lyrics, and Material Design 3 UI.

**Entry Point:** `index.js` (initializes Orpheus native module before expo-router)

---

## STRUCTURE

```
src/
├── app/                    # Expo Router routes (file-based)
│   ├── _layout.tsx        # Root layout (providers, Sentry)
│   ├── (tabs)/            # Tab navigation
│   │   ├── index.tsx      # Home screen
│   │   ├── library/       # Library tab
│   │   └── settings/      # Settings tab
│   ├── player.tsx         # Full-screen player
│   ├── playlist/          # Playlist routes
│   ├── comments/          # Comments view
│   └── settings/          # Settings sub-pages
├── components/            # Shared UI components
├── features/              # Domain-organized modules
│   ├── player/           # Player UI components
│   ├── playlist/         # Playlist management
│   ├── home/             # Home screen features
│   ├── downloads/        # Download management
│   └── library/          # Library features
├── hooks/                 # Global hooks
│   ├── stores/           # Zustand stores
│   ├── queries/          # TanStack Query hooks
│   ├── mutations/        # TanStack Query mutations
│   └── player/           # Player-specific hooks
├── lib/                   # Business logic
│   ├── api/bilibili/     # Bilibili API integration
│   ├── db/               # Drizzle ORM schema
│   ├── facades/          # Facade layer (transactions)
│   ├── services/         # Service layer (domain logic)
│   └── workers/          # Background workers
├── types/                 # TypeScript definitions
└── utils/                 # Utility functions
```

---

## WHERE TO LOOK

| Task                 | Location                                            | Notes                          |
| -------------------- | --------------------------------------------------- | ------------------------------ |
| **Routes/Screens**   | `src/app/`                                          | Expo Router file-based routing |
| **Navigation**       | `src/app/_layout.tsx`, `src/app/(tabs)/_layout.tsx` | Stack + Tabs configuration     |
| **Player UI**        | `src/features/player/`                              | Player controls, lyrics        |
| **State Management** | `src/hooks/stores/`                                 | Zustand stores                 |
| **Data Fetching**    | `src/hooks/queries/`, `src/hooks/mutations/`        | TanStack Query                 |
| **Database**         | `src/lib/db/`                                       | Drizzle schema + migrations    |
| **Business Logic**   | `src/lib/facades/`, `src/lib/services/`             | Facade + Service pattern       |
| **Bilibili API**     | `src/lib/api/bilibili/`                             | API clients + protobuf         |

---

## CONVENTIONS

### Import Aliases

```typescript
// Use @/* for all imports (enforced by ESLint)
import { Player } from '@/components/player'
import { usePlayerStore } from '@/hooks/stores/usePlayerStore'

// NOT relative paths
// import { Player } from '../components/player'  // ❌
```

### Expo Router Patterns

```typescript
// Route params typed via hooks
import { useLocalSearchParams } from 'expo-router'
const { id } = useLocalSearchParams<{ id: string }>()

// Navigation
import { router } from 'expo-router'
router.push('/playlist/local')
router.back()
```

### FlashList (MANDATORY)

```typescript
// Define OUTSIDE component - NOT inside, NOT useCallback
const renderPlaylistItem = ({ item }: { item: Playlist }) => (
  <PlaylistItem playlist={item} />
)

// In component:
<FlashList
  data={playlists}
  renderItem={renderPlaylistItem}
  extraData={useMemo(() => ({ selectedId }), [selectedId])}
/>
```

### Zustand Stores

```typescript
// Separate stores by domain
import usePlayerStore from '@/hooks/stores/usePlayerStore'
import useAppStore from '@/hooks/stores/useAppStore'

// Store file pattern: use<Domain>Store.ts
```

### TanStack Query

```typescript
// Query hook pattern: src/hooks/queries/<domain>/use<Name>.ts
export function usePlaylistQuery(id: string) {
	return useQuery({
		queryKey: ['playlist', id],
		queryFn: () => fetchPlaylist(id),
	})
}

// Mutation hook pattern: src/hooks/mutations/<domain>/use<Name>.ts
export function useCreatePlaylistMutation() {
	return useMutation({
		mutationFn: createPlaylist,
	})
}
```

---

## ANTI-PATTERNS

### 🚫 NEVER

- Use Expo Go - requires custom dev build
- Define FlashList `renderItem` inside component
- Throw errors in Facades/Services (use neverthrow)
- Use `console.log` (enforced by oxlint)

### ⚠️ CAUTION

- iOS is "birth without nurture" - Android focus
- Bilibili Multi-P videos may have duplicate records
- MMKV migration code in `useAppStore.ts` - don't remove
- 27 `@ts-expect-error` workarounds exist - read comments before changing

---

## UNIQUE STYLES

### Facade + Service Architecture

```typescript
// Facade (lib/facades/playlistFacade.ts)
export async function addTrackToPlaylist(
	playlistId: string,
	track: Track,
): Promise<Result<void, Error>> {
	return db.transaction(async (tx) => {
		// Orchestrates multiple services
		const trackResult = await TrackService.createTrack(tx, track)
		if (trackResult.isErr()) return err(trackResult.error)

		return PlaylistService.addTrack(tx, playlistId, trackResult.value.id)
	})
}

// Service (lib/services/trackService.ts)
export const TrackService = {
	async createTrack(tx, track) {
		// Single domain logic, DB access
		return ok(await tx.insert(tracks).values(track))
	},
}
```

### Error Handling with neverthrow

```typescript
import { ok, err, Result } from 'neverthrow'

// Always return Result, never throw
async function fetchData(): Promise<Result<Data, Error>> {
	try {
		const data = await api.getData()
		return ok(data)
	} catch (e) {
		return err(new ApiError('Failed to fetch', e))
	}
}

// Caller must handle both cases
const result = await fetchData()
if (result.isErr()) {
	// Handle error
}
```

### Custom Hooks Pattern

```typescript
// src/hooks/player/useCurrentTrack.ts
export function useCurrentTrack() {
	const { currentTrackId } = usePlayerStore()
	return useQuery({
		queryKey: ['track', currentTrackId],
		queryFn: () => TrackService.getById(currentTrackId),
		enabled: !!currentTrackId,
	})
}
```

---

## COMMANDS

```bash
# Development
cd apps/mobile
pnpm start              # Start Metro (WITH_ROZENITE=true)
pnpm android            # Build & run Android

# Building (requires VERSION_CODE)
VERSION_CODE=$(git rev-list --count HEAD) \
  eas build --profile dev --platform android --local

# Testing
pnpm test               # Jest watch mode

# Database
pnpm db:generate        # Drizzle generate migrations
pnpm db:migrate         # Run migrations
pnpm db:studio          # Drizzle Studio

# Protobuf
pnpm prepare            # Regenerate proto files
```

---

## NOTES

### Rozenite Metro Plugins

Custom plugins in `metro.config.js`:

- `@rozenite/mmkv-plugin` - MMKV optimization
- `@rozenite/tanstack-query-plugin` - Query profiling
- `@rozenite/require-profiler-plugin` - Bundle analysis

### Environment Variables

Required for builds:

- `VERSION_CODE` - Build version (use `git rev-list --count HEAD`)
- `SENTRY_AUTH_TOKEN` - For production builds

### Firebase

- Mock configs in `assets/config/google-services/`
- Real configs: `google-services.real.json`, `GoogleService-Info.real.plist`

### Development Build

Expo Go won't work - must use custom dev build:

```bash
eas build --profile dev --platform android --local
```

### iOS Limitations

Not actively maintained. Missing features:

- Desktop lyrics (impossible)
- Spectrum visualizer
- Seamless playback
- Loudness normalization
- Cover download for offline
