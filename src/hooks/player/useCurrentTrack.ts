import { usePlayerStore } from '@/hooks/stores/usePlayerStore'
import { useShallow } from 'zustand/react/shallow'

export function useCurrentTrack() {
	return usePlayerStore(useShallow((state) => state.internalTrack))
}

export default useCurrentTrack
