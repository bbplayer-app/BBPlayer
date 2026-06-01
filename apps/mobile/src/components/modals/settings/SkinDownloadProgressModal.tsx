import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import { Modal, Portal, Surface, Text, useTheme } from 'react-native-paper'

import LinearProgressIndicator from '@/components/common/LinearProgressIndicator'
import type { SkinDownloadProgress } from '@/lib/theme/skinInstall'

interface SkinDownloadProgressModalProps {
	visible: boolean
	progress: SkinDownloadProgress | null
}

const SkinDownloadProgressModal = memo(function SkinDownloadProgressModal({
	progress,
	visible,
}: SkinDownloadProgressModalProps) {
	const colors = useTheme().colors

	return (
		<Portal>
			<Modal
				visible={visible}
				dismissable={false}
				contentContainerStyle={styles.modalContainer}
			>
				<Surface
					elevation={5}
					style={styles.surface}
				>
					<Text variant='titleMedium'>正在下载主题资产</Text>
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
					<View style={styles.footer}>
						<Text
							variant='bodySmall'
							style={{ color: colors.onSurfaceVariant }}
						>
							{progress && progress.total > 0
								? `${progress.completed}/${progress.total}`
								: '正在获取资产清单'}
						</Text>
					</View>
				</Surface>
			</Modal>
		</Portal>
	)
})

const styles = StyleSheet.create({
	modalContainer: {
		marginHorizontal: 28,
	},
	surface: {
		gap: 12,
		borderRadius: 12,
		padding: 18,
	},
	progress: {
		marginTop: 2,
	},
	footer: {
		alignItems: 'flex-end',
	},
})

export default SkinDownloadProgressModal
