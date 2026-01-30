import { useShallow } from 'zustand/react/shallow'

import { usePlayerStore } from '@/hooks/stores/usePlayerStore'

export function useIsCurrentTrack(trackUniqueKey: string) {
	return usePlayerStore(
		useShallow((state) => state.orpheusTrack?.id === trackUniqueKey),
	)
}

export default useIsCurrentTrack
