# BBPlayer Orpheus Audio Module

**Location:** `packages/orpheus/`
**Type:** Expo Native Module
**Purpose:** High-performance audio playback with Bilibili integration

---

## OVERVIEW

Custom Expo native module providing audio playback for BBPlayer. Replaces third-party libraries with tight Android Media3 (ExoPlayer) and AVFoundation integration.

**Key Features:**

- Bilibili audio stream protocol support
- Dual-layer caching (download + LRU playback cache)
- Desktop lyrics (Android only)
- Spectrum visualization (Android only)
- Seamless playback (Android only)

---

## STRUCTURE

```
.
├── src/                          # TypeScript source
│   ├── index.ts                 # Main entry point
│   ├── ExpoOrpheusModule.ts     # Module definition
│   ├── headless.ts              # Headless task registration
│   └── hooks/                   # React hooks
│       ├── useOrpheus.ts
│       └── useOrpheusEvent.ts
├── android/                      # Android native code
│   └── src/main/java/
│       ├── expo/modules/orpheus/
│       │   ├── OrpheusModule.kt
│       │   ├── OrpheusService.kt
│       │   ├── OrpheusView.kt
│       │   ├── manager/
│       │   └── util/
│       └── io/github/proify/lyricon/
│           └── provider/        # Lyricon integration
├── ios/                          # iOS native code
│   └── OrpheusModule.swift
├── example/                      # Standalone test app
│   ├── src/
│   ├── App.tsx
│   └── index.ts
└── expo-module.config.json       # Module configuration
```

---

## WHERE TO LOOK

| Task                  | Location                                      | Notes                               |
| --------------------- | --------------------------------------------- | ----------------------------------- |
| **Public API**        | `src/index.ts`                                | Main exports                        |
| **Module Definition** | `src/ExpoOrpheusModule.ts`                    | Native module interface             |
| **Hooks**             | `src/hooks/`                                  | React integration                   |
| **Headless Tasks**    | `src/headless.ts`                             | Platform-specific task registration |
| **Android Native**    | `android/src/main/java/expo/modules/orpheus/` | Kotlin implementation               |
| **iOS Native**        | `ios/OrpheusModule.swift`                     | Swift implementation                |
| **Lyricon**           | `android/.../io/github/proify/lyricon/`       | Lyric provider integration          |

---

## CONVENTIONS

### Native Module Structure

```typescript
// src/ExpoOrpheusModule.ts
import { requireNativeModule } from 'expo-modules-core'

export interface OrpheusModuleType {
	play(track: Track): Promise<void>
	pause(): Promise<void>
	seek(position: number): Promise<void>
	// ...
}

export default requireNativeModule<OrpheusModuleType>('Orpheus')
```

### React Hooks Pattern

```typescript
// src/hooks/useOrpheus.ts
export function useOrpheus() {
	const module = useRef(OrpheusModule)

	return {
		play: module.current.play.bind(module.current),
		pause: module.current.pause.bind(module.current),
		// ...
	}
}
```

### Platform-Specific Code

```typescript
// src/headless.ts
import { AppRegistry, Platform } from 'react-native'

export function registerHeadlessTask() {
	if (Platform.OS === 'android') {
		// Android: Use headless JS
		AppRegistry.registerHeadlessTask('OrpheusTask', () => async (data) => {
			/* ... */
		})
	} else {
		// iOS: Use native event bridge
		// Implementation in Swift
	}
}
```

---

## ANTI-PATTERNS

### 🚫 NEVER

- Modify Lyricon code directly (vendor code in `io/github/proify/lyricon/`)
- Use iOS-specific features without Android fallback (or vice versa)
- Skip testing in example app before publishing

### ⚠️ CAUTION

- Lyricon uses Kotlin 2.3.0 - metadata incompatibility with main project
- iOS support is minimal - many features unimplemented
- Desktop lyrics impossible on iOS (system limitation)

---

## UNIQUE STYLES

### Platform Abstraction

```typescript
// Features split by platform
const features = {
	desktopLyrics: Platform.OS === 'android',
	spectrum: Platform.OS === 'android',
	seamlessPlayback: Platform.OS === 'android',
	loudnessNormalization: Platform.OS === 'android',
}
```

### Native Event Handling

```typescript
// src/hooks/useOrpheusEvent.ts
import { useEvent } from 'expo-modules-core'

export function usePlaybackState() {
	const [state, setState] = useState<PlaybackState>('idle')

	useEvent(OrpheusModule, 'onPlaybackStateChange', (event) => {
		setState(event.state)
	})

	return state
}
```

### Lyricon Integration

Lyricon code vendored due to Kotlin version incompatibility:

```kotlin
// android/.../lyricon/provider/
// Direct source copy from tomakino/lyricon
// Do NOT modify - treat as vendor code
```

---

## COMMANDS

```bash
# Development
cd packages/orpheus
pnpm build              # Build module
pnpm test               # Run tests
pnpm lint               # Lint

# Example App
cd example
pnpm install
pnpm android            # Run example on Android
pnpm ios               # Run example on iOS

# Open Android Studio
pnpm open:android
```

---

## NOTES

### Lyricon Vendoring

Project includes Lyricon source directly (not npm dependency):

- Reason: Kotlin 2.3.0 vs main project lower version = metadata incompatibility
- Location: `android/src/main/java/io/github/proify/lyricon/`
- Policy: Treat as vendor code - do not modify

### iOS Limitations

Features NOT available on iOS:

- Desktop lyrics (system limitation - impossible)
- Spectrum visualization
- Seamless playback
- Loudness normalization
- Cover download for offline playback
- Batch export of downloaded songs

### Module Configuration

`expo-module.config.json`:

```json
{
	"platforms": ["ios", "android"],
	"ios": {
		"modules": ["OrpheusModule"]
	},
	"android": {
		"modules": ["expo.modules.orpheus.OrpheusModule"]
	}
}
```

### Caching Strategy

- **Download Cache**: Persistent downloaded files
- **Playback Cache**: LRU cache for streaming (Media3 DownloadManager)
- Both managed at native layer

### Bilibili Integration

- Automatic audio stream URL resolution
- High bitrate support
- Cookie-based authentication passed from JS layer
