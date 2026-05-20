import { useCurrentTrack } from './useCurrentTrack'
import { useIsPlaying } from './useIsPlaying'
import { usePlaybackState } from './usePlaybackState'
import { useProgress } from './useProgress'

/**
 * 汇总常用 Orpheus 播放 hooks，返回一个只读播放快照。
 */
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
