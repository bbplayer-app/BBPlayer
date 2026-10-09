import { Icon } from '@expo/ui'
import { LegendList } from '@legendapp/list/react-native'
import { useFocusEffect } from 'expo-router'
import {
	memo,
	useCallback,
	useDeferredValue,
	useEffect,
	useMemo,
	useState,
} from 'react'
import { RefreshControl, StyleSheet, View } from 'react-native'
import { Searchbar, Text, useTheme } from 'react-native-paper'

import { MenuView } from '@/components/common/FunctionalMenu'
import IconButton from '@/components/common/IconButton'
import { DataFetchingError } from '@/features/library/shared/DataFetchingError'
import { LocalPlaylistListSkeleton } from '@/features/library/skeletons/LibraryTabSkeleton'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import {
	usePlaylistLists,
	useSearchPlaylists,
} from '@/hooks/queries/db/playlist'
import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { useMenuActions } from '@/hooks/ui/useMenuActions'
import {
	externalImportJobService,
	type ImportJob,
} from '@/lib/services/externalImportJobService'
import { externalPlaylistImportWorker } from '@/lib/workers/ExternalPlaylistImportWorker'
import type { Playlist } from '@/types/core/media'

import DraftImportPlaylistItem from './DraftImportPlaylistItem'
import LocalPlaylistItem from './LocalPlaylistItem'

const CREATE_PLAYLIST_ICON = Icon.select({
	ios: 'plus.rectangle.on.rectangle',
	android: import('@expo/material-symbols/playlist_add.xml'),
})

const IMPORT_PLAYLIST_ICON = Icon.select({
	ios: 'link',
	android: import('@expo/material-symbols/link.xml'),
})

const SUBSCRIBE_PLAYLIST_ICON = Icon.select({
	ios: 'person.2',
	android: import('@expo/material-symbols/group.xml'),
})

const MERGE_PLAYLIST_ICON = Icon.select({
	ios: 'arrow.merge',
	android: import('@expo/material-symbols/merge.xml'),
})

const renderPlaylistItem = ({
	item,
}: {
	item: Playlist & { isToView?: boolean }
}) => <LocalPlaylistItem item={item} />

