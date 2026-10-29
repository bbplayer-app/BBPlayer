import { useQueryClient } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import {
	Appbar,
	Banner,
	Button,
	Chip,
	Divider,
	Icon,
	Text,
	TouchableRipple,
	useTheme,
} from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import {
	playlistKeys,
	usePlaylistContents,
	usePlaylistMetadata,
} from '@/hooks/queries/db/playlist'
import { useModalStore } from '@/hooks/stores/useModalStore'
import {
	externalImportJobService,
	type ExternalTrackMappingRecord,
	type ExternalTrackMatchStatus,
} from '@/lib/services/externalImportJobService'
import { externalPlaylistImportWorker } from '@/lib/workers/ExternalPlaylistImportWorker'
import {
	LIST_ITEM_BORDER_RADIUS,
	LIST_ITEM_COVER_SIZE,
} from '@/theme/dimensions'
import type { Track } from '@/types/core/media'
import type { GenericTrack } from '@/types/external_playlist'
import { toastAndLogError } from '@/utils/error-handling'
import toast from '@/utils/toast'

const SCOPE = 'UI.Playlist.Unmatched'

interface UnmatchedItemData {
	track: Track
	mapping?: ExternalTrackMappingRecord
	status: ExternalTrackMatchStatus
	errorMessage?: string
	isMatched: boolean
	matchedTitle?: string
}

const UnmatchedTrackRow = memo(
	({
		item,
		onManualMatch,
	}: {
		item: UnmatchedItemData
		onManualMatch: (track: Track) => void
	}) => {
		const { colors } = useTheme()
		const { track, mapping, status, isMatched, matchedTitle } = item

		const isError = status === 'error' || status === 'rate_limited'
		const statusLabel = isMatched
			? '已匹配'
			: status === 'rate_limited'
				? '请求受限'
				: status === 'error'
					? '网络异常'
					: '待匹配'

		const statusBgColor = isMatched
			? colors.primaryContainer
			: isError
				? colors.errorContainer
				: colors.surfaceVariant
		const statusTextColor = isMatched
			? colors.onPrimaryContainer
			: isError
				? colors.onErrorContainer
				: colors.onSurfaceVariant

		const artistText =
			track.artist?.name || mapping?.originalArtists.join(', ') || '未知歌手'

		return (
			<TouchableRipple
				onPress={() => onManualMatch(track)}
				style={styles.itemRipple}
			>
				<View style={styles.itemRow}>
					<CoverWithPlaceHolder
						id={track.id}
						title={track.title}
						cover={track.coverUrl}
						size={LIST_ITEM_COVER_SIZE}
						borderRadius={LIST_ITEM_BORDER_RADIUS}
					/>

					<View style={styles.itemInfo}>
						<Text
							variant='bodyLarge'
							numberOfLines={1}
							style={{ fontWeight: '600' }}
						>
							{track.title}
						</Text>

						<View style={styles.secondaryRow}>
							<Text
								variant='bodySmall'
								numberOfLines={1}
								style={{ color: colors.onSurfaceVariant, flexShrink: 1 }}
							>
								{artistText}
							</Text>
							<View
								style={[styles.statusBadge, { backgroundColor: statusBgColor }]}
							>
								<Text
									style={[styles.statusBadgeText, { color: statusTextColor }]}
								>
									{statusLabel}
								</Text>
							</View>
						</View>

						{isMatched && matchedTitle ? (
							<Text
								variant='labelSmall'
								numberOfLines={1}
								style={{ color: colors.primary, marginTop: 2 }}
							>
								{`音源: ${matchedTitle}`}
							</Text>
						) : status === 'error' &&
						  item.errorMessage &&
						  item.errorMessage !== 'OK' &&
						  item.errorMessage !== '0' ? (
							<Text
								variant='labelSmall'
								numberOfLines={1}
								style={{ color: colors.error, marginTop: 2 }}
							>
								{item.errorMessage}
							</Text>
						) : null}
					</View>

					<Button
						mode={isMatched ? 'outlined' : 'contained-tonal'}
						compact
						icon={isMatched ? 'check' : 'magnify'}
						onPress={() => onManualMatch(track)}
						style={styles.actionButton}
					>
						{isMatched ? '重新匹配' : '手动匹配'}
					</Button>
				</View>
			</TouchableRipple>
		)
	},
)

