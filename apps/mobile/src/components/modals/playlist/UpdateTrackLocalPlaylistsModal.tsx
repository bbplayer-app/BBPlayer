import { FlashList } from '@shopify/flash-list'
import { memo, useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { Checkbox, Dialog, Text, useTheme } from 'react-native-paper'

import Button from '@/components/common/Button'
import { useUpdateTrackLocalPlaylists } from '@/hooks/mutations/db/playlist'
import {
	usePlaylistLists,
	usePlaylistsContainingTrack,
} from '@/hooks/queries/db/playlist'
import { useModalStore } from '@/hooks/stores/useModalStore'
import generateUniqueTrackKey from '@/lib/services/genKey'
import type { Playlist, Track } from '@/types/core/media'
import type { ListRenderItemInfoWithExtraData } from '@/types/flashlist'
import toast from '@/utils/toast'

const renderPlaylistItem = ({
	item,
	extraData,
}: ListRenderItemInfoWithExtraData<
	Playlist,
	{
		checkedPlaylistIds: number[]
		handleCheckboxPress: (id: number) => void
	}
>) => {
	if (!extraData) throw new Error('Extradata 不存在')
	const { checkedPlaylistIds, handleCheckboxPress } = extraData
	const isChecked = checkedPlaylistIds.includes(item.id)
	const isDisabled = item.type !== 'local'

	return (
		<PlaylistListItem
			id={item.id}
			title={item.title}
			onPress={handleCheckboxPress}
			isChecked={isChecked}
			isDisabled={isDisabled}
		/>
	)
}

const PlaylistListItem = memo(function PlaylistListItem({
	id,
	title,
	isChecked,
	isDisabled,
	onPress,
}: {
	id: number
	title: string
	onPress: (id: number) => void
	isChecked: boolean
	isDisabled: boolean
}) {
	const handlePress = useCallback(() => {
		onPress(id)
	}, [id, onPress])

	return (
		<Checkbox.Item
			label={title}
			status={isChecked ? 'checked' : 'unchecked'}
			onPress={handlePress}
			disabled={isDisabled}
		/>
	)
})
PlaylistListItem.displayName = 'PlaylistListItem'

const UpdateTrackLocalPlaylistsModal = memo(
	function UpdateTrackLocalPlaylistsModal({ track }: { track: Track }) {
		const { colors } = useTheme()
		const _close = useModalStore((state) => state.close)
		const close = useCallback(
			() => _close('UpdateTrackLocalPlaylists'),
			[_close],
		)
		const open = useModalStore((state) => state.open)

		const {
			data: allPlaylists,
			isPending: isPlaylistsPending,
			isError: isPlaylistsError,
			refetch: refetchPlaylists,
		} = usePlaylistLists()
		const filteredPlaylists = useMemo(
			() =>
				allPlaylists?.filter(
					(p) => p.type === 'local' && p.shareRole !== 'subscriber',
				),
			[allPlaylists],
		)

		const uniqueKey = generateUniqueTrackKey(track).unwrapOr(undefined)
		if (!uniqueKey) toast.error('无法生成 uniqueKey')
		const {
			data: playlistsContainingTrack,
			isPending: isContainingTrackPending,
			isError: isContainingTrackError,
			refetch: refetchContainingTrack,
		} = usePlaylistsContainingTrack(uniqueKey)

		const { mutate: updateTracks, isPending: isMutating } =
			useUpdateTrackLocalPlaylists()

		const [checkedPlaylistIds, setCheckedPlaylistIds] = useState<number[]>([])

		// 组合加载和错误状态
		const isLoading = isPlaylistsPending || isContainingTrackPending
		const isError = isPlaylistsError || isContainingTrackError

		const initialCheckedPlaylistIdSet = useMemo(() => {
			if (!playlistsContainingTrack) return new Set<number>()
			return new Set(playlistsContainingTrack.map((p) => p.id))
		}, [playlistsContainingTrack])
		const initialCheckedPlaylistIdList = useMemo(
			() => Array.from(initialCheckedPlaylistIdSet),
			[initialCheckedPlaylistIdSet],
		)

		const [prevInitialIds, setPrevInitialIds] = useState(
			initialCheckedPlaylistIdList,
		)
		if (prevInitialIds !== initialCheckedPlaylistIdList) {
			setPrevInitialIds(initialCheckedPlaylistIdList)
			setCheckedPlaylistIds(initialCheckedPlaylistIdList)
		}

		const handleCheckboxPress = useCallback((playlistId: number) => {
			setCheckedPlaylistIds((currentIds) => {
				const isCurrentlyChecked = currentIds.includes(playlistId)
				if (isCurrentlyChecked) {
					return currentIds.filter((id) => id !== playlistId)
				} else {
					return [...currentIds, playlistId]
				}
			})
		}, [])

		const handleConfirm = useCallback(() => {
			if (isMutating) return

			const currentCheckedIds = new Set(checkedPlaylistIds)

			const toAddPlaylistIds = [...currentCheckedIds].filter(
				(id) => !initialCheckedPlaylistIdSet.has(id),
			)
			const toRemovePlaylistIds = [...initialCheckedPlaylistIdSet].filter(
				(id) => !currentCheckedIds.has(id),
			)

			if (toAddPlaylistIds.length === 0 && toRemovePlaylistIds.length === 0) {
				close()
				return
			}

			updateTracks({
				toAddPlaylistIds,
				toRemovePlaylistIds,
				trackPayload: track,
				artistPayload: track.artist,
			})

			close()
		}, [
			isMutating,
			checkedPlaylistIds,
			initialCheckedPlaylistIdSet,
			updateTracks,
			track,
			close,
		])

		const extraData = useMemo(
			() => ({
				checkedPlaylistIds,
				handleCheckboxPress,
			}),
			[checkedPlaylistIds, handleCheckboxPress],
		)

		const handleDismiss = () => {
			if (isMutating) return
			close()
		}

		const handleRetry = () => {
			if (isPlaylistsError) void refetchPlaylists()
			if (isContainingTrackError) void refetchContainingTrack()
		}

		const keyExtractor = useCallback((item: Playlist) => item.id.toString(), [])

		const renderContent = () => {
			if (isLoading) {
				return (
					<Dialog.Content style={styles.loadingContainer}>
						<ActivityIndicator size={'large'} />
					</Dialog.Content>
				)
			}

			if (isError) {
				return (
					<>
						<Dialog.Content>
							<Text style={[styles.errorText, { color: colors.error }]}>
								加载歌单列表失败
							</Text>
						</Dialog.Content>
						<Dialog.Actions>
							<Button onPress={handleDismiss}>关闭</Button>
							<Button onPress={handleRetry}>重试</Button>
						</Dialog.Actions>
					</>
				)
			}

			return (
				<>
					<Dialog.ScrollArea style={styles.listContainer}>
						<FlashList
							data={filteredPlaylists ?? []}
							renderItem={renderPlaylistItem}
							keyExtractor={keyExtractor}
							extraData={extraData}
							ListEmptyComponent={
								<View style={styles.emptyListContainer}>
									<Text>你还没有创建任何歌单</Text>
								</View>
							}
						/>
					</Dialog.ScrollArea>
					<Dialog.Content>
						<Text variant='bodySmall'>
							*{'\u2009'}与远程同步或订阅的共享歌单不会显示
						</Text>
					</Dialog.Content>
					<Dialog.Actions style={styles.actionsContainer}>
						<Button
							onPress={() =>
								open('CreatePlaylist', { redirectToNewPlaylist: false })
							}
						>
							创建歌单
						</Button>
						<View style={styles.rightActionsContainer}>
							<Button
								onPress={handleDismiss}
								disabled={isMutating}
							>
								取消
							</Button>
							<Button
								onPress={handleConfirm}
								loading={isMutating}
								disabled={isMutating}
							>
								确认
							</Button>
						</View>
					</Dialog.Actions>
				</>
			)
		}

		return (
			<>
				<Dialog.Title>添加到歌单</Dialog.Title>
				{renderContent()}
			</>
		)
	},
)

const styles = StyleSheet.create({
	loadingContainer: {
		alignItems: 'center',
		paddingVertical: 20,
	},
	errorText: {
		textAlign: 'center',
	},
	listContainer: {
		minHeight: 300,
	},
	emptyListContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	actionsContainer: {
		justifyContent: 'space-between',
	},
	rightActionsContainer: {
		flexDirection: 'row',
		alignItems: 'center',
	},
})

UpdateTrackLocalPlaylistsModal.displayName = 'UpdateTrackLocalPlaylistsModal'

export default UpdateTrackLocalPlaylistsModal