const LocalPlaylistListComponent = memo(() => {
	const { colors } = useTheme()
	const haveTrack = useCurrentTrack()
	const [refreshing, setRefreshing] = useState(false)
	const [searchQuery, setSearchQuery] = useState('')
	const deferredSearchQuery = useDeferredValue(searchQuery)
	const openModal = useModalStore((state) => state.open)
	const hasBilibiliCookie = useAppStore((state) => state.hasBilibiliCookie)

	const [draftJobs, setDraftJobs] = useState<ImportJob[]>(() => {
		try {
			return externalImportJobService.listActiveDraftJobs()
		} catch {
			return []
		}
	})
	const [currentTrackByJobId, setCurrentTrackByJobId] = useState<
		Record<string, string | null>
	>({})

	useEffect(() => {
		const refreshDrafts = () => {
			try {
				setDraftJobs(externalImportJobService.listActiveDraftJobs())
			} catch {
				// Ignore
			}
		}
		refreshDrafts()
		const unsubChanges =
			externalImportJobService.subscribeChanges(refreshDrafts)
		const unsubWorker = externalPlaylistImportWorker.subscribe((event) => {
			refreshDrafts()
			setCurrentTrackByJobId((prev) => ({
				...prev,
				[event.jobId]: event.currentTrackTitle,
			}))
		})
		return () => {
			unsubChanges()
			unsubWorker()
		}
	}, [])

	const {
		data: playlists,
		isPending: playlistsIsPending,
		isRefetching: playlistsIsRefetching,
		refetch,
		isError: playlistsIsError,
	} = usePlaylistLists()

	useFocusEffect(
		useCallback(() => {
			void refetch()
			try {
				setDraftJobs(externalImportJobService.listActiveDraftJobs())
			} catch {
				// Ignore
			}
		}, [refetch]),
	)

	const { data: searchResults } = useSearchPlaylists(deferredSearchQuery, true)

	const filteredDraftJobs = useMemo(() => {
		const q = deferredSearchQuery.trim().toLowerCase()
		if (!q) return draftJobs
		return draftJobs.filter((job) =>
			(job.playlistMetadata.title || job.sourcePlaylistId)
				.toLowerCase()
				.includes(q),
		)
	}, [deferredSearchQuery, draftJobs])

	const finalPlaylists = useMemo(() => {
		if (deferredSearchQuery.trim()) {
			return searchResults ?? []
		}

		if (!playlists) return []

		if (!hasBilibiliCookie()) return playlists
		return [
			{
				id: 1145141919810,
				title: '稍后再看',
				author: null,
				description: null,
				coverUrl: null,
				itemCount: 0,
				type: 'favorite',
				remoteSyncId: null,
				lastSyncedAt: null,
				createdAt: new Date(),
				updatedAt: new Date(),
				isToView: true,
			},
			...playlists,
		] as (Playlist & { isToView?: boolean })[]
	}, [hasBilibiliCookie, playlists, deferredSearchQuery, searchResults])

	const keyExtractor = useCallback((item: Playlist) => item.id.toString(), [])

	const onRefresh = async () => {
		setRefreshing(true)
		try {
			setDraftJobs(externalImportJobService.listActiveDraftJobs())
		} catch {
			// Ignore
		}
		await refetch()
		setRefreshing(false)
	}

	const menuActions = useMenuActions([
		{
			title: '新建播放列表',
			image: CREATE_PLAYLIST_ICON,
			onPress: () =>
				openModal('CreatePlaylist', { redirectToNewPlaylist: true }),
		},
		{
			title: '导入外部歌单',
			image: IMPORT_PLAYLIST_ICON,
			onPress: () => openModal('InputExternalPlaylistInfo', undefined),
		},
		{
			title: '订阅共享歌单',
			image: SUBSCRIBE_PLAYLIST_ICON,
			onPress: () => openModal('SubscribeToSharedPlaylist', undefined),
		},
		{
			title: '动态合并歌单',
			image: MERGE_PLAYLIST_ICON,
			onPress: () => openModal('MergePlaylists', undefined),
		},
	])

	if (playlistsIsPending) {
		return <LocalPlaylistListSkeleton />
	}

	if (playlistsIsError) {
		return (
			<DataFetchingError
				text='加载失败'
				onRetry={() => onRefresh()}
			/>
		)
	}

	return (
		<View style={styles.container}>
			<View style={styles.headerContainer}>
				<Text
					variant='titleMedium'
					style={styles.headerTitle}
				>
					播放列表
				</Text>
				<View style={styles.headerActionsContainer}>
					<Text variant='bodyMedium'>
						{(playlists.length ?? 0) + draftJobs.length}&thinsp;个播放列表
					</Text>
					<MenuView {...menuActions}>
						<IconButton
							icon='plus'
							size={20}
						/>
					</MenuView>
				</View>
			</View>
			<Searchbar
				placeholder='搜索播放列表'
				onChangeText={setSearchQuery}
				value={searchQuery}
				mode='bar'
				style={styles.searchbar}
				inputStyle={styles.searchInput}
			/>
			<View
				style={{
					flex: 1,
					opacity: searchQuery !== deferredSearchQuery ? 0.5 : 1,
				}}
			>
				<LegendList
					contentContainerStyle={{ paddingBottom: haveTrack ? 90 : 10 }}
					showsVerticalScrollIndicator={false}
					data={finalPlaylists ?? []}
					renderItem={renderPlaylistItem}
					recycleItems
					ListHeaderComponent={
						filteredDraftJobs.length > 0 ? (
							<View style={styles.draftsSection}>
								{filteredDraftJobs.map((job) => (
									<DraftImportPlaylistItem
										key={job.jobId}
										job={job}
										currentTrackTitle={
											currentTrackByJobId[job.jobId] ??
											externalPlaylistImportWorker.getCurrentTrackTitle(
												job.jobId,
											)
										}
									/>
								))}
							</View>
						) : null
					}
					refreshControl={
						<RefreshControl
							refreshing={refreshing || playlistsIsRefetching}
							onRefresh={onRefresh}
							colors={[colors.primary]}
							progressViewOffset={50}
						/>
					}
					keyExtractor={keyExtractor}
					ListEmptyComponent={
						filteredDraftJobs.length === 0 ? (
							<Text style={styles.emptyList}>没有播放列表</Text>
						) : null
					}
				/>
			</View>
		</View>
	)
})

const styles = StyleSheet.create({
	container: {
		flex: 1,
		marginHorizontal: 16,
	},
	headerContainer: {
		height: 48,
		marginBottom: 4,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	headerTitle: {
		fontWeight: 'bold',
	},
	headerActionsContainer: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	searchInput: {
		alignSelf: 'center',
	},
	searchbar: {
		borderRadius: 9999,
		textAlign: 'center',
		height: 45,
		marginBottom: 20,
		marginTop: 0,
	},
	draftsSection: {
		marginBottom: 8,
	},
	emptyList: {
		textAlign: 'center',
	},
})

LocalPlaylistListComponent.displayName = 'LocalPlaylistListComponent'

export default LocalPlaylistListComponent
