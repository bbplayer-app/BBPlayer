import { Orpheus } from '@bbplayer/orpheus'

import playerProgressEmitter from '@/lib/player/progressListener'

export async function seekWithinTrack(
	trackId: string,
	seconds: number,
	relative = false,
	isCurrent: () => boolean = () => true,
) {
	const [track, duration, position, buffered] = await Promise.all([
		Orpheus.getCurrentTrack(),
		Orpheus.getDuration(),
		Orpheus.getPosition(),
		Orpheus.getBuffered(),
	])
	if (
		!isCurrent() ||
		track?.id !== trackId ||
		!Number.isFinite(seconds) ||
		!Number.isFinite(duration) ||
		duration <= 0
	)
		return null
	const target = Math.max(
		0,
		Math.min(
			relative ? position + seconds : seconds,
			Math.max(0, duration - 0.001),
		),
	)
	if (!isCurrent() || !(await Orpheus.seekToForTrack(trackId, target)))
		return null
	if (!isCurrent() || (await Orpheus.getCurrentTrack())?.id !== trackId)
		return null
	playerProgressEmitter.emitSticky('progress', {
		position: target,
		duration,
		buffered,
	})
	return target
}
