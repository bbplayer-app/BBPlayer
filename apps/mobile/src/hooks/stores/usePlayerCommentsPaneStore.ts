import { create } from 'zustand'

interface PlayerCommentsPaneState {
	/** 宽屏播放器的评论侧边面板是否展开。 */
	isOpen: boolean
	/** 正在查看的评论回复楼层；为 null 时显示评论列表。 */
	replyId: number | null
	toggle: () => void
	close: () => void
	openReply: (rpid: number) => void
	closeReply: () => void
}

export const usePlayerCommentsPaneStore = create<PlayerCommentsPaneState>(
	(set) => ({
		isOpen: false,
		replyId: null,

		toggle: () => set((state) => ({ isOpen: !state.isOpen })),
		close: () => set({ isOpen: false }),
		openReply: (rpid) => set({ replyId: rpid }),
		closeReply: () => set({ replyId: null }),
	}),
)
