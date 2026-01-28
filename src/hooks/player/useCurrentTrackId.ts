import { usePlayerStore } from '@/hooks/stores/usePlayerStore'

export function useCurrentTrackId() {
	return usePlayerStore((state) => state.orpheusTrack?.id)
}

export default useCurrentTrackId
