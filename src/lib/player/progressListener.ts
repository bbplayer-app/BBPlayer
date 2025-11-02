import createStickyEmitter from '@/utils/sticky-mitt'
import TrackPlayer, { Event } from 'react-native-track-player'

interface Events {
	progress: {
		position: number
		duration: number
		buffered: number
	}
}
const playerProgressEmitter = createStickyEmitter<Events>()

TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, (e) => {
	playerProgressEmitter.emit('progress', {
		position: e.position,
		duration: e.duration,
		buffered: e.buffered,
	})
})

export default playerProgressEmitter
