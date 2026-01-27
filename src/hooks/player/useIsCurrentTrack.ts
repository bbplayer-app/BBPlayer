import { useCurrentTrack as useOrpheusTrack } from '@roitium/expo-orpheus'

export function useIsCurrentTrack(trackUniqueKey: string) {
	const { track } = useOrpheusTrack()

	return track?.id === trackUniqueKey
}

export default useIsCurrentTrack
