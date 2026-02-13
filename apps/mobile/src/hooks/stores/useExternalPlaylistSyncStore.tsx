import { createContext, use, useRef } from 'react'
import { createStore, useStore } from 'zustand'

import type { MatchResult } from '@/lib/services/externalPlaylistService'

interface SyncState {
	results: Record<number, MatchResult>
	progress: number
	syncing: boolean
	setSyncing: (syncing: boolean) => void
	setResult: (index: number, result: MatchResult) => void
	setProgress: (current: number, total: number) => void
	reset: () => void
}

type SyncStore = ReturnType<typeof createExternalPlaylistSyncStore>

const createExternalPlaylistSyncStore = () => {
	return createStore<SyncState>((set) => ({
		results: {},
		progress: 0,
		syncing: false,
		setSyncing: (syncing) => set({ syncing }),
		setResult: (index, result) =>
			set((state) => ({ results: { ...state.results, [index]: result } })),
		setProgress: (current, total) => set({ progress: current / total }),
		reset: () => set({ results: {}, progress: 0, syncing: false }),
	}))
}

const ExternalPlaylistSyncStoreContext = createContext<SyncStore | null>(null)

export const ExternalPlaylistSyncStoreProvider = ({
	children,
}: {
	children: React.ReactNode
}) => {
	const storeRef = useRef<SyncStore | null>(null)
	// oxlint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
	if (!storeRef.current) {
		storeRef.current = createExternalPlaylistSyncStore()
	}
	return (
		<ExternalPlaylistSyncStoreContext.Provider value={storeRef.current}>
			{children}
		</ExternalPlaylistSyncStoreContext.Provider>
	)
}

export type { SyncStore }

export function useExternalPlaylistSyncStoreApi() {
	const store = use(ExternalPlaylistSyncStoreContext)
	if (!store) {
		throw new Error(
			'useExternalPlaylistSyncStoreApi must be used within ExternalPlaylistSyncStoreProvider',
		)
	}
	return store
}

export function useExternalPlaylistSyncStore<T>(
	selector: (state: SyncState) => T,
): T {
	const store = useExternalPlaylistSyncStoreApi()
	return useStore(store, selector)
}
