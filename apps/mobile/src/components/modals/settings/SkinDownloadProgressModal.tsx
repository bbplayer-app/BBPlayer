import { useRouter } from 'expo-router'
import { memo, useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Dialog, Text, useTheme } from 'react-native-paper'

import Button from '@/components/common/Button'
import LinearProgressIndicator from '@/components/common/LinearProgressIndicator'
import { alert } from '@/components/modals/AlertModal'
import { useModalStore } from '@/hooks/stores/useModalStore'
import type { GarbSkinSearchResult } from '@/lib/api/bilibili/garb'
import { installSkin } from '@/services/theme/SkinManager'
import type { SkinDownloadProgress } from '@/services/theme/types'
import toast from '@/utils/toast'

interface SkinDownloadProgressModalProps {
	item: GarbSkinSearchResult
}

const SkinDownloadProgressModal = memo(function SkinDownloadProgressModal({
	item,
}: SkinDownloadProgressModalProps) {
	const router = useRouter()
	const colors = useTheme().colors
	const close = useModalStore((state) => state.close)
	const [progress, setProgress] = useState<SkinDownloadProgress | null>(null)
	const [isFinished, setIsFinished] = useState(false)
	const [hasError, setHasError] = useState(false)
	const hasStarted = useRef(false)

	useEffect(() => {
		if (hasStarted.current) return
		hasStarted.current = true

		let cancelled = false

		installSkin({
			item,
			onProgress: (event) => {
				if (!cancelled) setProgress(event)
			},
		})
			.then(() => {
				if (cancelled) return
				setProgress((previous) =>
					previous
						? {
								...previous,
								completed: previous.total,
								progress: 1,
								label: '下载完成',
							}
						: {
								completed: 1,
								total: 1,
								progress: 1,
								label: '下载完成',
							},
				)
				setIsFinished(true)
				close('SkinDownloadProgress')
				useModalStore.getState().doAfterModalHostClosed(() => {
					alert('主题下载完成', '是否现在去启用这个主题？', [
						{ text: '稍后' },
						{
							text: '去启用',
							onPress: () => router.replace('/settings/theme'),
						},
					])
				})
			})
			.catch((error: unknown) => {
				if (cancelled) return
				setHasError(true)
				setIsFinished(true)
				toast.error(error instanceof Error ? error.message : String(error))
			})

		return () => {
			cancelled = true
		}
	}, [close, item, router])

	const canClose = isFinished || hasError

	return (
		<>
			<Dialog.Title>
				{hasError ? '下载失败' : isFinished ? '下载完成' : '正在下载主题资产'}
			</Dialog.Title>
			<Dialog.Content>
				<View style={styles.content}>
					<Text
						variant='bodySmall'
						numberOfLines={2}
						style={{ color: colors.onSurfaceVariant }}
					>
						{progress?.label ?? '准备下载'}
					</Text>
					<LinearProgressIndicator
						progress={progress?.progress ?? 0}
						indeterminate={!progress}
						style={styles.progress}
					/>
					<Text
						variant='bodySmall'
						style={[styles.footer, { color: colors.onSurfaceVariant }]}
					>
						{progress && progress.total > 0
							? `${progress.completed}/${progress.total}`
							: '正在获取资产清单'}
					</Text>
				</View>
			</Dialog.Content>
			<Dialog.Actions>
				<Button
					onPress={() => close('SkinDownloadProgress')}
					disabled={!canClose}
				>
					{canClose ? '关闭' : '请稍候'}
				</Button>
			</Dialog.Actions>
		</>
	)
})

const styles = StyleSheet.create({
	content: {
		gap: 12,
	},
	progress: {
		marginTop: 2,
	},
	footer: {
		textAlign: 'right',
	},
})

export default SkinDownloadProgressModal
