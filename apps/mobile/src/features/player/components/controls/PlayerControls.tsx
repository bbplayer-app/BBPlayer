import { Switch } from '@legendapp/state/react'

import { playbackContextStore$ } from '@/hooks/stores/playbackContextStore'

import { MusicControls } from './MusicControls'
import { PodcastControls } from './PodcastControls'

export function PlayerControls({ onOpenQueue }: { onOpenQueue: () => void }) {
	return (
		<Switch value={playbackContextStore$.context.mode}>
			{{
				podcast: () => <PodcastControls />,
				default: () => <MusicControls onOpenQueue={onOpenQueue} />,
			}}
		</Switch>
	)
}
