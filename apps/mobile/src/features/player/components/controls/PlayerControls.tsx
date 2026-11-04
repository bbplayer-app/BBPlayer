import { Switch } from '@legendapp/state/react'

import { playbackContextStore$ } from '@/hooks/stores/playbackContextStore'

import { MusicControls } from './MusicControls'
import { PodcastControls } from './PodcastControls'

export function PlayerControls({
	onOpenQueue,
	compact = false,
}: {
	onOpenQueue: () => void
	compact?: boolean
}) {
	return (
		<Switch value={playbackContextStore$.context.mode}>
			{{
				podcast: () => <PodcastControls compact={compact} />,
				default: () => (
					<MusicControls
						onOpenQueue={onOpenQueue}
						compact={compact}
					/>
				),
			}}
		</Switch>
	)
}
