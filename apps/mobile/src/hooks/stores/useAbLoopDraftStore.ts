import type { AbLoopRange } from '@bbplayer/orpheus'
import { create } from 'zustand'

interface AbLoopDraftStore {
	draft: (AbLoopRange & { trackId: string }) | null
	setDraft: (trackId: string, range: AbLoopRange) => void
	resetForTrack: (trackId: string | null) => void
	clear: () => void
}

/** 只保留当前曲目的内存草稿，不使用 persist 中间件。 */
export const useAbLoopDraftStore = create<AbLoopDraftStore>((set) => ({
	draft: null,
	setDraft: (trackId, range) => set({ draft: { trackId, ...range } }),
	resetForTrack: (trackId) =>
		set((state) =>
			state.draft?.trackId === trackId ? state : { draft: null },
		),
	clear: () => set({ draft: null }),
}))
