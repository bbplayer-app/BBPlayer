import { alert } from '@/components/modals/AlertModal'
import { AppRuntime } from '@/lib/effect/runtime'
import { playlistService } from '@/lib/services/playlistService'
import type { Track } from '@/types/core/media'
import { toastAndLogError } from '@/utils/error-handling'
import { storage } from '@/utils/mmkv'
import { addToQueue } from '@/utils/player'
import { Effect } from 'effect'
import { useCallback } from 'react'
import type { MMKV } from 'react-native-mmkv'
import { useMMKVBoolean } from 'react-native-mmkv'

const SCOPE = 'UI.Playlist.Local.Player'

export const createPlayAllProgram = ({
	playlistId,
	startFromId,
}: {
	playlistId: number
	startFromId?: string
}) =>
	Effect.gen(function* () {
		const tracks = yield* playlistService
			.getPlaylistTracks(playlistId)
			.pipe(Effect.mapError((e) => ({ _tag: 'FetchError' as const, error: e })))

		const validTracks = tracks.filter((item) =>
			item.source === 'bilibili' ? item.bilibiliMetadata.videoIsValid : true,
		)

		if (validTracks.length === 0) {
			return
		}

		yield* Effect.tryPromise({
			try: () =>
				addToQueue({
					tracks: validTracks,
					playNow: true,
					clearQueue: true,
					startFromKey: startFromId,
					playNext: false,
				}),
			catch: (e) => ({ _tag: 'PlayError' as const, error: e }),
		})
	}).pipe(
		Effect.catchAll((taggedError) =>
			Effect.sync(() => {
				const message =
					taggedError._tag === 'FetchError'
						? '获取播放列表内容失败'
						: '播放全部失败'

				toastAndLogError(message, taggedError.error, SCOPE)
			}),
		),
	)

export function useLocalPlaylistPlayer(playlistId: number) {
	const [ignoreAlertReplacePlaylist, setIgnoreAlertReplacePlaylist] =
		useMMKVBoolean('ignore_alert_replace_playlist', storage as MMKV)

	const playAll = useCallback(
		async (startFromId?: string) => {
			const program = createPlayAllProgram({
				playlistId,
				startFromId,
			})

			await AppRuntime.runPromise(program)
		},
		[playlistId],
	)

	const handleTrackPress = useCallback(
		(track: Track) => {
			if (!ignoreAlertReplacePlaylist) {
				alert(
					'替换播放列表',
					'点击列表中的单曲会直接替换当前播放列表，是否继续？（下次不再提醒）',
					[
						{ text: '取消' },
						{
							text: '确定',
							onPress: () => {
								setIgnoreAlertReplacePlaylist(true)
								void playAll(track.uniqueKey)
							},
						},
					],
					{ cancelable: true },
				)
				return
			}
			void playAll(track.uniqueKey)
		},
		[ignoreAlertReplacePlaylist, playAll, setIgnoreAlertReplacePlaylist],
	)

	return { playAll, handleTrackPress }
}
