import {
	eventListner,
	type ProgressEvent,
} from '@/hooks/stores/useDownloadManagerStore'
import {
	DownloadState,
	Orpheus,
	type DownloadTask,
} from '@roitium/expo-orpheus'
import { useRecyclingState } from '@shopify/flash-list'
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { Icon, IconButton, Surface, Text, useTheme } from 'react-native-paper'
import Animated, {
	useAnimatedStyle,
	useSharedValue,
} from 'react-native-reanimated'

const DownloadTaskItem = memo(function DownloadTaskItem({
	initTask,
}: {
	initTask: DownloadTask
}) {
	const { colors } = useTheme()
	const [task, setTask] = useRecyclingState<DownloadTask>(initTask, [
		initTask.id,
	])
	const sharedProgress = useSharedValue(0)
	const progressBackgroundWidth = useSharedValue(0)
	const containerRef = useRef<View>(null)

	useEffect(() => {
		const handler = (e: ProgressEvent['progress:uniqueKey']) => {
			sharedProgress.value = e.percent
			if (e.state !== task.state) {
				setTask((task) => ({ ...task, state: e.state }))
			}
		}
		eventListner.on(`progress:${task.id}`, handler)

		return () => {
			eventListner.off(`progress:${task.id}`, handler)
		}
	}, [task.id, sharedProgress, task.state, setTask])

	useLayoutEffect(() => {
		if (!containerRef.current) return
		containerRef.current.measure((_x, _y, width) => {
			progressBackgroundWidth.value = width
		})
	}, [progressBackgroundWidth])

	useEffect(() => {
		// 只清除当前任务的进度，而不清除 progressBackgroundWidth
		sharedProgress.set(0)
	}, [sharedProgress, task.id])

	const progressBackgroundAnimatedStyle = useAnimatedStyle(() => {
		return {
			transform: [
				{
					translateX:
						(sharedProgress.value - 1) * progressBackgroundWidth.value,
				},
			],
		}
	})

	const getStatusText = () => {
		switch (task.state) {
			case DownloadState.QUEUED:
				return '等待下载...'
			case DownloadState.DOWNLOADING:
				return '正在下载...'
			case DownloadState.FAILED:
				return '下载失败'
			case DownloadState.COMPLETED:
				return '下载完成'
			default:
				return '未知状态'
		}
	}

	const icons = useMemo(() => {
		let icon = null
		switch (task.state) {
			case DownloadState.QUEUED:
				icon = (
					<Icon
						source='human-queue'
						size={24}
					/>
				)
				break
			case DownloadState.DOWNLOADING:
				icon = (
					<Icon
						source='progress-download'
						size={24}
					/>
				)
				break
			case DownloadState.FAILED:
				icon = (
					<Icon
						source='close-circle-outline'
						size={24}
						color={colors.error}
					/>
				)
				break
			case DownloadState.COMPLETED:
				icon = (
					<Icon
						source='check-circle-outline'
						size={24}
					/>
				)
				break
			default:
				icon = (
					<Icon
						source='help-circle-outline'
						size={24}
					/>
				)
				break
		}

		return (
			<>
				<View style={styles.iconsContainer}>
					{task.state === DownloadState.FAILED && (
						<IconButton
							icon='reload'
							onPress={async () => {
								if (!task.track) return
								await Orpheus.downloadTrack(task.track)
							}}
						/>
					)}
					<View
						style={{ marginRight: task.state === DownloadState.FAILED ? 0 : 0 }}
					>
						{icon}
					</View>
					<IconButton
						icon='close'
						onPress={() => Orpheus.removeDownload(task.id)}
					/>
				</View>
			</>
		)
	}, [colors.error, task.id, task.state, task.track])

	return (
		<>
			<Surface
				ref={containerRef}
				style={styles.surface}
				elevation={0}
			>
				<View style={styles.itemContainer}>
					<View style={styles.textContainer}>
						<Text
							variant='bodyMedium'
							numberOfLines={1}
						>
							{task.track?.title ?? '未知任务'}
						</Text>
						<View style={styles.statusContainer}>
							<Text
								variant='bodySmall'
								style={{ color: colors.onSurfaceVariant }}
							>
								{getStatusText()}
							</Text>
						</View>
					</View>

					<View style={styles.iconsOuterContainer}>{icons}</View>
				</View>
			</Surface>
			<Animated.View
				style={[
					progressBackgroundAnimatedStyle,
					styles.progressBackground,
					{ backgroundColor: colors.surfaceVariant },
				]}
			></Animated.View>
		</>
	)
})

const styles = StyleSheet.create({
	surface: {
		borderRadius: 8,
		backgroundColor: 'transparent',
		marginVertical: 4,
		marginHorizontal: 8,
		position: 'relative',
		width: '100%',
	},
	itemContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 8,
		paddingVertical: 8,
	},
	textContainer: {
		marginLeft: 12,
		flex: 1,
		marginRight: 4,
		justifyContent: 'center',
	},
	statusContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		marginTop: 2,
	},
	iconsOuterContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'flex-end',
	},
	iconsContainer: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	progressBackground: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		zIndex: -100,
		width: '100%',
	},
})

export default DownloadTaskItem