export default function UnmatchedTracksPage() {
	const { id } = useLocalSearchParams<{ id: string }>()
	const router = useRouter()
	const { colors } = useTheme()
	const insets = useSafeAreaInsets()
	const queryClient = useQueryClient()
	const openModal = useModalStore((state) => state.open)

	const numericPlaylistId = Number(id)
	const { data: playlistMetadata } = usePlaylistMetadata(numericPlaylistId)
	const { data: allTracks = [], isLoading: isTracksLoading } =
		usePlaylistContents(numericPlaylistId)

	const [mappings, setMappings] = useState<ExternalTrackMappingRecord[]>(() => {
		try {
			return externalImportJobService.getPlaylistTrackMappings(
				numericPlaylistId,
			)
		} catch {
			return []
		}
	})

	const [isRematchRunning, setIsRematchRunning] = useState(() =>
		externalPlaylistImportWorker.isPlaylistRematchRunning(numericPlaylistId),
	)
	const [rematchProgress, setRematchProgress] = useState<{
		completed: number
		total: number
	} | null>(null)
	const [hideMatched, setHideMatched] = useState(false)

	const refreshMappings = useCallback(() => {
		try {
			setMappings(
				externalImportJobService.getPlaylistTrackMappings(numericPlaylistId),
			)
			setIsRematchRunning(
				externalPlaylistImportWorker.isPlaylistRematchRunning(
					numericPlaylistId,
				),
			)
		} catch {
			// Ignore
		}
	}, [numericPlaylistId])

	useEffect(() => {
		refreshMappings()
		const unsubService = externalImportJobService.subscribeChanges(() => {
			refreshMappings()
		})
		const unsubWorker = externalPlaylistImportWorker.subscribe(() => {
			refreshMappings()
		})
		return () => {
			unsubService()
			unsubWorker()
		}
	}, [refreshMappings])

	const mappingByTrackId = useMemo(() => {
		const map = new Map<number, ExternalTrackMappingRecord>()
		for (const m of mappings) {
			map.set(m.trackId, m)
		}
		return map
	}, [mappings])

	// 记录初始进入该页面时未完成匹配的 trackId 集合，避免用户手动匹配成功后项目突然消失跳动
	const initialUnfinishedIdsRef = useRef<Set<number> | null>(null)
	if (!initialUnfinishedIdsRef.current && allTracks.length > 0) {
		const set = new Set<number>()
		for (const track of allTracks) {
			const m = mappingByTrackId.get(track.id)
			const hasBvid =
				track.source === 'bilibili' && Boolean(track.bilibiliMetadata.bvid)

			if (m) {
				if (m.matchStatus !== 'matched' || !m.matchedBvid) {
					set.add(track.id)
				}
			} else if (!hasBvid && track.source === 'bilibili') {
				set.add(track.id)
			}
		}
		initialUnfinishedIdsRef.current = set
	}
	const initialUnfinishedIds = useMemo(
		() => initialUnfinishedIdsRef.current ?? new Set<number>(),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[initialUnfinishedIdsRef.current],
	)

	// 格式化要展示的未完成/处理中曲目列表
	const displayItems = useMemo<UnmatchedItemData[]>(() => {
		const list: UnmatchedItemData[] = []

		for (const track of allTracks) {
			const m = mappingByTrackId.get(track.id)
			const hasBvid =
				track.source === 'bilibili' && Boolean(track.bilibiliMetadata.bvid)
			const isCurrentlyMatched =
				(m?.matchStatus === 'matched' && Boolean(m?.matchedBvid)) || hasBvid

			// 只展示属于该列表（初始未完成，或当前仍未完成）的曲目
			const isRelevant =
				initialUnfinishedIds.has(track.id) || !isCurrentlyMatched

			if (!isRelevant) continue
			if (hideMatched && isCurrentlyMatched) continue

			const status: ExternalTrackMatchStatus = isCurrentlyMatched
				? 'matched'
				: (m?.matchStatus ?? 'unmatched')

			const matchedTitle =
				m?.matchedVideo?.title?.replace(/<em[^>]*>|<\/em>/g, '') ||
				(hasBvid
					? (track.bilibiliMetadata.mainTrackTitle ?? undefined)
					: undefined)

			list.push({
				track,
				mapping: m,
				status,
				errorMessage: m?.errorMessage ?? undefined,
				isMatched: isCurrentlyMatched,
				matchedTitle,
			})
		}

		return list
	}, [allTracks, hideMatched, initialUnfinishedIds, mappingByTrackId])

	const remainingUnmatchedCount = useMemo(() => {
		return displayItems.filter((i) => !i.isMatched).length
	}, [displayItems])

	const handleManualMatch = useCallback(
		(track: Track) => {
			let mapping: ExternalTrackMappingRecord | null = null
			try {
				mapping = externalImportJobService.getTrackMapping(track.id)
			} catch {
				mapping = null
			}
			const originalTrack: GenericTrack = mapping?.originalTrack ?? {
				title: track.title,
				artists: track.artist?.name ? [track.artist.name] : [],
				album: '',
				duration: Math.max(0, (track.duration ?? 0) * 1000),
				coverUrl: track.coverUrl ?? undefined,
			}
			const initialQuery =
				`${originalTrack.title} ${originalTrack.artists.join(' ')}`.trim()
			const hadExistingBvid =
				track.source === 'bilibili' && Boolean(track.bilibiliMetadata.bvid)

			openModal('ManualMatchExternalSync', {
				track: originalTrack,
				initialQuery,
				onMatch: (matchResult) => {
					externalImportJobService.updateTrackMatchInPlace(
						track.id,
						{
							...matchResult,
							track: originalTrack,
							status: 'matched',
						},
						{
							playlistId: numericPlaylistId,
							originalTrack,
						},
					)
					refreshMappings()
					void Promise.all([
						queryClient.invalidateQueries({
							queryKey: playlistKeys.playlistContents(numericPlaylistId),
						}),
						queryClient.invalidateQueries({
							queryKey: playlistKeys.playlistMetadata(numericPlaylistId),
						}),
					])
					toast.success(hadExistingBvid ? '已更新匹配音源' : '手动匹配成功')
				},
			})
		},
		[numericPlaylistId, openModal, queryClient, refreshMappings],
	)

	const handleBatchRematch = useCallback(
		async (mode: 'unfinished' | 'failed') => {
			if (
				externalPlaylistImportWorker.isPlaylistRematchRunning(numericPlaylistId)
			) {
				return
			}
			setIsRematchRunning(true)
			try {
				const result = await externalPlaylistImportWorker.rematchPlaylistTracks(
					numericPlaylistId,
					{
						mode,
						onProgress: (completed, total) => {
							setRematchProgress({ completed, total })
							void queryClient.invalidateQueries({
								queryKey: playlistKeys.playlistContents(numericPlaylistId),
							})
						},
					},
				)
				setRematchProgress(null)
				setIsRematchRunning(false)
				refreshMappings()
				await Promise.all([
					queryClient.invalidateQueries({
						queryKey: playlistKeys.playlistContents(numericPlaylistId),
					}),
					queryClient.invalidateQueries({
						queryKey: playlistKeys.playlistMetadata(numericPlaylistId),
					}),
				])

				if (result.status === 'rate_limited') {
					toast.error('遇到 Bilibili 请求受限，已自动暂停匹配，请稍后重试', {
						id: 'bilibili-rate-limit',
					})
				} else if (result.total === 0) {
					toast.info('没有需要继续匹配的歌曲')
				} else if (result.matched === 0) {
					toast.info(
						`未找到新的匹配音源 (0 / ${result.total})，可点击「手动匹配」搜索绑定`,
					)
				} else {
					toast.success(
						`继续匹配完成：成功匹配 ${result.matched} / ${result.total} 首`,
					)
				}
			} catch (e) {
				setRematchProgress(null)
				setIsRematchRunning(false)
				toastAndLogError('继续匹配歌单音源失败', e, SCOPE)
			}
		},
		[numericPlaylistId, queryClient, refreshMappings],
	)

	const handlePauseRematch = useCallback(() => {
		externalPlaylistImportWorker.pausePlaylistRematch(numericPlaylistId)
		setIsRematchRunning(false)
		setRematchProgress(null)
		toast.info('已暂停自动匹配')
	}, [numericPlaylistId])

	return (
		<View style={styles.container}>
			<Appbar.Header elevated>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content
					title='未完成匹配歌曲'
					subtitle={
						playlistMetadata
							? `${playlistMetadata.title} · 还剩 ${remainingUnmatchedCount} 首`
							: `还剩 ${remainingUnmatchedCount} 首未完成`
					}
				/>
				{isRematchRunning ? (
					<Appbar.Action
						icon='pause'
						onPress={handlePauseRematch}
						accessibilityLabel='暂停自动匹配'
					/>
				) : (
					<Appbar.Action
						icon='sync'
						disabled={remainingUnmatchedCount === 0}
						onPress={() => void handleBatchRematch('unfinished')}
						accessibilityLabel='重新自动匹配'
					/>
				)}
			</Appbar.Header>

			{isRematchRunning && (
				<Banner
					visible
					icon='sync'
					actions={[
						{
							label: '暂停',
							onPress: handlePauseRematch,
						},
					]}
				>
					{rematchProgress
						? `正在后台自动匹配音源 (${rematchProgress.completed} / ${rematchProgress.total})...`
						: '正在后台自动匹配音源...'}
				</Banner>
			)}

			<View style={styles.filterBar}>
				<Chip
					selected={!hideMatched}
					onPress={() => setHideMatched(false)}
					style={styles.chip}
				>
					{`全部待办 (${displayItems.length})`}
				</Chip>
				<Chip
					selected={hideMatched}
					onPress={() => setHideMatched(true)}
					style={styles.chip}
				>
					{`仅看未匹配 (${remainingUnmatchedCount})`}
				</Chip>
			</View>

			<Divider />

			{isTracksLoading ? (
				<View style={styles.centerContainer}>
					<ActivityIndicator size='large' />
					<Text style={{ marginTop: 12, color: colors.onSurfaceVariant }}>
						加载待匹配歌曲中...
					</Text>
				</View>
			) : displayItems.length === 0 ? (
				<View style={styles.centerContainer}>
					<Icon
						source='check-circle-outline'
						size={64}
						color={colors.primary}
					/>
					<Text
						variant='titleMedium'
						style={{ marginTop: 16, fontWeight: 'bold' }}
					>
						所有歌曲均已成功匹配音源
					</Text>
					<Text
						variant='bodySmall'
						style={{
							color: colors.onSurfaceVariant,
							marginTop: 6,
							textAlign: 'center',
							paddingHorizontal: 32,
						}}
					>
						当前歌单中所有歌曲均已找到并绑定 B 站对应视频，可以直接播放
					</Text>
					<Button
						mode='contained'
						onPress={() => router.back()}
						style={{ marginTop: 24 }}
					>
						返回歌单
					</Button>
				</View>
			) : (
				<FlatList
					data={displayItems}
					keyExtractor={(item) => item.track.uniqueKey || String(item.track.id)}
					renderItem={({ item }) => (
						<UnmatchedTrackRow
							item={item}
							onManualMatch={handleManualMatch}
						/>
					)}
					ItemSeparatorComponent={Divider}
					contentContainerStyle={{
						paddingBottom: insets.bottom + 90,
					}}
				/>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	filterBar: {
		flexDirection: 'row',
		paddingHorizontal: 16,
		paddingVertical: 10,
		gap: 8,
		alignItems: 'center',
	},
	chip: {
		borderRadius: 8,
	},
	centerContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 24,
	},
	itemRipple: {
		paddingHorizontal: 16,
		paddingVertical: 10,
	},
	itemRow: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	itemInfo: {
		flex: 1,
		marginLeft: 12,
		marginRight: 8,
		gap: 3,
	},
	secondaryRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
	},
	statusBadge: {
		paddingHorizontal: 6,
		paddingVertical: 1,
		borderRadius: 4,
	},
	statusBadgeText: {
		fontSize: 10,
		fontWeight: '600',
	},
	actionButton: {
		marginLeft: 'auto',
	},
})
