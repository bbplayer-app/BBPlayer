import { useCurrentTrack as useOrpheusTrack } from '@roitium/expo-orpheus'

export function useCurrentTrackId() {
	const { track } = useOrpheusTrack()
	return track?.id
}

export default useCurrentTrackId
