import { and, eq, inArray } from 'drizzle-orm'
import { useCallback, useEffect, useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { Dialog, Text, useTheme } from 'react-native-paper'

import Button from '@/components/common/Button'
import { useModalStore } from '@/hooks/stores/useModalStore'
import db from '@/lib/db/db'
import * as schema from '@/lib/db/schema'
import { playlistSyncWorker } from '@/lib/workers/PlaylistSyncWorker'
import { toastAndLogError } from '@/utils/error-handling'
import toast from '@/utils/toast'

const SCOPE = 'SyncFailuresModal'

type FailureRow = typeof schema.playlistSyncQueue.$inferSelect

const OPERATION_LABELS: Record<string, string> = {
	add_tracks: '添加曲目',
	remove_tracks: '删除曲目',
	reorder_track: '重新排序',
	update_metadata: '更新元数据',
}

export default function SyncFailuresModal({
	playlistId,
}: {
	playlistId?: number
}) {
	const close = useModalStore((state) => state.close)
	const { colors } = useTheme()
	const [rows, setRows] = useState<FailureRow[]>([])
	const [loading, setLoading] = useState(false)

	const loadFailures = useCallback(async () => {
		setLoading(true)
		try {
			const result = await db
				.select()
				.from(schema.playlistSyncQueue)
				.where(
					playlistId != null
						? and(
								eq(schema.playlistSyncQueue.playlistId, playlistId),
								eq(schema.playlistSyncQueue.status, 'failed'),
							)
						: eq(schema.playlistSyncQueue.status, 'failed'),
				)
			setRows(result)
		} catch (error) {
			toastAndLogError('读取同步失败记录出错', error, SCOPE)
		} finally {
			setLoading(false)
		}
	}, [playlistId])

	useEffect(() => {
		void loadFailures()
	}, [loadFailures])

	const handleRetry = async () => {
		if (!rows.length) {
			close('SyncFailures')
			return
		}
		setLoading(true)
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
			close('SyncFailures')
		} catch (error) {
			toastAndLogError('重试同步失败', error, SCOPE)
			setLoading(false)
		}
	}

	const operationLabel = (op: string) => OPERATION_LABELS[op] ?? op

	return (
		<>
			<Dialog.Title>同步失败记录</Dialog.Title>
			<Dialog.Content>
				{loading ? (
					<Text>加载中…</Text>
				) : rows.length === 0 ? (
					<Text>暂无失败记录</Text>
				) : (
					<ScrollView style={styles.list}>
						{rows.map((row) => (
							<Text
								key={row.id}
								variant='bodySmall'
								style={[styles.row, { color: colors.onSurfaceVariant }]}
							>
								{operationLabel(row.operation)}{' '}
								{new Date(row.operationAt).toLocaleString()}
							</Text>
						))}
					</ScrollView>
				)}
			</Dialog.Content>
			<Dialog.Actions>
				<Button
					mode='text'
					onPress={() => close('SyncFailures')}
					disabled={loading}
				>
					关闭
				</Button>
				<Button
					mode='contained'
					onPress={handleRetry}
					loading={loading}
					disabled={loading || rows.length === 0}
				>
					全部重试
				</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	list: { maxHeight: 240 },
	row: {
		marginBottom: 6,
		lineHeight: 18,
	},
})
