import { usePlayerStore } from '@/hooks/stores/usePlayerStore'
import { useShallow } from 'zustand/react/shallow'

export function useIsCurrentTrack(trackUniqueKey: string) {
	return usePlayerStore(
		useShallow((state) => state.orpheusTrack?.id === trackUniqueKey),
	)
}

export default useIsCurrentTrack
