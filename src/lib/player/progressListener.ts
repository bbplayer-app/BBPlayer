import createStickyEmitter from '@/utils/sticky-mitt'
import { Orpheus } from '@roitium/expo-orpheus'

interface Events {
	progress: {
		position: number
		duration: number
		buffered: number
	}
}
const playerProgressEmitter = createStickyEmitter<Events>()

Orpheus.addListener('onPositionUpdate', (e) => {
	playerProgressEmitter.emitSticky('progress', {
		position: e.position,
		duration: e.duration,
		buffered: e.buffered,
	})
})

export default playerProgressEmitter
