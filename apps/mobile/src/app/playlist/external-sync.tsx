import { FlashList } from '@shopify/flash-list'
import { useQueryClient } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import {
	Appbar,
	Banner,
	Divider,
	Text,
	TouchableRipple,
	useTheme,
} from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import Button from '@/components/common/Button'
import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import IconButton from '@/components/common/IconButton'
import { PlaylistHeader } from '@/features/playlist/remote/components/PlaylistHeader'
import { PlaylistPageSkeleton } from '@/features/playlist/skeletons/PlaylistSkeleton'
import { playlistKeys } from '@/hooks/queries/db/playlist'
import { useExternalPlaylist } from '@/hooks/queries/external-playlist/useExternalPlaylist'
import usePreventRemove from '@/hooks/router/usePreventRemove'
import {
	ExternalPlaylistSyncStoreProvider,
	useExternalPlaylistSyncStore,
} from '@/hooks/stores/useExternalPlaylistSyncStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { useDoubleTapScrollToTop } from '@/hooks/ui/useDoubleTapScrollToTop'
import { syncExternalPlaylistFacade } from '@/lib/facades/syncExternalPlaylist'
import { externalPlaylistService } from '@/lib/services/externalPlaylistService'
import {
	LIST_ITEM_BORDER_RADIUS,
	LIST_ITEM_COVER_SIZE,
} from '@/theme/dimensions'
import type { GenericTrack } from '@/types/external_playlist'
import type { ListRenderItemInfoWithExtraData } from '@/types/flashlist'
import toast from '@/utils/toast'

const ItemSeparator = () => <Divider />

const SyncTrackItem = memo(
	({
		index,
		track,
		onPress,
	}: {
		index: number
		track: GenericTrack
		onPress: () => void
	}) => {
		const theme = useTheme()
		const result = useExternalPlaylistSyncStore((state) => state.results[index])

		return (
			<View style={styles.itemContainer}>
				<View style={styles.itemInner}>
					<CoverWithPlaceHolder
						id={`${index}`}
						title={track.title}
						cover={track.coverUrl}
						size={LIST_ITEM_COVER_SIZE}
						borderRadius={LIST_ITEM_BORDER_RADIUS}
					/>
					<View style={styles.itemContent}>
						<Text
							variant='titleMedium'
							style={{ fontWeight: '600', marginBottom: 2 }}
						>
							{track.title}
							{track.translatedTitle && ` (${track.translatedTitle})`}
						</Text>
						<Text
							variant='bodySmall'
							style={{ color: theme.colors.onSurfaceVariant }}
						>
							{track.artists.join(', ')} - {track.album}
						</Text>
						{result?.matchedVideo && (
							<View
								style={{
									marginTop: 8,
									backgroundColor: theme.colors.surfaceVariant,
									padding: 8,
									borderRadius: 8,
								}}
							>
								<Text
									variant='bodySmall'
									style={{
										color: theme.colors.primary,
										fontWeight: 'bold',
										marginBottom: 2,
									}}
								>
									已匹配:{' '}
									{result.matchedVideo.title
										.replace(/<em class="keyword">/g, '')
										.replace(/<\/em>/g, '')}
								</Text>
								<Text
									variant='bodySmall'
									style={{ color: theme.colors.onSurfaceVariant }}
								>
									UP主: {result.matchedVideo.author}
								</Text>
							</View>
						)}
					</View>
					<View style={styles.statusContainer}>
						{!result ? (
							<IconButton
								icon='clock-outline'
								size={20}
								iconColor={theme.colors.onSurfaceVariant}
							/>
						) : !result.matchedVideo ? (
							<View style={{ alignItems: 'flex-end' }}>
								<IconButton
									icon='alert-circle-outline'
									size={20}
									iconColor={theme.colors.error}
								/>
								<IconButton
									icon='pencil'
									size={20}
									onPress={onPress}
									mode='contained-tonal'
								/>
							</View>
						) : (
							<View style={{ alignItems: 'flex-end' }}>
								<IconButton
									icon='check-circle-outline'
									size={20}
									iconColor={theme.colors.primary}
								/>
								<IconButton
									icon='pencil'
									size={20}
									onPress={onPress}
									mode='contained-tonal'
								/>
							</View>
						)}
					</View>
				</View>
			</View>
		)
	},
)
SyncTrackItem.displayName = 'SyncTrackItem'

