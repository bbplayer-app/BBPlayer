import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import { alert } from '@/components/modals/AlertModal'
import useDownloadManagerStore from '@/hooks/stores/useDownloadManagerStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import type { Playlist, Track } from '@/types/core/media'
import { formatRelativeTime } from '@/utils/time'
import toast from '@/utils/toast'
import * as Clipboard from 'expo-clipboard'
import { useRouter } from 'expo-router'
import { memo, useCallback, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import {
	Button,
	Divider,
	IconButton,
	Text,
	Tooltip,
	TouchableRipple,
} from 'react-native-paper'

interface PlaylistHeaderProps {
	playlist: Playlist & { validTrackCount: number }
	playlistContents: Track[]
	onClickPlayAll: () => void
	onClickSync: () => void
	onClickCopyToLocalPlaylist: () => void
	/** 当作者为 bilibili 时触发。可选，未提供时仅视觉提示不响应 */
	onPressAuthor?: (author: NonNullable<Playlist['author']>) => void
}

interface SubtitlePieces {
	isLocal: boolean
	authorName?: string
	authorClickable: boolean
	countText: string
	syncLine?: string // 带“最后同步：xxx”的整行
}

// 三元运算符过于难懂，还是用函数好一些
function buildSubtitlePieces(
	playlist: Playlist & { validTrackCount: number },
): SubtitlePieces {
	const isLocal = playlist.type === 'local'

	const countRaw =
		playlist.validTrackCount !== playlist.itemCount
			? `${playlist.itemCount} 首 ( ${playlist.itemCount - playlist.validTrackCount} 首失效) `
			: `${playlist.itemCount} 首`

	const countText = `${countRaw}歌曲`

	const authorName = !isLocal
		? (playlist.author?.name ?? '未知作者')
		: undefined
	const authorClickable =
		!!authorName && !isLocal && playlist.author?.source === 'bilibili'

	const syncLine = !isLocal
		? `最后同步：${
				playlist.lastSyncedAt
					? formatRelativeTime(playlist.lastSyncedAt)
					: '未知'
			}`
		: undefined

	return { isLocal, authorName, authorClickable, countText, syncLine }
}

/**
 * 播放列表头部组件。
 */
export const PlaylistHeader = memo(function PlaylistHeader({
	playlist,
	playlistContents,
	onClickPlayAll,
	onClickSync,
	onClickCopyToLocalPlaylist,
	onPressAuthor,
}: PlaylistHeaderProps) {
	const [showFullTitle, setShowFullTitle] = useState(false)
	const queueDownloads = useDownloadManagerStore(
		(state) => state.queueDownloads,
	)
	const router = useRouter()

	const { isLocal, authorName, authorClickable, countText, syncLine } = useMemo(
		() => buildSubtitlePieces(playlist),
		[playlist],
	)
	const onClickDownloadAll = useCallback(() => {
		if (!playlistContents) return
		queueDownloads(
			playlistContents
				.filter((t) => t.trackDownloads?.status !== 'downloaded')
				.map((t) => ({
					uniqueKey: t.uniqueKey,
					title: t.title,
					coverUrl: t.coverUrl ?? undefined,
				})),
		)
		useModalStore.getState().doAfterModalHostClosed(() => {
			router.push('/download')
		})
	}, [router, playlistContents, queueDownloads])

	if (!playlist.title) return null

	return (
		<View style={styles.container}>
			{/* 顶部信息 */}
			<View style={styles.headerContainer}>
				<CoverWithPlaceHolder
					id={playlist.id}
					coverUrl={playlist.coverUrl}
					title={playlist.title}
					size={120}
					borderRadius={8}
				/>

				<View style={styles.headerTextContainer}>
					<TouchableRipple
						onPress={() => setShowFullTitle(!showFullTitle)}
						onLongPress={async () => {
							const result = await Clipboard.setStringAsync(playlist.title)
							if (!result) {
								toast.error('复制失败')
							} else {
								toast.success('已复制标题到剪贴板')
							}
						}}
					>
						<Text
							variant='titleLarge'
							style={styles.title}
							numberOfLines={showFullTitle ? undefined : 2}
						>
							{playlist.title}
						</Text>
					</TouchableRipple>

					<Text
						variant='bodySmall'
						style={styles.subtitle}
						numberOfLines={3}
					>
						{isLocal ? (
							<>{countText}</>
						) : (
							<>
								{/* 作者名 */}
								{'创建者：'}
								<Text
									variant='bodySmall'
									onPress={
										authorClickable && playlist.author
											? () => onPressAuthor?.(playlist.author!)
											: undefined
									}
									style={{
										textDecorationLine: authorClickable ? 'underline' : 'none',
									}}
								>
									{authorName}
								</Text>
								{'\n'}
								{countText}
								{syncLine ? '\n' : ''}
								{syncLine}
							</>
						)}
					</Text>
				</View>
			</View>

			{/* 操作按钮 */}
			<View
				style={[
					styles.actionsContainer,
					{ marginBottom: playlist.description ? 0 : 16 },
				]}
			>
				<View style={styles.actionButtons}>
					<Button
						mode='contained'
						icon='play'
						onPress={onClickPlayAll}
					>
						播放全部
					</Button>

					{playlist.type !== 'local' && (
						<IconButton
							mode='contained'
							icon='sync'
							size={20}
							onPress={onClickSync}
						/>
					)}

					<Tooltip title='复制到本地歌单'>
						<IconButton
							mode='contained'
							icon='content-copy'
							size={20}
							onPress={onClickCopyToLocalPlaylist}
						/>
					</Tooltip>
					<Tooltip title='下载全部'>
						<IconButton
							mode='contained'
							icon='download'
							size={20}
							onPress={() =>
								alert(
									'下载全部？',
									'是否要下载该播放列表内的全部歌曲？（已下载过的不会重新下载）',
									[
										{
											text: '取消',
										},
										{
											text: '确定',
											onPress: onClickDownloadAll,
										},
									],
									{ cancelable: true },
								)
							}
						/>
					</Tooltip>
				</View>
			</View>

			{/* 描述 */}
			{!!playlist.description && (
				<Text
					style={styles.description}
					variant='bodyMedium'
				>
					{playlist.description}
				</Text>
			)}

			<Divider />
		</View>
	)
})

const styles = StyleSheet.create({
	container: {
		position: 'relative',
		flexDirection: 'column',
	},
	headerContainer: {
		flexDirection: 'row',
		margin: 16,
		alignItems: 'center',
	},
	headerTextContainer: {
		marginLeft: 16,
		flex: 1,
		justifyContent: 'center',
		marginVertical: 8,
	},
	title: {
		fontWeight: 'bold',
		marginBottom: 8,
	},
	subtitle: {
		fontWeight: '100',
		lineHeight: 18,
	},
	actionsContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'flex-start',
		marginHorizontal: 16,
	},
	actionButtons: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	description: {
		margin: 16,
	},
})
