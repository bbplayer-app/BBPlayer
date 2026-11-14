import { Switch } from '@legendapp/state/react'

import { playbackContextStore$ } from '@/hooks/stores/playbackContextStore'

import { MusicControls } from './MusicControls'
import { PodcastControls } from './PodcastControls'

export function PlayerControls({
	onOpenQueue,
	commentsPane = false,
	compact = false,
}: {
	onOpenQueue: () => void
	commentsPane?: boolean
	compact?: boolean
}) {
	return (
		<Switch value={playbackContextStore$.context.mode}>
			{{
				podcast: () => (
					<PodcastControls
						commentsPane={commentsPane}
						compact={compact}
					/>
				),
				default: () => (
					<MusicControls
						onOpenQueue={onOpenQueue}
						commentsPane={commentsPane}
						compact={compact}
					/>
				),
			}}
		</Switch>
	)
}
