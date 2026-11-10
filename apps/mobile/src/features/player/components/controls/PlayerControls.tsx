import { Switch } from '@legendapp/state/react'

import { playbackContextStore$ } from '@/hooks/stores/playbackContextStore'

import { MusicControls } from './MusicControls'
import { PodcastControls } from './PodcastControls'

export function PlayerControls({
	onOpenQueue,
	onOpenComments,
	compact = false,
}: {
	onOpenQueue: () => void
	onOpenComments?: () => void
	compact?: boolean
}) {
	return (
		<Switch value={playbackContextStore$.context.mode}>
			{{
				podcast: () => <PodcastControls compact={compact} />,
				default: () => (
					<MusicControls
						onOpenComments={onOpenComments}
						onOpenQueue={onOpenQueue}
						compact={compact}
					/>
				),
			}}
		</Switch>
	)
}
