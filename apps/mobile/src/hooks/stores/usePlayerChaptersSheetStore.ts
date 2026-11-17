import { TrueSheet } from '@lodev09/react-native-true-sheet'
import { create } from 'zustand'

import { usePlayerQueueSheetStore } from '@/hooks/stores/usePlayerQueueSheetStore'
import { toastAndLogError } from '@/utils/error-handling'

interface PlayerChaptersSheetState {
	isOpen: boolean
	/** 弹窗只在打开期间挂载，避免每次进入播放页都渲染整个章节列表 */
	isMounted: boolean
	open: () => Promise<void>
	close: () => Promise<void>
	setOpen: (value: boolean) => void
	/** 弹窗组件挂载完成后调用，此时才能按名字 present */
	markMounted: () => void
	unmount: () => void
}

let transition = Promise.resolve()
let resolveMounted: (() => void) | null = null

export const usePlayerChaptersSheetStore = create<PlayerChaptersSheetState>(
	(set, get) => ({
		isOpen: false,
		isMounted: false,

		open: async () => {
			transition = transition.then(async () => {
				if (get().isOpen) return

				if (usePlayerQueueSheetStore.getState().isOpen)
					await usePlayerQueueSheetStore.getState().close()

				if (!get().isMounted) {
					const mounted = new Promise<void>((resolve) => {
						resolveMounted = resolve
					})

					set({ isMounted: true })
					await mounted

					// 等待挂载期间播放页可能已经卸载
					if (!get().isMounted) return
				}

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

		markMounted: () => {
			resolveMounted?.()
			resolveMounted = null
		},

		unmount: () => {
			set({ isMounted: false, isOpen: false })
			resolveMounted?.()
			resolveMounted = null
		},
	}),
)

usePlayerQueueSheetStore.subscribe((state) => {
	if (state.isOpen && usePlayerChaptersSheetStore.getState().isOpen)
		void usePlayerChaptersSheetStore.getState().close()
})
