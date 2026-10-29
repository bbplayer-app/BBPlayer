import { useRouter } from 'expo-router'
import { memo, useCallback } from 'react'
import { StyleSheet, View } from 'react-native'
import { Touchable } from 'react-native-gesture-handler'
import { Divider, Icon, ProgressBar, Text, useTheme } from 'react-native-paper'

import Button from '@/components/common/Button'
import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import IconButton from '@/components/common/IconButton'
import { alert } from '@/components/modals/AlertModal'
import {
	externalImportJobService,
	type ImportJob,
	isJobWaitingConfirmation,
} from '@/lib/services/externalImportJobService'
import { externalPlaylistImportWorker } from '@/lib/workers/ExternalPlaylistImportWorker'
import { LIST_ITEM_COVER_SIZE } from '@/theme/dimensions'
import toast from '@/utils/toast'

export interface DraftPlatformBadgeStyle {
	label: string
	backgroundColor: string
	textColor: string
}

export function resolveDraftImportPlatformBadge(
	job: Pick<ImportJob, 'source' | 'playlistMetadata'>,
	fallbackColors: { backgroundColor: string; textColor: string } = {
		backgroundColor: '#5C6BC0',
		textColor: '#FFFFFF',
	},
): DraftPlatformBadgeStyle {
	const platform = job.playlistMetadata?.platform
	if (platform === 'qq' || platform === 'qqmusic' || job.source === 'qq') {
		return {
			label: 'QQ音乐',
			backgroundColor: '#2BB66A',
			textColor: '#FFFFFF',
		}
	}
	if (platform === 'netease' || job.source === 'netease') {
		return {
			label: '网易云音乐',
			backgroundColor: '#D43C33',
			textColor: '#FFFFFF',
		}
	}
	if (platform === 'kugou') {
		return {
			label: '酷狗音乐',
			backgroundColor: '#0C8ED9',
			textColor: '#FFFFFF',
		}
	}
	if (platform === 'qishui') {
		return {
			label: '汽水音乐',
			backgroundColor: '#00C2B8',
			textColor: '#FFFFFF',
		}
	}
	if (job.source === 'local_json') {
		return {
			label: 'JSON导入',
			backgroundColor: fallbackColors.backgroundColor,
			textColor: fallbackColors.textColor,
		}
	}
	return {
		label: '外部导入',
		backgroundColor: fallbackColors.backgroundColor,
		textColor: fallbackColors.textColor,
	}
}

interface DraftImportPlaylistItemProps {
	job: ImportJob
	currentTrackTitle?: string | null
}

