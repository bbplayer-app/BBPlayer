import { Orpheus } from '@bbplayer/orpheus'

import { runPlaybackCommand } from '@/lib/player/playbackSession'
import playerProgressEmitter from '@/lib/player/progressListener'

export function seekWithinTrack(
	trackId: string,
	seconds: number,
	relative = false,
) {
	return runPlaybackCommand(async () => {
		const target = await Orpheus.seekWithinTrack(trackId, seconds, relative)
		if (target === null) return null
		const [track, duration, buffered] = await Promise.all([
			Orpheus.getCurrentTrack(),
			Orpheus.getDuration(),
			Orpheus.getBuffered(),
		])
		if (track?.id !== trackId) return null
		playerProgressEmitter.emitSticky('progress', {
			position: target,
			duration,
			buffered,
		})
		return target
	})
}
