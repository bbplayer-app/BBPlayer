import { Orpheus } from '@bbplayer/orpheus'
import { memo, useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Dialog, ProgressBar, Text } from 'react-native-paper'

import Button from '@/components/common/Button'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { toastAndLogError } from '@/utils/error-handling'

interface ProgressState {
	current: number
	total: number
	failed: number
	stage: 'pending' | 'downloading' | 'completed' | 'error'
	message: string
}

const CoverDownloadProgressModal = memo(function CoverDownloadProgressModal() {
	const close = useModalStore((state) => state.close)
	const [progress, setProgress] = useState<ProgressState>({
		current: 0,
		total: 0,
		failed: 0,
		stage: 'pending',
		message: '准备中...',
	})
	const hasStarted = useRef(false)

	useEffect(() => {
		if (hasStarted.current) return
		hasStarted.current = true

		const subscription = Orpheus.addListener(
			'onCoverDownloadProgress',
			(event) => {
				setProgress((prev) => {
					const failed = prev.failed + (event.status === 'failed' ? 1 : 0)
					const isLast = event.current === event.total
					return {
						current: event.current,
						total: event.total,
						failed,
						stage: isLast ? 'completed' : 'downloading',
						message: isLast
							? failed > 0
								? `完成，${event.total - failed} 个成功，${failed} 个失败`
								: `全部 ${event.total} 个封面下载完成`
							: `正在下载 ${event.current}/${event.total}...`,
					}
				})
			},
		)

		Orpheus.downloadMissingCovers()
			.then((total) => {
				if (total === 0) {
					setProgress({
						current: 0,
						total: 0,
						failed: 0,
						stage: 'completed',
						message: '所有封面已完整，无需下载',
					})
				}
			})
			.catch((e: unknown) => {
				toastAndLogError('下载缺失封面失败', e, 'Modal.CoverDownloadProgress')
				setProgress((prev) => ({
					...prev,
					stage: 'error',
					message: '启动下载失败',
				}))
			})

		return () => {
			subscription.remove()
		}
	}, [])

	const isFinished =
		progress.stage === 'completed' || progress.stage === 'error'
	const progressValue =
		progress.total > 0 ? progress.current / progress.total : undefined

	return (
		<>
			<Dialog.Title>
				{progress.stage === 'completed'
					? '下载完成'
					: progress.stage === 'error'
						? '下载失败'
						: '正在下载缺失封面'}
			</Dialog.Title>
			<Dialog.Content>
				<View style={styles.content}>
					<Text
						variant='bodyMedium'
						style={styles.message}
					>
						{progress.message}
					</Text>
					<ProgressBar
						progress={isFinished ? 1 : progressValue}
						indeterminate={!isFinished && progressValue === undefined}
						style={styles.progressBar}
					/>
				</View>
			</Dialog.Content>
			<Dialog.Actions>
				<Button
					onPress={() => close('CoverDownloadProgress')}
					disabled={!isFinished}
				>
					{isFinished ? '关闭' : '请稍候'}
				</Button>
			</Dialog.Actions>
		</>
	)
})

CoverDownloadProgressModal.displayName = 'CoverDownloadProgressModal'

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

export default CoverDownloadProgressModal
