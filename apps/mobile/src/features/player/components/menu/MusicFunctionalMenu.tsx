import { Divider, List } from 'react-native-paper'

import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { useModalStore } from '@/hooks/stores/useModalStore'

import {
	HighFreqButton,
	HighFreqRow,
	PlayerDownloadButton,
	PlayerModeSwitch,
	SharedTrackActions,
	ShareSongAction,
	type PlayerMenuContentProps,
} from './PlayerMenuContent'

export function MusicFunctionalMenu({
	onAction: handleAction,
}: PlayerMenuContentProps) {
	const currentTrack = useCurrentTrack()
	const openModal = useModalStore((state) => state.open)

	return (
		<>
			<HighFreqRow style={{ paddingBottom: 12 }}>
				<HighFreqButton
					testID='player-menu-speed'
					icon='speedometer'
					label='倍速'
					onPress={() =>
						handleAction(() => openModal('PlaybackSpeed', undefined))
					}
				/>
				<HighFreqButton
					testID='player-menu-sleep-timer'
					icon='timer-outline'
					label='定时关闭'
					onPress={() => handleAction(() => openModal('SleepTimer', undefined))}
				/>
				<PlayerDownloadButton onAction={handleAction} />
			</HighFreqRow>
			<PlayerModeSwitch onAction={handleAction} />
			<Divider />
			<SharedTrackActions onAction={handleAction} />
			<List.Item
				testID='player-menu-search-lyrics'
				title='搜索歌词'
				left={(props) => (
					<List.Icon
						{...props}
						icon='magnify'
					/>
				)}
				onPress={() =>
					handleAction(() => {
						if (!currentTrack) return
						openModal('ManualSearchLyrics', {
							uniqueKey: currentTrack.uniqueKey,
							initialQuery: currentTrack.title,
						})
					})
				}
			/>
			<List.Item
				testID='player-menu-share-lyrics'
				title='分享歌词'
				left={(props) => (
					<List.Icon
						{...props}
						icon='share-variant'
					/>
				)}
				onPress={() =>
					handleAction(() => {
						if (!currentTrack) return
						openModal('LyricsSelection', undefined)
					})
				}
			/>
			<ShareSongAction onAction={handleAction} />
		</>
	)
}
