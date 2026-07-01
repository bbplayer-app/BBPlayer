import { TrueSheet } from '@lodev09/react-native-true-sheet'
import { create } from 'zustand'

interface PlayerQueueSheetState {
	isOpen: boolean
	open: () => Promise<void>
	close: () => Promise<void>
	setOpen: (value: boolean) => void
}

export const usePlayerQueueSheetStore = create<PlayerQueueSheetState>(
	(set) => ({
		isOpen: false,

		open: async () =>
			TrueSheet.present('playerQueueModal').catch(() => {
				// Ignore error if view not found or already presented
			}),

		close: async () =>
			TrueSheet.dismiss('playerQueueModal').catch(() => {
				// Ignore error if view not found or already dismissed
			}),

		setOpen: (value: boolean) => set({ isOpen: value }),
	}),
)
