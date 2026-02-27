import type { TrueSheet } from '@lodev09/react-native-true-sheet'
import { TrueSheet as TrueSheetComponent } from '@lodev09/react-native-true-sheet'
import { and, eq, inArray } from 'drizzle-orm'
import { useLiveQuery } from 'drizzle-orm/expo-sqlite'
import { forwardRef, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native'
import { Icon, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Button from '@/components/common/Button'
import db from '@/lib/db/db'
import * as schema from '@/lib/db/schema'
import { playlistSyncWorker } from '@/lib/workers/PlaylistSyncWorker'
import { toastAndLogError } from '@/utils/error-handling'
import { formatRelativeTime } from '@/utils/time'
import toast from '@/utils/toast'

const SCOPE = 'SyncFailuresSheet'

const OPERATION_INFO: Record<string, { label: string; icon: string }> = {
	add_tracks: { label: '添加曲目', icon: 'plus-circle-outline' },
	remove_tracks: { label: '删除曲目', icon: 'minus-circle-outline' },
	reorder_track: { label: '重新排序', icon: 'swap-vertical' },
	update_metadata: { label: '更新元数据', icon: 'pencil-outline' },
}

interface Props {
	playlistId?: number
}

export const SyncFailuresSheet = forwardRef<TrueSheet, Props>(
	function SyncFailuresSheet({ playlistId }, ref) {
		const { colors } = useTheme()
		const insets = useSafeAreaInsets()
		const [loading, setLoading] = useState(false)

		const { data: rows = [] } = useLiveQuery(
			db
				.select()
				.from(schema.playlistSyncQueue)
				.where(
					playlistId != null
						? and(
								eq(schema.playlistSyncQueue.playlistId, playlistId),
								eq(schema.playlistSyncQueue.status, 'failed'),
							)
						: eq(schema.playlistSyncQueue.status, 'failed'),
				),
		)

		const handleRetry = async () => {
			if (!rows.length) {
				if (ref && 'current' in ref && ref.current) {
					void ref.current.dismiss()
				}
				return
			}
			setLoading(true)
			let success = false
			try {
				await db
					.update(schema.playlistSyncQueue)
					.set({ status: 'pending' })
					.where(
						inArray(
							schema.playlistSyncQueue.id,
							rows.map((r) => r.id),
						),
					)
				playlistSyncWorker.triggerSync()
				toast.success('已重新加入同步队列')
				success = true
			} catch (error) {
				toastAndLogError('重试同步失败', error, SCOPE)
			} finally {
				setLoading(false)
			}

			if (success) {
				if (ref && 'current' in ref && ref.current) {
					void ref.current.dismiss()
				}
			}
		}

		const getOperationInfo = (op: string) =>
			OPERATION_INFO[op] ?? { label: op, icon: 'help-circle-outline' }

		return (
			<TrueSheetComponent
				ref={ref}
				detents={[0.5]}
				cornerRadius={24}
				backgroundColor={colors.elevation.level1}
				scrollable
			>
				<View style={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
					<Text
						variant='titleLarge'
						style={styles.title}
					>
						同步失败记录
					</Text>

					{loading ? (
						<View style={styles.center}>
							<ActivityIndicator size='large' />
						</View>
					) : rows.length === 0 ? (
						<View style={styles.center}>
							<Text style={{ color: colors.onSurfaceVariant }}>
								暂无失败记录
							</Text>
						</View>
					) : (
						<ScrollView
							style={styles.listContent}
							nestedScrollEnabled
						>
							{rows.map((row) => {
								const info = getOperationInfo(row.operation)
								return (
									<View
										key={row.id}
										style={styles.row}
									>
										<View
											style={[
												styles.iconContainer,
												{ backgroundColor: colors.elevation.level3 },
											]}
										>
											<Icon
												source={info.icon}
												size={24}
												color={colors.onSurface}
											/>
										</View>
										<View style={styles.rowInfo}>
											<Text variant='bodyLarge'>{info.label}</Text>
											<Text
												variant='bodySmall'
												style={{ color: colors.onSurfaceVariant }}
											>
												{formatRelativeTime(row.operationAt)}
											</Text>
										</View>
									</View>
								)
							})}
						</ScrollView>
					)}

					<View style={styles.actions}>
						<Button
							mode='contained'
							onPress={handleRetry}
							loading={loading}
							disabled={loading || rows.length === 0}
							style={styles.retryButton}
						>
							全部重试
						</Button>
					</View>
				</View>
			</TrueSheetComponent>
		)
	},
)

const styles = StyleSheet.create({
	container: {
		paddingTop: 16,
		paddingHorizontal: 16,
		maxHeight: 500,
	},
	title: {
		fontWeight: 'bold',
		marginBottom: 16,
		textAlign: 'center',
	},
	center: {
		paddingVertical: 40,
		alignItems: 'center',
		justifyContent: 'center',
	},
	listContent: {
		maxHeight: 300,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 12,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: 'rgba(150, 150, 150, 0.2)',
	},
	iconContainer: {
		width: 40,
		height: 40,
		borderRadius: 20,
		alignItems: 'center',
		justifyContent: 'center',
		marginRight: 12,
	},
	rowInfo: {
		flex: 1,
		gap: 2,
	},
	actions: {
		marginTop: 24,
		flexDirection: 'row',
		justifyContent: 'center',
	},
	retryButton: {
		width: '100%',
	},
})
