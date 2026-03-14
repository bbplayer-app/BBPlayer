# BBPlayer: Technical Overview & Development Guidelines

BBPlayer is a high-performance, local-first Bilibili music player built with React Native and Expo. It aims to provide a lightweight and refined listening experience, bypassing the overhead of the official Bilibili client.

## 🏗 Project Architecture

This is a **monorepo** managed with `pnpm`.

### Core Applications (`apps/`)

- **`mobile`**: The main React Native / Expo application.
- **`backend`**: A Cloudflare Worker (Hono + Drizzle) providing supplemental APIs and sync services.
- **`docs`**: Documentation site built with VitePress.

### Internal Packages (`packages/`)

- **`@bbplayer/orpheus`**: A custom Expo native module for audio playback, built on top of Android Media3.
- **`@bbplayer/splash`**: A specialized engine for parsing and rendering lyrics, supporting the [SPL format](https://bbplayer.roitium.com/SPL) (word-level sync, romaji, translations).
- **`@bbplayer/image-theme-colors`**: Native module for extracting dominant colors from album art for Material Design 3 (Monet) dynamic styling.
- **`@bbplayer/logs`**: Unified logging utility.

## 🛠 Tech Stack

### Frontend (Mobile)

- **Framework**: React 19, React Native 0.83, Expo 55 (using Expo Router).
- **State Management**: **Zustand** (client state), **React Query** (server/API state).
- **UI & Graphics**:
  - **React Native Paper**: Material Design 3 components.
  - **Shopify/Flash-List**: High-performance lists.
  - **Shopify/React-Native-Skia**: Advanced 2D graphics (player visuals).
  - **React Native Reanimated**: Fluid animations.
- **Data Persistence**:
  - **Drizzle ORM**: Local SQLite database for library, playlists, and history.
  - **MMKV**: High-performance key-value storage for settings and small caches.

### Backend

- **Platform**: Cloudflare Workers.
- **Framework**: Hono.
- **Database**: PostgreSQL (via Drizzle ORM).

## 🚀 Getting Started

### Prerequisites

- `pnpm` (latest)
- Android Studio / Xcode (for native development)

### Main Commands

Run these from the root:

- `pnpm install`: Install dependencies.
- `pnpm run lint`: Run `oxlint` and `eslint` across the project.
- `pnpm run format`: Format code with `oxfmt`.

#### Mobile App Development

Navigate to `apps/mobile`:

- `pnpm run start`: Start the Expo development server (with Rozenite profiling).
- `pnpm run android`: Build and run on an Android emulator/device.

## 📝 Development Conventions

### General Guidelines

- **Local-First**: Prioritize local SQLite storage for user data to ensure offline availability and speed.
- **Type Safety**: Strictly adhere to TypeScript. Ensure all API responses and database schemas are well-typed.
- **Bilibili API**: Most data is fetched directly from Bilibili's internal/web APIs via the mobile client.

### React Native Best Practices

- **Layout Measurement**: When measuring component layout for precise coordinate-based logic, use `measure` within `useLayoutEffect` to avoid visual flickering.
- **Performance**: Use `FlashList` for any list with more than 20 items. Minimize re-renders in the playback controller and lyric engine.

### Workflow

- **Changelog**: After completing any task, update `CHANGELOG.md` in `apps/mobile/` with a concise record of the change.
- **Lefthook**: Git hooks are managed by Lefthook for pre-commit linting and commit message validation.

## 📂 Key File Locations (Mobile)

- `src/app/`: Expo Router file-based routing.
- `src/features/`: Feature-sliced logic (player, library, downloads, etc.).
- `src/lib/db/schema.ts`: Drizzle SQLite schema definition.
- `src/lib/api/bilibili/`: Bilibili API clients and types.
