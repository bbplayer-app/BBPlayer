import { create } from 'zustand'

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

export const useExternalPlaylistSyncStore = create<SyncState>((set) => ({
	results: {},
	progress: 0,
	syncing: false,
	setSyncing: (syncing) => set({ syncing }),
	setResult: (index, result) =>
		set((state) => ({ results: { ...state.results, [index]: result } })),
	setProgress: (current, total) => set({ progress: current / total }),
	reset: () => set({ results: {}, progress: 0, syncing: false }),
}))
