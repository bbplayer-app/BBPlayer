import { create } from 'zustand'

interface SkinRefreshState {
	activeCount: number
	begin: () => void
	end: () => void
}

const useSkinRefreshStore = create<SkinRefreshState>((set) => ({
	activeCount: 0,
	begin: () => set((state) => ({ activeCount: state.activeCount + 1 })),
	end: () =>
		set((state) => ({
			activeCount: Math.max(0, state.activeCount - 1),
		})),
}))

export default useSkinRefreshStore
