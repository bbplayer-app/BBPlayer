import { useRouter } from 'expo-router'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Dialog, ProgressBar, Text } from 'react-native-paper'

import Button from '@/components/common/Button'
import { usePlaylistSync } from '@/hooks/mutations/db/playlist'
import { useModalStore } from '@/hooks/stores/useModalStore'
import type { FavoriteSyncProgress } from '@/lib/facades/syncBilibiliPlaylist'

const FavoriteSyncProgressModal = memo(function FavoriteSyncProgressModal({
	favoriteId,
	shouldRedirectToLocalPlaylist,
}: {
	favoriteId: number
	shouldRedirectToLocalPlaylist?: boolean
}) {
	const _close = useModalStore((state) => state.close)
	const router = useRouter()
	const syncedPlaylistId = useRef<number | undefined>(undefined)

	const close = useCallback(() => {
		_close('FavoriteSyncProgress')
		if (shouldRedirectToLocalPlaylist && syncedPlaylistId.current) {
			const targetId = syncedPlaylistId.current
			useModalStore.getState().doAfterModalHostClosed(() => {
				router.push(`/playlist/local/${targetId}`)
			})
		}
	}, [_close, shouldRedirectToLocalPlaylist, router])

	const [progress, setProgress] = useState<FavoriteSyncProgress | null>(null)
	const { mutate: syncFavorite, isPending } = usePlaylistSync()
	const hasSyncStarted = useRef(false)

	// Auto-start sync on mount
	useEffect(() => {
		if (hasSyncStarted.current) return
		hasSyncStarted.current = true

		syncFavorite(
			{
				remoteSyncId: favoriteId,
				type: 'favorite',
				onProgress: setProgress,
			},
			{
				onSuccess: (id) => {
					syncedPlaylistId.current = id
					setProgress((prev) =>
						prev ? { ...prev, stage: 'completed', message: '同步完成' } : null,
					)
				},
				onError: (error) => {
					setProgress((prev) =>
						prev
							? {
									...prev,
									stage: 'error',
									message: `同步失败: ${error.message}`,
								}
							: null,
					)
				},
			},
		)
	}, [favoriteId, syncFavorite])

	let localProgress: number | undefined
	if (
		progress?.current !== undefined &&
		progress?.total !== undefined &&
		progress.total > 0
	) {
		localProgress = progress.current / progress.total
	} else if (progress?.stage === 'completed') {
		localProgress = 1
	} else {
		localProgress = undefined
	}

	const isFinished =
		progress?.stage === 'completed' || progress?.stage === 'error'

	return (
		<>
			<Dialog.Title>
				{progress?.stage === 'completed'
					? '同步完成'
					: progress?.stage === 'error'
						? '同步失败'
						: '正在同步收藏夹'}
			</Dialog.Title>
			<Dialog.Content>
				<View style={styles.content}>
					<Text
						variant='bodyMedium'
						style={styles.message}
					>
						{progress?.message ?? '准备中...'}
					</Text>
					<ProgressBar
						progress={localProgress ?? 0}
						indeterminate={localProgress === undefined}
						style={styles.progressBar}
					/>
				</View>
			</Dialog.Content>
			<Dialog.Actions>
				<Button
					onPress={close}
					disabled={!isFinished && isPending}
				>
					{isFinished ? '关闭' : '请稍候'}
				</Button>
			</Dialog.Actions>
		</>
	)
})

FavoriteSyncProgressModal.displayName = 'FavoriteSyncProgressModal'

const styles = StyleSheet.create({
	content: {
		gap: 15,
		paddingVertical: 10,
	},
	message: {
		textAlign: 'center',
	},
	progressBar: {
		height: 8,
		borderRadius: 4,
	},
})

export default FavoriteSyncProgressModal
