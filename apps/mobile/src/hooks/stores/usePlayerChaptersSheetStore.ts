import { create } from 'zustand'

import { usePlayerQueueSheetStore } from '@/hooks/stores/usePlayerQueueSheetStore'

export const usePlayerChaptersSheetStore = create<{
	index: number
	open: () => void
	close: () => void
	setIndex: (index: number) => void
}>((set) => ({
	index: 0,
	open: () => {
		void usePlayerQueueSheetStore.getState().close()
		set({ index: 1 })
	},
	close: () => set({ index: 0 }),
	setIndex: (index) => set({ index }),
}))

usePlayerQueueSheetStore.subscribe((state) => {
	if (state.isOpen) usePlayerChaptersSheetStore.getState().close()
})
