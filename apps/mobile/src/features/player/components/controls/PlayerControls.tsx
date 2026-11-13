import { Switch } from '@legendapp/state/react'

import { playbackContextStore$ } from '@/hooks/stores/playbackContextStore'

import { MusicControls } from './MusicControls'
import { PodcastControls } from './PodcastControls'

/** 宽屏播放器右栏当前展示的面板，用于高亮对应的入口按钮。 */
export type PlayerSidePane = 'comments' | 'queue' | null

export function PlayerControls({
	onOpenQueue,
	onOpenComments,
	activePane = null,
	compact = false,
}: {
	onOpenQueue: () => void
	onOpenComments?: () => void
	activePane?: PlayerSidePane
	compact?: boolean
}) {
	return (
		<Switch value={playbackContextStore$.context.mode}>
			{{
				podcast: () => (
					<PodcastControls
						onOpenComments={onOpenComments}
						onOpenQueue={onOpenQueue}
						activePane={activePane}
						compact={compact}
					/>
				),
				default: () => (
					<MusicControls
						onOpenComments={onOpenComments}
						onOpenQueue={onOpenQueue}
						activePane={activePane}
						compact={compact}
					/>
				),
			}}
		</Switch>
	)
}
