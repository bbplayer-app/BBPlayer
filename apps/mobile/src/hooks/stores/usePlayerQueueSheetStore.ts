import { create } from 'zustand'

interface PlayerQueueSheetState {
	isOpen: boolean
	index: number
	open: () => Promise<void>
	close: () => Promise<void>
	setIndex: (index: number) => void
	setOpen: (value: boolean) => void
}

export const usePlayerQueueSheetStore = create<PlayerQueueSheetState>(
	(set) => ({
		isOpen: false,
		index: 0,

		open: async () => set({ isOpen: true, index: 1 }),

		close: async () => set({ isOpen: false, index: 0 }),

		setIndex: (index) => set({ index, isOpen: index !== 0 }),

		setOpen: (isOpen) => set({ isOpen, index: isOpen ? 1 : 0 }),
	}),
)
