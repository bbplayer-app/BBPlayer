import type { SyncProgress } from '@/lib/facades/sync'
import { StyleSheet, View } from 'react-native'
import {
	Button,
	Modal,
	Portal,
	ProgressBar,
	Text,
	useTheme,
} from 'react-native-paper'

interface SyncProgressModalProps {
	visible: boolean
	progress: SyncProgress | null
	onClose: () => void
}

export const SyncProgressModal = ({
	visible,
	progress,
	onClose,
}: SyncProgressModalProps) => {
	const { colors } = useTheme()
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
		localProgress = undefined // Indeterminate
	}

	const isFinished =
		progress?.stage === 'completed' || progress?.stage === 'error'

	return (
		<Portal>
			<Modal
				visible={visible}
				dismissable={isFinished}
				onDismiss={onClose}
				contentContainerStyle={[
					styles.container,
					{ backgroundColor: colors.surface },
				]}
			>
				<Text
					variant='titleMedium'
					style={styles.title}
				>
					{progress?.stage === 'completed' ? '同步完成' : '正在同步收藏夹'}
				</Text>
				<View style={styles.content}>
					<Text
						variant='bodyMedium'
						style={styles.message}
					>
						{progress?.message ?? '准备中...'}
					</Text>
					<ProgressBar
						progress={localProgress}
						indeterminate={localProgress === undefined}
						style={styles.progressBar}
					/>
					{isFinished && (
						<Button
							onPress={onClose}
							style={styles.button}
						>
							关闭
						</Button>
					)}
				</View>
			</Modal>
		</Portal>
	)
}

const styles = StyleSheet.create({
	container: {
		padding: 20,
		margin: 20,
		borderRadius: 8,
	},
	title: {
		marginBottom: 10,
		textAlign: 'center',
	},
	content: {
		gap: 10,
	},
	message: {
		textAlign: 'center',
		marginBottom: 5,
	},
	progressBar: {
		height: 8,
		borderRadius: 4,
	},
	button: {
		marginTop: 10,
		alignSelf: 'center',
	},
})
