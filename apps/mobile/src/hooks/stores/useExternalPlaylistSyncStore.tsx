import { createContext, use, useState } from 'react'
import { createStore, useStore } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import type { MatchResult } from '@/lib/services/externalPlaylistService'
import { zustandStorage } from '@/utils/mmkv'

type SyncSession = {
	results: Record<number, MatchResult>
	updatedAt: number
}

interface SyncState {
	currentSessionKey: string | null
	sessions: Record<string, SyncSession>
	results: Record<number, MatchResult>
	progress: number
	syncing: boolean
	setSessionKey: (sessionKey: string, total: number) => void
	setSyncing: (syncing: boolean) => void
	setResult: (index: number, result: MatchResult) => void
	setProgress: (current: number, total: number) => void
	reset: () => void
	clearSession: () => void
}

type SyncStore = ReturnType<typeof createExternalPlaylistSyncStore>

const createExternalPlaylistSyncStore = () => {
	return createStore<SyncState>()(
		persist(
			(set, get) => ({
				currentSessionKey: null,
				sessions: {},
				results: {},
				progress: 0,
				syncing: false,
				setSessionKey: (sessionKey, total) => {
					const results = get().sessions[sessionKey]?.results ?? {}
					set({
						currentSessionKey: sessionKey,
						results,
						progress: getProgressFromResults(results, total),
						syncing: false,
					})
				},
				setSyncing: (syncing) => set({ syncing }),
				setResult: (index, result) =>
					set((state) => {
						const results = { ...state.results, [index]: result }
						return {
							results,
							sessions: state.currentSessionKey
								? {
										...state.sessions,
										[state.currentSessionKey]: {
											results,
											updatedAt: Date.now(),
										},
									}
								: state.sessions,
						}
					}),
				setProgress: (current, total) =>
					set({ progress: total > 0 ? current / total : 0 }),
				reset: () =>
					set((state) => ({
						results: {},
						progress: 0,
						syncing: false,
						sessions: state.currentSessionKey
							? {
									...state.sessions,
									[state.currentSessionKey]: {
										results: {},
										updatedAt: Date.now(),
									},
								}
							: state.sessions,
					})),
				clearSession: () =>
					set((state) => {
						if (!state.currentSessionKey) {
							return { results: {}, progress: 0, syncing: false }
						}
						const sessions = { ...state.sessions }
						delete sessions[state.currentSessionKey]
						return {
							sessions,
							results: {},
							progress: 0,
							syncing: false,
						}
					}),
			}),
			{
				name: 'external-playlist-sync-storage',
				storage: createJSONStorage(() => zustandStorage),
				partialize: (state) => ({
					sessions: state.sessions,
				}),
			},
		),
	)
}

const getProgressFromResults = (
	results: Record<number, MatchResult>,
	total: number,
) => {
	if (total <= 0) return 0
	return Math.min(Object.keys(results).length / total, 1)
}

const ExternalPlaylistSyncStoreContext = createContext<SyncStore | null>(null)

export const ExternalPlaylistSyncStoreProvider = ({
	children,
}: {
	children: React.ReactNode
}) => {
	const [store] = useState(createExternalPlaylistSyncStore)
	return (
		<ExternalPlaylistSyncStoreContext.Provider value={store}>
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
