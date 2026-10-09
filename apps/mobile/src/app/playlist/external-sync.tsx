import { LegendList } from '@legendapp/list/react-native'
import { useQueryClient } from '@tanstack/react-query'
import { useImage } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import {
	Appbar,
	Banner,
	Divider,
	Icon,
	Text,
	TouchableRipple,
	useTheme,
} from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import Button from '@/components/common/Button'
import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import IconButton from '@/components/common/IconButton'
import { alert } from '@/components/modals/AlertModal'
import { PlaylistHeader } from '@/features/playlist/remote/components/PlaylistHeader'
import { PlaylistPageSkeleton } from '@/features/playlist/skeletons/PlaylistSkeleton'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { playlistKeys } from '@/hooks/queries/db/playlist'
import { useExternalPlaylist } from '@/hooks/queries/external-playlist/useExternalPlaylist'
import { useScreenTransitionReady } from '@/hooks/router/useScreenTransitionReady'
import useAppStore from '@/hooks/stores/useAppStore'
import {
	ExternalPlaylistSyncStoreProvider,
	useExternalPlaylistSyncStore,
	useExternalPlaylistSyncStoreApi,
} from '@/hooks/stores/useExternalPlaylistSyncStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { useDoubleTapScrollToTop } from '@/hooks/ui/useDoubleTapScrollToTop'
import { usePlaylistBackgroundColor } from '@/hooks/ui/usePlaylistBackgroundColor'
import { syncExternalPlaylistFacade } from '@/lib/facades/syncExternalPlaylist'
import { externalImportJobService } from '@/lib/services/externalImportJobService'
import type { MatchResult } from '@/lib/services/externalPlaylistService'
import {
	getMatchResultStatus,
	getTrackFingerprint,
	isMatchResultForTrack,
} from '@/lib/services/externalPlaylistService'
import { externalPlaylistImportWorker } from '@/lib/workers/ExternalPlaylistImportWorker'
import {
	LIST_ITEM_BORDER_RADIUS,
	LIST_ITEM_COVER_SIZE,
} from '@/theme/dimensions'
import type { GenericTrack } from '@/types/external_playlist'
import type { ListRenderItemInfoWithExtraData } from '@/types/legendlist'
import { resolveBilibiliImageUrl } from '@/utils/imageUrl'
import { formatDurationToHHMMSS, parseDurationString } from '@/utils/time'
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
		const rawResult = useExternalPlaylistSyncStore(
			(state) => state.results[index],
		)
		const result = isMatchResultForTrack(rawResult, track)
			? rawResult
			: undefined
		const status = getMatchResultStatus(result)
		const artistNames = track.artists.filter(Boolean).join(' / ')
		const trackDurationSec =
			track.duration > 0 ? Math.round(track.duration / 1000) : 0
		const matchedVideo = status === 'matched' ? result?.matchedVideo : null
		const matchedDurationSec = matchedVideo?.duration
			? parseDurationString(matchedVideo.duration)
			: trackDurationSec

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
						{/* 第一行：歌曲名称 - 歌曲作者 */}
						<Text
							variant='bodyMedium'
							numberOfLines={1}
							style={{ fontWeight: '600', marginBottom: 2 }}
						>
							{track.title}
							{track.translatedTitle && ` (${track.translatedTitle})`}
							{artistNames ? ` - ${artistNames}` : ''}
						</Text>

						{/* 第二行：音源名称 / 状态提示 */}
						{matchedVideo ? (
							<Text
								variant='bodySmall'
								numberOfLines={1}
								style={{
									color: theme.colors.primary,
									marginBottom: 2,
								}}
							>
								{matchedVideo.title.replace(/<em[^>]*>|<\/em>/g, '')}
							</Text>
						) : status === 'unmatched' ? (
							<Text
								variant='bodySmall'
								numberOfLines={1}
								style={{
									color: theme.colors.onSurfaceVariant,
									marginBottom: 2,
								}}
							>
								待匹配音源
							</Text>
						) : status === 'error' ? (
							<Text
								variant='bodySmall'
								numberOfLines={1}
								style={{
									color: theme.colors.error,
									marginBottom: 2,
								}}
							>
								匹配出错: {result?.errorMessage ?? '网络或接口异常，可稍后重试'}
							</Text>
						) : status === 'rate_limited' ? (
							<Text
								variant='bodySmall'
								numberOfLines={1}
								style={{
									color: theme.colors.error,
									marginBottom: 2,
								}}
							>
								请求暂时受限，进度已保存
							</Text>
						) : (
							<Text
								variant='bodySmall'
								numberOfLines={1}
								style={{
									color: theme.colors.onSurfaceVariant,
									marginBottom: 2,
								}}
							>
								{track.album || '待匹配音源'}
							</Text>
						)}

						{/* 第三行：UP主 · 时长 */}
						<Text
							variant='bodySmall'
							numberOfLines={1}
							style={{ color: theme.colors.onSurfaceVariant }}
						>
							{matchedVideo
								? `${matchedVideo.author || '未知 UP 主'}${matchedDurationSec > 0 ? ` · ${formatDurationToHHMMSS(matchedDurationSec)}` : ''}`
								: `待匹配 UP 主${trackDurationSec > 0 ? ` · ${formatDurationToHHMMSS(trackDurationSec)}` : ''}`}
						</Text>
					</View>
					<View style={styles.statusContainer}>
						<IconButton
							icon={
								status === 'pending' || status === 'unmatched'
									? 'clock-outline'
									: status === 'matched'
										? 'check-circle-outline'
										: status === 'rate_limited'
											? 'pause-circle-outline'
											: 'alert-circle-outline'
							}
							size={20}
							iconColor={
								status === 'pending' || status === 'unmatched'
									? theme.colors.onSurfaceVariant
									: status === 'matched'
										? theme.colors.primary
										: theme.colors.error
							}
						/>
						<IconButton
							icon='pencil'
							size={20}
							iconColor={theme.colors.onSurfaceVariant}
							onPress={onPress}
						/>
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
	const isListReady = useScreenTransitionReady()
	const { id, source } = useLocalSearchParams<{
		id: string
		source: import('@/lib/services/externalPlaylistService').ExternalPlaylistSource
	}>()
	const theme = useTheme()
	const insets = useSafeAreaInsets()
	const router = useRouter()
	const openModal = useModalStore((state) => state.open)
	const queryClient = useQueryClient()

	const { listRef, handleDoubleTap } = useDoubleTapScrollToTop()

	const { data, isLoading, error } = useExternalPlaylist(
		id ?? '',
		source ?? 'netease',
	)

	const coverRef = useImage(
		resolveBilibiliImageUrl(data?.playlist.coverUrl) ?? '',
		{
			onError: () => void 0,
		},
	)
	const {
		backgroundColor,
		primaryButtonColor,
		primaryButtonTextColor,
		secondaryButtonContainerColor,
		secondaryButtonIconColor,
	} = usePlaylistBackgroundColor(
		coverRef,
		theme.dark,
		theme.colors.background,
		data?.playlist.coverUrl,
	)

	const syncStore = useExternalPlaylistSyncStoreApi()
	const currentJobId = useExternalPlaylistSyncStore((s) => s.currentJobId)
	const setSessionKey = useExternalPlaylistSyncStore((s) => s.setSessionKey)
	const setResult = useExternalPlaylistSyncStore((s) => s.setResult)
	const startOrResumeMatching = useExternalPlaylistSyncStore(
		(s) => s.startOrResumeMatching,
	)
	const pauseMatching = useExternalPlaylistSyncStore((s) => s.pauseMatching)
	const syncing = useExternalPlaylistSyncStore((s) => s.syncing)
	const isRateLimited = useExternalPlaylistSyncStore((s) => s.isRateLimited)
	const progress = useExternalPlaylistSyncStore((s) => s.progress)
	const etaSeconds = useExternalPlaylistSyncStore((s) => s.etaSeconds)
	const matchedCount = useExternalPlaylistSyncStore((s) => s.matchedCount)
	const unmatchedCount = useExternalPlaylistSyncStore((s) => s.unmatchedCount)
	const errorCount = useExternalPlaylistSyncStore((s) => s.errorCount)
	const processedCount = useExternalPlaylistSyncStore((s) => s.processedCount)

	const [savedPlaylistId, setSavedPlaylistId] = useState<number | null>(null)
	const isSavingRef = useRef(false)

	const tracks = useMemo(() => data?.tracks ?? [], [data?.tracks])
	const sessionKey = useMemo(() => {
		if (!id || !source) return null
		return `${source}:${id}`
	}, [id, source])

	const lastInitializedSessionKeyRef = useRef<string | null>(null)

	useEffect(() => {
		if (!sessionKey || tracks.length === 0) return
		if (lastInitializedSessionKeyRef.current === sessionKey) return
		lastInitializedSessionKeyRef.current = sessionKey
		setSessionKey(sessionKey, tracks, data?.playlist)
	}, [data?.playlist, sessionKey, setSessionKey, tracks])

	useEffect(() => {
		return () => {
			if (externalPlaylistImportWorker.getActiveJobId() !== null) {
				toast.info('匹配正在后台继续进行，可在歌单列表查看实时进度')
			}
		}
	}, [])

	const hasProcessedAny = processedCount > 0
	const pendingCount = Math.max(0, tracks.length - processedCount)

	const proceedSave = useCallback(
		async (options?: { redirectToPlaylist?: boolean; silent?: boolean }) => {
			if (!data?.playlist || !data?.tracks || data.tracks.length === 0) {
				return null
			}
			if (isSavingRef.current) return savedPlaylistId
			isSavingRef.current = true

			const redirectToPlaylist = options?.redirectToPlaylist ?? true
			const silent = options?.silent ?? false

			if (savedPlaylistId) {
				isSavingRef.current = false
				if (redirectToPlaylist) {
					router.replace(`/playlist/local/${savedPlaylistId}`)
				}
				return savedPlaylistId
			}

			if (syncing) {
				await syncStore.getState().pauseMatchingAndWait()
			}

			const currentResults = syncStore.getState().results
			// 构建完整歌单的匹配结果（未处理歌曲作为 pending/unmatched 一并保留，不丢弃任何歌曲）
			const fullMatchResults: MatchResult[] = data.tracks.map(
				(track, index) => {
					const existing = currentResults[index]
					if (existing && isMatchResultForTrack(existing, track)) {
						return existing
					}
					return {
						track,
						matchedVideo: null,
						status: 'pending',
						trackFingerprint: getTrackFingerprint(track),
					}
				},
			)

			const loadingToast = silent
				? null
				: toast.loading('正在保存为本地歌单...')
			const coverUrl = data.playlist.coverUrl ?? ''
			const description = data.playlist.description ?? ''

			try {
				const saveResult = await syncExternalPlaylistFacade.saveMatchedPlaylist(
					{
						title: data.playlist.title,
						coverUrl,
						description,
					},
					fullMatchResults,
					{
						jobId: currentJobId ?? undefined,
						source: source ?? 'netease',
						sourcePlaylistId: id ?? data.playlist.id,
					},
				)

				if (loadingToast) toast.dismiss(loadingToast)

				if (saveResult.isErr()) {
					if (!silent) toast.error(`保存失败: ${saveResult.error.message}`)
					isSavingRef.current = false
					return null
				}

				const playlistId = saveResult.value
				setSavedPlaylistId(playlistId)
				await queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistLists(),
				})

				if (!silent) {
					toast.success(`已保存为本地歌单《${data.playlist.title}》`)
				}

				if (redirectToPlaylist) {
					useModalStore
						.getState()
						.doAfterModalHostClosed(() =>
							router.replace(`/playlist/local/${playlistId}`),
						)
				}
				isSavingRef.current = false
				return playlistId
			} catch {
				if (loadingToast) toast.dismiss(loadingToast)
				if (!silent) toast.error('保存失败')
				isSavingRef.current = false
				return null
			}
		},
		[
			currentJobId,
			data,
			id,
			queryClient,
			router,
			savedPlaylistId,
			source,
			syncStore,
			syncing,
		],
	)

	const handleBack = useCallback(() => {
		router.back()
	}, [router])

	const handleDiscardDraft = useCallback(() => {
		if (!currentJobId) {
			router.back()
			return
		}
		alert(
			'放弃导入草稿',
			`确定要放弃并删除《${data?.playlist.title || id}》的导入草稿吗？已匹配的临时进度将被清除。`,
			[
				{ text: '取消' },
				{
					text: '放弃并删除',
					onPress: () => {
						externalPlaylistImportWorker.cancel(currentJobId)
						externalImportJobService.deleteJob(currentJobId)
						toast.success('已放弃导入草稿')
						router.back()
					},
				},
			],
			{ cancelable: true },
		)
	}, [currentJobId, data?.playlist.title, id, router])

	const syncButtonText = syncing
		? '暂停'
		: !hasProcessedAny
			? '开始匹配'
			: pendingCount > 0
				? '继续匹配'
				: errorCount > 0
					? '继续匹配失败项'
					: unmatchedCount > 0
						? '重新匹配未匹配项'
						: '重新匹配全部'

	const handleSync = () => {
		if (!data?.tracks) return

		if (syncing) {
			pauseMatching()
			toast.info('已暂停匹配')
			return
		}

		void startOrResumeMatching()
	}

	const handleOpenManualMatch = useCallback(
		(track: GenericTrack, index: number) => {
			openModal('ManualMatchExternalSync', {
				track,
				initialQuery: `${track.title} - ${track.artists.join(' ')}`,
				onMatch: (result) =>
					setResult(index, {
						...result,
						track,
						status: result.matchedVideo ? 'matched' : 'unmatched',
						trackFingerprint: getTrackFingerprint(track),
					}),
			})
		},
		[openModal, setResult],
	)

	const extraData = useMemo(
		() => ({
			openManualMatch: handleOpenManualMatch,
		}),
		[handleOpenManualMatch],
	)

	const keyExtractor = useCallback(
		(item: GenericTrack, index: number) =>
			`${index}-${getTrackFingerprint(item)}`,
		[],
	)

	if (isLoading || !isListReady) {
		return <PlaylistPageSkeleton animate={isListReady} />
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

	const summaryText = `共 ${tracks.length} 首 · 已匹配 ${matchedCount} 首 · 未匹配 ${unmatchedCount} 首${errorCount > 0 ? ` · 待重试 ${errorCount} 首` : ''}`

	return (
		<View style={{ flex: 1, backgroundColor }}>
			<Appbar.Header
				elevated
				style={{ backgroundColor: 'transparent' }}
			>
				<Appbar.BackAction onPress={handleBack} />
				<Appbar.Content
					title='外部歌单匹配'
					onPress={handleDoubleTap}
				/>

				<Appbar.Action
					icon='trash-can-outline'
					onPress={handleDiscardDraft}
				/>
			</Appbar.Header>
			<LegendList
				ref={listRef}
				data={tracks}
				renderItem={renderItem}
				extraData={extraData}
				keyExtractor={keyExtractor}
				recycleItems
				estimatedItemSize={76}
				ItemSeparatorComponent={ItemSeparator}
				contentContainerStyle={{
					paddingBottom: insets.bottom,
				}}
				ListHeaderComponent={
					<View>
						<Banner
							visible={tracks.length > 0}
							actions={
								savedPlaylistId
									? [
											{
												label: '前往本地歌单',
												onPress: () =>
													router.replace(`/playlist/local/${savedPlaylistId}`),
											},
										]
									: [
											{
												label: '保存为本地歌单',
												onPress: () =>
													void proceedSave({ redirectToPlaylist: true }),
											},
										]
							}
							icon={
								savedPlaylistId || (pendingCount === 0 && hasProcessedAny)
									? 'check-circle-outline'
									: 'information'
							}
						>
							{savedPlaylistId
								? `${summaryText}\n已保存为本地歌单，所有歌曲（含待匹配歌曲）均已完整收录在播放列表中。`
								: pendingCount === 0 && hasProcessedAny
									? `${summaryText}\n全单匹配已完成！点击【保存为本地歌单】即可保存入库。`
									: `${summaryText}\n受哔哩哔哩接口限制匹配较慢，支持后台自动匹配。直接返回可在歌单列表顶部继续查看进度。`}
						</Banner>
						<PlaylistHeader
							id={data.playlist.id}
							title={data.playlist.title}
							description={[
								data.playlist.tags && data.playlist.tags.length > 0
									? `标签：${data.playlist.tags.map((t) => `#${t}`).join('  ')}`
									: '',
								data.playlist.description?.trim()
									? `简介：${data.playlist.description.trim()}`
									: '简介：暂无简介',
							]
								.filter(Boolean)
								.join('\n')}
							cover={coverRef ?? data.playlist.coverUrl ?? ''}
							primaryButtonColor={primaryButtonColor}
							primaryButtonTextColor={primaryButtonTextColor}
							secondaryButtonContainerColor={secondaryButtonContainerColor}
							secondaryButtonIconColor={secondaryButtonIconColor}
							subtitles={[
								`创建者：${data.playlist.author.name}`,
								...(data.playlist.createTime
									? [`创建于：${data.playlist.createTime}`]
									: data.playlist.updateTime
										? [`更新于：${data.playlist.updateTime}`]
										: []),
								`${data.playlist.trackCount} 首歌曲`,
							]}
						/>
					</View>
				}
				role='list'
			/>

			<ExternalPlaylistSyncFooter
				onSync={handleSync}
				syncing={syncing}
				isRateLimited={isRateLimited}
				progress={progress}
				etaSeconds={etaSeconds}
				buttonText={syncButtonText}
				primaryButtonColor={primaryButtonColor}
				primaryButtonTextColor={primaryButtonTextColor}
			/>
		</View>
	)
}

