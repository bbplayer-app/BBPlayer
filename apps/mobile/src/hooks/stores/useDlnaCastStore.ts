import type { DlnaDevice } from '@bbplayer/dlna'
import { create } from 'zustand'

interface DlnaCastState {
	castingDevice: DlnaDevice | null
	castingTitle: string | null
	playing: boolean
	position: number
	duration: number
	transportState: string | null
	setCasting: (device: DlnaDevice | null, title?: string | null) => void
	setPlayback: (
		patch: Partial<
			Pick<
				DlnaCastState,
				'playing' | 'position' | 'duration' | 'transportState'
			>
		>,
	) => void
}

const idlePlayback = {
	playing: false,
	position: 0,
	duration: 0,
	transportState: null,
}

export const useDlnaCastStore = create<DlnaCastState>((set) => ({
	castingDevice: null,
	castingTitle: null,
	...idlePlayback,
	setCasting: (device, title = null) =>
		set(
			device
				? {
						castingDevice: device,
						castingTitle: title,
						playing: true,
						position: 0,
						transportState: 'TRANSITIONING',
					}
				: { castingDevice: null, castingTitle: null, ...idlePlayback },
		),
	setPlayback: (patch) => set(patch),
}))
