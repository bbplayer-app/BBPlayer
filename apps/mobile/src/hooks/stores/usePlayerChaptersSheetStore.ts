import { TrueSheet } from '@lodev09/react-native-true-sheet'
import { create } from 'zustand'

import { usePlayerQueueSheetStore } from '@/hooks/stores/usePlayerQueueSheetStore'
import { toastAndLogError } from '@/utils/error-handling'

interface PlayerChaptersSheetState {
	isOpen: boolean
	open: () => Promise<void>
	close: () => Promise<void>
	setOpen: (value: boolean) => void
}

let transition = Promise.resolve()

export const usePlayerChaptersSheetStore = create<PlayerChaptersSheetState>(
	(set, get) => ({
		isOpen: false,

		open: async () => {
			transition = transition.then(async () => {
				if (get().isOpen) return
				if (usePlayerQueueSheetStore.getState().isOpen)
					await usePlayerQueueSheetStore.getState().close()
				set({ isOpen: true })
				try {
					await TrueSheet.present('playerChaptersSheet')
				} catch (error) {
					set({ isOpen: false })
					toastAndLogError('打开章节失败', error, 'Player.Chapters')
				}
			})
			return transition
		},

		close: async () => {
			transition = transition.then(async () => {
				if (!get().isOpen) return
				set({ isOpen: false })
				try {
					await TrueSheet.dismiss('playerChaptersSheet')
				} catch (error) {
					toastAndLogError('关闭章节失败', error, 'Player.Chapters')
				}
			})
			return transition
		},

		setOpen: (value: boolean) => set({ isOpen: value }),
	}),
)

usePlayerQueueSheetStore.subscribe((state) => {
	if (state.isOpen && usePlayerChaptersSheetStore.getState().isOpen)
		void usePlayerChaptersSheetStore.getState().close()
})
