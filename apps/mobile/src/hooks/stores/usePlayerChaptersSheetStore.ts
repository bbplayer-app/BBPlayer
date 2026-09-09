import { TrueSheet } from '@lodev09/react-native-true-sheet'
import { create } from 'zustand'

import { usePlayerQueueSheetStore } from '@/hooks/stores/usePlayerQueueSheetStore'

interface PlayerChaptersSheetState {
	isOpen: boolean
	open: () => Promise<void>
	close: () => Promise<void>
	setOpen: (value: boolean) => void
}

export const usePlayerChaptersSheetStore = create<PlayerChaptersSheetState>(
	(set) => ({
		isOpen: false,

		open: async () => {
			void usePlayerQueueSheetStore.getState().close()
			set({ isOpen: true })
			return TrueSheet.present('playerChaptersSheet').catch(() => {
				// Ignore error if view not found or already presented
			})
		},

		close: async () => {
			set({ isOpen: false })
			return TrueSheet.dismiss('playerChaptersSheet').catch(() => {
				// Ignore error if view not found or already dismissed
			})
		},

		setOpen: (value: boolean) => set({ isOpen: value }),
	}),
)

usePlayerQueueSheetStore.subscribe((state) => {
	if (state.isOpen) void usePlayerChaptersSheetStore.getState().close()
})
