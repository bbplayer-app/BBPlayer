import { Orpheus } from '@bbplayer/orpheus'
import * as Clipboard from 'expo-clipboard'
import type { ImageRef } from 'expo-image'
import { useRouter } from 'expo-router'
import { memo, useCallback, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import {
	Avatar,
	Divider,
	Text,
	TouchableRipple,
	useTheme,
} from 'react-native-paper'

import Button from '@/components/common/Button'
import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import IconButton from '@/components/common/IconButton'
import { alert } from '@/components/modals/AlertModal'
import { resolveTrackCover } from '@/hooks/player/useLocalCover'
import type { SharedPlaylistMember } from '@/hooks/queries/sharedPlaylistMembers'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { playlistService } from '@/lib/services/playlistService'
import type { Playlist } from '@/types/core/media'
import { toastAndLogError } from '@/utils/error-handling'
import { getInternalPlayUri } from '@/utils/player'
import { formatDurationToText, formatRelativeTime } from '@/utils/time'
import toast from '@/utils/toast'

interface PlaylistHeaderProps {
	playlist: Playlist & { validTrackCount: number }
	totalDuration?: number
	onClickPlayAll: () => void
	onClickSync: () => void
	onClickCopyToLocalPlaylist: () => void
	/** 当作者为 bilibili 时触发。可选，未提供时仅视觉提示不响应 */
	onPressAuthor?: (author: NonNullable<Playlist['author']>) => void
	coverRef?: ImageRef | null
	shareMembers?: SharedPlaylistMember[]
	onPressShareMember?: () => void
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
	totalDuration: number | undefined,
): SubtitlePieces {
	const isLocal = playlist.type === 'local'

	const countRaw =
		playlist.validTrackCount !== playlist.itemCount
			? `${playlist.itemCount}\u2009首\u2009(\u2009${playlist.itemCount - playlist.validTrackCount}\u2009首失效) `
			: `${playlist.itemCount}\u2009首`

	let countText = `${countRaw}歌曲`
	if (totalDuration !== undefined) {
		countText += `\u2009•\u2009共\u2009${formatDurationToText(totalDuration)}`
	}

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
	totalDuration,
	onClickPlayAll,
	onClickSync,
	onClickCopyToLocalPlaylist,
	onPressAuthor,
	coverRef,
	shareMembers,
	onPressShareMember,
}: PlaylistHeaderProps) {
	const [showFullTitle, setShowFullTitle] = useState(false)
	const router = useRouter()
	const { colors } = useTheme()

	const { isLocal, authorName, authorClickable, countText, syncLine } = useMemo(
		() => buildSubtitlePieces(playlist, totalDuration),
		[playlist, totalDuration],
	)

	const onClickDownloadAll = useCallback(async () => {
		const tracksResult = await playlistService.getPlaylistTracks(playlist.id)
		if (tracksResult.isErr()) {
			toastAndLogError(
				'获取播放列表内容失败',
				tracksResult.error,
				'UI.Playlist.Local.Header',
			)
			return
		}
		void Orpheus.multiDownload(
			tracksResult.value
				.filter((item) =>
					item.source === 'bilibili'
						? item.bilibiliMetadata.videoIsValid
						: true,
				)
				.map((t) => {
					const url = getInternalPlayUri(t)
					if (!url) return
					return {
						id: t.uniqueKey,
						title: t.title,
						url: url,
						artist: t.artist?.name,
						artwork: resolveTrackCover(t.uniqueKey, t.coverUrl) ?? undefined,
						duration: t.duration,
					}
				})
				.filter((t) => !!t),
		)
		useModalStore.getState().doAfterModalHostClosed(() => {
			router.push('/download')
		})
	}, [playlist.id, router])

	if (!playlist.title) return null

	return (
		<View style={styles.container}>
			{/* 顶部信息 */}
			<View style={styles.headerContainer}>
				<CoverWithPlaceHolder
					id={playlist.id}
					cover={coverRef ?? playlist.coverUrl}
					title={playlist.title}
					size={120}
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
							<>
								{playlist.shareId && playlist.shareRole && (
									<>
										<Text style={{ color: colors.primary, fontWeight: 'bold' }}>
											{playlist.shareRole === 'owner'
												? '所有者'
												: playlist.shareRole === 'editor'
													? '编辑者'
													: '订阅者'}
										</Text>
										{'\n'}
									</>
								)}
								{countText}
							</>
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

					{playlist.shareId && shareMembers && shareMembers.length > 0 && (
						<TouchableRipple
							onPress={
								onPressShareMember && playlist.shareRole !== 'subscriber'
									? onPressShareMember
									: undefined
							}
							style={{
								marginTop: 8,
								alignSelf: 'flex-start',
								borderRadius: 16,
							}}
						>
							<View style={styles.shareInfoRow}>
								{playlist.shareRole === 'subscriber' ? (
									(() => {
										const owner =
											shareMembers.find((m) => m.role === 'owner') ||
											shareMembers[0]
										return (
											<>
												<View
													style={[
														styles.avatarWrapper,
														{ borderColor: colors.background },
													]}
												>
													{owner.avatarUrl ? (
														<Avatar.Image
															size={24}
															source={{ uri: owner.avatarUrl }}
														/>
													) : (
														<Avatar.Text
															size={24}
															label={owner.name.slice(0, 1)}
														/>
													)}
												</View>
												<Text
													variant='bodySmall'
													style={{
														marginLeft: 6,
														color: colors.onSurfaceVariant,
													}}
												>
													{owner.name}
												</Text>
											</>
										)
									})()
								) : (
									<>
										{shareMembers.slice(0, 3).map((member, index) => (
											<View
												key={member.mid}
												style={[
													styles.avatarWrapper,
													{
														marginLeft: index === 0 ? 0 : -8,
														zIndex: 5 - index,
														borderColor: colors.background,
													},
												]}
											>
												{member.avatarUrl ? (
													<Avatar.Image
														size={24}
														source={{ uri: member.avatarUrl }}
													/>
												) : (
													<Avatar.Text
														size={24}
														label={member.name.slice(0, 1)}
													/>
												)}
											</View>
										))}
										{shareMembers.length > 5 && (
											<View
												style={[
													styles.avatarWrapper,
													{
														marginLeft: -8,
														zIndex: 0,
														borderColor: colors.background,
														backgroundColor: colors.surfaceVariant,
														width: 28,
														height: 28,
														justifyContent: 'center',
														alignItems: 'center',
													},
												]}
											>
												<Text
													variant='labelSmall'
													style={{ fontSize: 10 }}
												>
													+{shareMembers.length - 3}
												</Text>
											</View>
										)}
										<Text
											variant='bodySmall'
											style={{ marginLeft: 6, color: colors.onSurfaceVariant }}
										>
											{shareMembers.length} 位协作者
										</Text>
									</>
								)}
							</View>
						</TouchableRipple>
					)}
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
						onPress={() => onClickPlayAll()}
						testID='playlist-play-all'
					>
						播放全部
					</Button>

					{playlist.type !== 'local' && (
						<IconButton
							mode='contained'
							icon='sync'
							size={20}
							onPress={onClickSync}
							testID='playlist-sync'
						/>
					)}

					<IconButton
						mode='contained'
						icon='content-copy'
						size={20}
						onPress={onClickCopyToLocalPlaylist}
						testID='playlist-copy'
					/>
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
						testID='playlist-download'
					/>
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
	shareInfoRow: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	avatarWrapper: {
		borderWidth: 2,
		borderRadius: 16,
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