const ExternalPlaylistSyncFooter = ({
	onSync,
	syncing,
	isRateLimited,
	progress,
	etaSeconds,
	buttonText,
	primaryButtonColor,
	primaryButtonTextColor,
}: {
	onSync: () => void
	syncing: boolean
	isRateLimited: boolean
	progress: number
	etaSeconds: number | null
	buttonText: string
	primaryButtonColor?: string
	primaryButtonTextColor?: string
}) => {
	const theme = useTheme()
	const insets = useSafeAreaInsets()
	const currentTrack = useCurrentTrack()
	const nowPlayingBarStyle = useAppStore((s) => s.settings.nowPlayingBarStyle)
	const nowPlayingOffset = currentTrack
		? nowPlayingBarStyle === 'bottom'
			? 70
			: 60
		: 0

	const etaText =
		etaSeconds !== null
			? etaSeconds >= 60
				? `预计还需要约 ${(etaSeconds / 60).toFixed(1)} 分钟`
				: `预计还需要约 ${Math.max(1, Math.round(etaSeconds))} 秒`
			: '正在预估时间...'

	return (
		<View
			style={[
				styles.footer,
				{
					backgroundColor: theme.colors.elevation.level2,
					paddingBottom: insets.bottom + 16 + nowPlayingOffset,
				},
			]}
		>
			<View style={styles.progressContainer}>
				{isRateLimited && (
					<View
						style={{
							flexDirection: 'row',
							alignItems: 'center',
							marginBottom: 8,
							justifyContent: 'center',
						}}
					>
						<Icon
							source='alert-circle-outline'
							size={16}
							color={theme.colors.error}
						/>
						<Text
							variant='bodySmall'
							style={{
								color: theme.colors.error,
								marginLeft: 6,
							}}
						>
							触发哔哩哔哩接口风控，已自动暂停，可稍后重试
						</Text>
					</View>
				)}
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
									{etaText}
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
							{
								backgroundColor:
									primaryButtonColor ?? theme.colors.primaryContainer,
							},
						]}
					>
						<Text
							style={{
								color:
									primaryButtonTextColor ?? theme.colors.onPrimaryContainer,
							}}
						>
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
		alignItems: 'center',
	},
	itemContent: {
		flex: 1,
		justifyContent: 'center',
		marginLeft: 12,
	},
	statusContainer: {
		marginLeft: 4,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'flex-end',
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