const renderItem = ({
	item,
	index,
	extraData,
}: ListRenderItemInfoWithExtraData<
	GenericTrack,
	{
		openManualMatch: (track: GenericTrack, index: number) => void
		syncing: boolean
	}
>) => {
	if (!extraData) return null
	return (
		<SyncTrackItem
			index={index}
			track={item}
			onPress={() => extraData.openManualMatch(item, index)}
		/>
	)
}

const ExternalPlaylistSyncPageInner = () => {
	const { id, source } = useLocalSearchParams<{
		id: string
		source: 'netease' | 'qq'
	}>()
	const theme = useTheme()
	const insets = useSafeAreaInsets()
	const router = useRouter()
	const openModal = useModalStore((state) => state.open)
	const queryClient = useQueryClient()

	const { listRef, handleDoubleTap } = useDoubleTapScrollToTop<GenericTrack>()

	const { data, isLoading, error } = useExternalPlaylist(
		id ?? '',
		source ?? 'netease',
	)

	const {
		setSyncing,
		setProgress,
		setResult,
		reset,
		setSessionKey,
		clearSession,
		syncing,
		progress,
		results,
	} = useExternalPlaylistSyncStore((state) => state)
	const tracks = data?.tracks ?? []
	const sessionKey = useMemo(() => {
		if (!id || !source) return null
		return `${source}:${id}`
	}, [id, source])
	const abortControllerRef = useRef<AbortController | null>(null)
	const sessionStartTimeRef = useRef<number>(0)

	useEffect(() => {
		if (!sessionKey || tracks.length === 0) return
		setSessionKey(sessionKey, tracks.length)
	}, [sessionKey, setSessionKey, tracks.length])

	useEffect(() => {
		return () => {
			abortControllerRef.current?.abort()
			setSyncing(false)
		}
	}, [setSyncing])

	const [etaSeconds, setEtaSeconds] = useState<number | null>(null)

	const [isExiting, setIsExiting] = useState(false)

	const hasResults = Object.keys(results).length > 0 && !isExiting
	usePreventRemove(hasResults, () => {
		openModal('Alert', {
			title: '确定要退出吗？',
			message:
				'当前匹配结果已临时保存，下次进入这个歌单可以继续匹配。匹配完成后仍需要手动保存到本地歌单。',
			buttons: [
				{
					text: '取消',
				},
				{
					text: '退出',
					onPress: () => {
						setIsExiting(true)
						useModalStore.getState().doAfterModalHostClosed(() => router.back())
					},
				},
			],
		})
	})

	const handleSave = async () => {
		if (!data?.playlist || !data?.tracks || !results) return
		const matchResults = data.tracks
			.map((_, index) => results[index])
			.filter((result) => result !== undefined)
		if (matchResults.length === 0) {
			toast.error('没有可保存的内容')
			return
		}

		const unmatchedCount = matchResults.filter(
			(r) => r.matchedVideo === null,
		).length

		const unprocessedCount = data.tracks.length - matchResults.length

		const proceedSave = async () => {
			const loadingToast = toast.loading('正在保存到本地...')
			const coverUrl = data.playlist.coverUrl ?? ''
			const description = data.playlist.description ?? ''
			try {
				const saveResult = await syncExternalPlaylistFacade.saveMatchedPlaylist(
					{
						title: data.playlist.title,
						coverUrl,
						description,
					},
					matchResults,
				)

				if (saveResult.isErr()) {
					toast.error(`保存失败: ${saveResult.error.message}`)
				} else {
					toast.success('歌单已保存到本地')
					await queryClient.invalidateQueries({
						queryKey: playlistKeys.playlistLists(),
					})
					clearSession()
					const playlistId = saveResult.value
					useModalStore
						.getState()
						.doAfterModalHostClosed(() =>
							router.replace(`/playlist/local/${playlistId}`),
						)
				}
			} catch {
				toast.error('保存失败')
			}
			toast.dismiss(loadingToast)
		}

		if (unmatchedCount > 0 || unprocessedCount > 0) {
			const messages = []
			if (unprocessedCount > 0) {
				messages.push(`还有 ${unprocessedCount} 首歌曲未进行匹配`)
			}
			if (unmatchedCount > 0) {
				messages.push(`还有 ${unmatchedCount} 首歌曲未匹配到视频`)
			}

			openModal('Alert', {
				title: '存在未完成的项目',
				message: `${messages.join('，')}。如果继续，这些已匹配的歌曲将被保存，未匹配的将被忽略。建议您完成匹配或手动匹配剩余歌曲。`,
				buttons: [
					{
						text: '去手动匹配',
					},
					{
						text: '仍要保存',
						onPress: proceedSave,
					},
				],
			})
		} else {
			await proceedSave()
		}
	}

	const processedIndexes = Object.keys(results).map(Number)
	const hasProcessedAny = processedIndexes.length > 0
	const failedIndexes = processedIndexes.filter(
		(index) => results[index]?.matchedVideo === null,
	)
	const unprocessedIndexes = tracks
		.map((_, index) => index)
		.filter((index) => !Object.hasOwn(results, index))
	const syncButtonText = syncing
		? '暂停'
		: !hasProcessedAny
			? '开始匹配'
			: unprocessedIndexes.length > 0
				? '继续匹配'
				: failedIndexes.length > 0
					? '继续匹配失败项'
					: '重新匹配全部'

	const handleSync = async () => {
		if (!data?.tracks) return

		if (syncing) {
			abortControllerRef.current?.abort()
			setSyncing(false)
			setEtaSeconds(null)
			toast.info('已暂停匹配')
			return
		}

		let indexesToProcess = unprocessedIndexes

		if (indexesToProcess.length === 0 && failedIndexes.length > 0) {
			indexesToProcess = failedIndexes
		}

		if (indexesToProcess.length === 0) {
			reset()
			indexesToProcess = data.tracks.map((_, index) => index)
		}

		setSyncing(true)
		setProgress(0, indexesToProcess.length)

		abortControllerRef.current = new AbortController()
		sessionStartTimeRef.current = Date.now()

		// Initial rough estimate
		setEtaSeconds(indexesToProcess.length * 1.2)

		const result = await externalPlaylistService.matchExternalPlaylist(
			data.tracks,
			(current, total, matchResult, trackIndex) => {
				setResult(trackIndex, matchResult)
				setProgress(current, total)

				// ETA Calculation
				const now = Date.now()
				const elapsed = now - sessionStartTimeRef.current
				const processedInSession = current

				if (processedInSession > 0) {
					const avgTimePerItem = elapsed / processedInSession
					const remainingItems = total - current
					const eta = (avgTimePerItem * remainingItems) / 1000
					setEtaSeconds(eta)
				}
			},
			{
				trackIndexes: indexesToProcess,
				signal: abortControllerRef.current.signal,
			},
		)

		setSyncing(false)
		setEtaSeconds(null)
		if (result.isErr()) {
			if (result.error.message !== 'Aborted') {
				toast.error(`匹配出错: ${result.error.message}`)
			}
		} else {
			toast.success('匹配完成')
		}
	}

	const handleOpenManualMatch = useCallback(
		(track: GenericTrack, index: number) => {
			openModal('ManualMatchExternalSync', {
				track,
				initialQuery: `${track.title} - ${track.artists.join(' ')}`,
				onMatch: (result) => setResult(index, result),
			})
		},
		[openModal, setResult],
	)

	const keyExtractor = useCallback(
		(item: GenericTrack, index: number) => `${index}-${item.title}`,
		[],
	)

	if (isLoading) {
		return <PlaylistPageSkeleton />
	}

	if (error || !data) {
		return (
			<View style={styles.center}>
				<Text style={{ color: theme.colors.error }}>
					加载失败: {error?.message ?? '未知错误'}
				</Text>
			</View>
		)
	}

	return (
		<View style={{ flex: 1, backgroundColor: theme.colors.background }}>
			<Appbar.Header>
				<Appbar.BackAction onPress={router.back} />
				<Appbar.Content
					title='外部歌单匹配'
					onPress={handleDoubleTap}
				/>
				<Appbar.Action
					icon='check'
					onPress={handleSave}
					disabled={!hasResults}
				/>
			</Appbar.Header>
			<Banner
				visible={hasResults}
				actions={[
					{
						label: '立即保存',
						onPress: handleSave,
					},
				]}
				icon='information'
			>
				匹配进度已临时保存。完成后请点击右上角或下方的保存按钮写入本地歌单。
			</Banner>
			<FlashList
				ref={listRef}
				data={tracks}
				renderItem={renderItem}
				extraData={{
					openManualMatch: handleOpenManualMatch,
					syncing,
				}}
				keyExtractor={keyExtractor}
				ItemSeparatorComponent={ItemSeparator}
				contentContainerStyle={{
					paddingBottom: insets.bottom,
				}}
				ListHeaderComponent={
					<PlaylistHeader
						id={data.playlist.id}
						title={data.playlist.title}
						description={data.playlist.description ?? ''}
						cover={data.playlist.coverUrl ?? ''}
						subtitles={[
							data.playlist.author.name,
							`${data.playlist.trackCount} 首歌曲`,
						]}
						mainButtonIcon='check'
						mainButtonText='保存'
					/>
				}
				role='list'
			/>

			<ExternalPlaylistSyncFooter
				onSync={handleSync}
				syncing={syncing}
				progress={progress}
				etaSeconds={etaSeconds}
				buttonText={syncButtonText}
			/>
		</View>
	)
}

