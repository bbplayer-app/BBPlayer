import { TrueSheet } from '@lodev09/react-native-true-sheet'
import { create } from 'zustand'

interface DlnaCastSheetState {
	isOpen: boolean
	open: () => Promise<void>
	close: () => Promise<void>
	setOpen: (value: boolean) => void
}

export const useDlnaCastSheetStore = create<DlnaCastSheetState>((set) => ({
	isOpen: false,
	open: async () =>
		TrueSheet.present('dlnaCastModal').catch(() => {
			// Ignore error if view not found or already presented
		}),
	close: async () =>
		TrueSheet.dismiss('dlnaCastModal').catch(() => {
			// Ignore error if view not found or already dismissed
		}),
	setOpen: (value: boolean) => set({ isOpen: value }),
}))
