import { useShallow } from 'zustand/react/shallow'

import { usePlayerStore } from '@/hooks/stores/usePlayerStore'

export function useCurrentTrack() {
	return usePlayerStore(useShallow((state) => state.internalTrack))
}

export default useCurrentTrack
