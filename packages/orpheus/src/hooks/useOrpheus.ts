import { useCurrentTrack } from './useCurrentTrack'
import { useIsPlaying } from './useIsPlaying'
import { usePlaybackState } from './usePlaybackState'
import { useProgress } from './useProgress'

export function useOrpheus() {
	const state = usePlaybackState()
	const isPlaying = useIsPlaying()
	const progress = useProgress()
	const { track, index } = useCurrentTrack()

	return {
		state,
		isPlaying,
		position: progress.position,
		duration: progress.duration,
		buffered: progress.buffered,
		currentTrack: track,
		currentIndex: index,
	}
}