const DraftImportPlaylistItem = memo(
	({ job, currentTrackTitle }: DraftImportPlaylistItemProps) => {
		const router = useRouter()
		const theme = useTheme()
		const { colors } = theme

		const totalCount = Math.max(job.totalCount, 0)
		const processedCount = Math.min(job.processedCount, totalCount)
		const progress = totalCount > 0 ? processedCount / totalCount : 0
		const percentage = Math.round(progress * 100)
		const isRunning =
			job.status === 'running' ||
			externalPlaylistImportWorker.isJobRunning(job.jobId)
		const isWaitingConfirm = isJobWaitingConfirmation(job)
		const isRateLimited = job.status === 'rate_limited'
		const needManualCount = job.unmatchedCount + job.errorCount
		const platformBadge = resolveDraftImportPlatformBadge(job, {
			backgroundColor: colors.secondaryContainer,
			textColor: colors.onSecondaryContainer,
		})

		const navigateToSyncPage = useCallback(() => {
			router.navigate({
				pathname: '/playlist/external-sync',
				params: {
					id: job.sourcePlaylistId,
					source: job.source,
				},
			})
		}, [job.source, job.sourcePlaylistId, router])

		const handlePrimaryAction = useCallback(() => {
			if (isRunning) {
				externalPlaylistImportWorker.pause(job.jobId)
				toast.info('已暂停匹配，进度已保存')
				return
			}
			if (isWaitingConfirm) {
				navigateToSyncPage()
				return
			}
			void externalPlaylistImportWorker.start(job.jobId)
		}, [isRunning, isWaitingConfirm, job.jobId, navigateToSyncPage])

		const handleDiscardDraft = useCallback(() => {
			alert(
				'放弃导入草稿',
				`确定要放弃并删除《${job.playlistMetadata.title || job.sourcePlaylistId}》的导入草稿吗？已匹配的临时进度将被清除。`,
				[
					{ text: '取消' },
					{
						text: '删除草稿',
						onPress: () => {
							externalPlaylistImportWorker.cancel(job.jobId)
							externalImportJobService.deleteJob(job.jobId)
							toast.success('已删除导入草稿')
						},
					},
				],
				{ cancelable: true },
			)
		}, [job.jobId, job.playlistMetadata.title, job.sourcePlaylistId])

		let statusText: string
		let statusColor = colors.onSurfaceVariant

		if (isRunning) {
			statusText = `正在匹配 ${processedCount} / ${totalCount} · ${percentage}%`
			statusColor = colors.primary
		} else if (isRateLimited) {
			statusText = `风控暂停 · 已完成 ${processedCount} / ${totalCount}（${job.matchedCount} 首成功）`
			statusColor = colors.error
		} else if (isWaitingConfirm) {
			statusText = `已完成待确认 · ${job.matchedCount} 首成功，${needManualCount} 首待处理`
			statusColor = colors.primary
		} else if (job.status === 'paused') {
			statusText = `已暂停 · 已完成 ${processedCount} / ${totalCount} · ${percentage}%`
		} else if (job.status === 'failed') {
			statusText = `匹配中断 · 已完成 ${processedCount} / ${totalCount}`
			statusColor = colors.error
		} else {
			statusText = `待开始匹配 · 共 ${totalCount} 首歌曲`
		}

		const primaryButtonLabel = isRunning
			? '暂停'
			: isWaitingConfirm
				? '去确认'
				: processedCount > 0 || job.errorCount > 0
					? '继续'
					: '开始'

		return (
			<View>
				<Touchable
					androidRipple={{}}
					style={[
						styles.rectButton,
						{
							backgroundColor: colors.elevation.level1,
						},
					]}
					onPress={navigateToSyncPage}
					testID={`draft-import-playlist-${job.jobId}`}
				>
					<View style={styles.cardInner}>
						<View style={styles.itemContainer}>
							<CoverWithPlaceHolder
								id={job.jobId}
								cover={job.playlistMetadata.coverUrl || null}
								title={job.playlistMetadata.title || job.sourcePlaylistId}
								size={LIST_ITEM_COVER_SIZE}
							/>
							<View style={styles.textContainer}>
								<View style={styles.titleRow}>
									<View
										style={[
											styles.draftBadge,
											{
												backgroundColor: platformBadge.backgroundColor,
											},
										]}
									>
										<Text
											variant='labelSmall'
											style={{
												color: platformBadge.textColor,
												fontWeight: 'bold',
											}}
										>
											{platformBadge.label}
										</Text>
									</View>
									<Text
										variant='titleMedium'
										numberOfLines={1}
										style={styles.titleText}
									>
										{job.playlistMetadata.title || job.sourcePlaylistId}
									</Text>
								</View>

								<View style={styles.subtitleContainer}>
									<Icon
										source={
											isRunning
												? 'sync'
												: isRateLimited
													? 'alert-circle-outline'
													: isWaitingConfirm
														? 'check-circle-outline'
														: 'clock-outline'
										}
										size={14}
										color={statusColor}
									/>
									<Text
										variant='bodySmall'
										numberOfLines={1}
										style={{ color: statusColor, flex: 1 }}
									>
										{statusText}
									</Text>
								</View>

								{isRunning && currentTrackTitle ? (
									<Text
										variant='labelSmall'
										numberOfLines={1}
										style={{
											color: colors.onSurfaceVariant,
											marginTop: 2,
										}}
									>
										当前：{currentTrackTitle}
									</Text>
								) : null}
							</View>

							<View style={styles.actionsContainer}>
								<Button
									mode={isWaitingConfirm ? 'contained' : 'contained-tonal'}
									compact
									onPress={handlePrimaryAction}
								>
									{primaryButtonLabel}
								</Button>
								<IconButton
									icon='trash-can-outline'
									size={18}
									iconColor={colors.onSurfaceVariant}
									onPress={handleDiscardDraft}
								/>
							</View>
						</View>

						{totalCount > 0 && (
							<ProgressBar
								progress={progress}
								color={isRateLimited ? colors.error : colors.primary}
								style={styles.progressBar}
							/>
						)}
					</View>
				</Touchable>
				<Divider />
			</View>
		)
	},
)

const styles = StyleSheet.create({
	rectButton: {
		borderRadius: 12,
		marginBottom: 6,
		overflow: 'hidden',
	},
	cardInner: {
		paddingHorizontal: 8,
		paddingTop: 8,
		paddingBottom: 6,
	},
	itemContainer: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	textContainer: {
		marginLeft: 12,
		flex: 1,
		marginRight: 8,
	},
	titleRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		marginBottom: 2,
	},
	draftBadge: {
		paddingHorizontal: 6,
		paddingVertical: 1,
		borderRadius: 4,
	},
	titleText: {
		flex: 1,
	},
	subtitleContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		marginTop: 2,
	},
	actionsContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 2,
	},
	progressBar: {
		height: 3,
		borderRadius: 2,
		marginTop: 8,
	},
})

DraftImportPlaylistItem.displayName = 'DraftImportPlaylistItem'

export default DraftImportPlaylistItem
