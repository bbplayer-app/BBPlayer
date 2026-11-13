import { Orpheus, RepeatMode } from '@bbplayer/orpheus'
import { useEffect } from 'react'
import { AppState } from 'react-native'

import {
	orpheusQueryKeys,
	useShuffleMode,
	useSleepTimerEndTime,
} from '@/hooks/queries/orpheus'
import { useTracedQuery } from '@/hooks/utils/useTracedQuery'
import { queryClient } from '@/lib/config/queryClient'

const repeatKey = [...orpheusQueryKeys.all, 'repeatMode'] as const
const speedKey = [...orpheusQueryKeys.all, 'playbackSpeed'] as const

export function usePlaybackOptions() {
	const { data: shuffle = false } = useShuffleMode()

	const { data: repeat = RepeatMode.OFF } = useTracedQuery({
		span: { name: 'player.repeat_mode' },
		queryKey: repeatKey,
		queryFn: () => Orpheus.getRepeatMode(),
	})

	const { data: speed = 1 } = useTracedQuery({
		span: { name: 'player.playback_speed' },
		queryKey: speedKey,
		queryFn: () => Orpheus.getPlaybackSpeed(),
	})

	const { data: sleepEndTime } = useSleepTimerEndTime()
	useEffect(() => {
		const speedSubscription = Orpheus.addListener(
			'onPlaybackSpeedChanged',
			({ speed: value }) => {
				queryClient.setQueryData(speedKey, value)
			},
		)

		const foreground = AppState.addEventListener('change', (state) => {
			if (state === 'active')
				void queryClient.invalidateQueries({ queryKey: orpheusQueryKeys.all })
		})

		return () => {
			speedSubscription.remove()
			foreground.remove()
		}
	}, [])

	return { shuffle, repeat, speed, sleepEndTime }
}

export async function setPlayerShuffleMode(enabled: boolean) {
	await Orpheus.setShuffleMode(enabled)
	queryClient.setQueryData(orpheusQueryKeys.shuffleMode(), enabled)
}

export async function setPlayerRepeatMode(mode: RepeatMode) {
	await Orpheus.setRepeatMode(mode)
	queryClient.setQueryData(repeatKey, mode)
}