const ExternalPlaylistSyncFooter = ({
	onSync,
	syncing,
	progress,
	etaSeconds,
	buttonText,
}: {
	onSync: () => void
	syncing: boolean
	progress: number
	etaSeconds: number | null
	buttonText: string
}) => {
	const theme = useTheme()
	const insets = useSafeAreaInsets()

	const etaText =
		etaSeconds !== null
			? etaSeconds > 60
				? `${(etaSeconds / 60).toFixed(1)} 分 (ETA)`
				: `${etaSeconds.toFixed(0)} 秒 (ETA)`
			: '计算中...'

	return (
		<View
			style={[
				styles.footer,
				{
					backgroundColor: theme.colors.elevation.level2,
					paddingBottom: insets.bottom + 16,
				},
			]}
		>
			<View style={styles.progressContainer}>
				{syncing ? (
					<View
						style={[
							styles.syncingContainer,
							{ justifyContent: 'space-between', width: '100%' },
						]}
					>
						<View style={{ flexDirection: 'row', alignItems: 'center' }}>
							<ActivityIndicator color={theme.colors.primary} />
							<View style={{ marginLeft: 12 }}>
								<Text variant='bodyMedium'>
									正在匹配... {(progress * 100).toFixed(0)}%
								</Text>
								<Text
									variant='bodySmall'
									style={{ color: theme.colors.outline }}
								>
									剩余 {etaText}
								</Text>
							</View>
						</View>
						<Button
							icon='pause'
							mode='contained-tonal'
							onPress={onSync}
						>
							暂停
						</Button>
					</View>
				) : (
					<TouchableRipple
						onPress={onSync}
						style={[
							styles.button,
							{ backgroundColor: theme.colors.primaryContainer },
						]}
					>
						<Text style={{ color: theme.colors.onPrimaryContainer }}>
							{buttonText}
						</Text>
					</TouchableRipple>
				)}
			</View>
		</View>
	)
}

export default function ExternalPlaylistSyncPage() {
	return (
		<ExternalPlaylistSyncStoreProvider>
			<ExternalPlaylistSyncPageInner />
		</ExternalPlaylistSyncStoreProvider>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	center: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	itemContainer: {
		paddingHorizontal: 16,
		paddingVertical: 12,
	},
	itemInner: {
		flexDirection: 'row',
		alignItems: 'flex-start',
	},
	itemContent: {
		flex: 1,
		justifyContent: 'center',
		marginLeft: 12,
	},
	statusContainer: {
		marginLeft: 8,
		minWidth: 60,
		alignItems: 'flex-end',
	},
	footer: {
		padding: 16,
		borderTopLeftRadius: 16,
		borderTopRightRadius: 16,
		elevation: 4,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: -2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
	},
	progressContainer: {
		alignItems: 'center',
	},
	syncingContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		height: 48,
	},
	button: {
		height: 48,
		paddingHorizontal: 32,
		borderRadius: 24,
		justifyContent: 'center',
		alignItems: 'center',
	},
})
