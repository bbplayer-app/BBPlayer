import { WavySlider } from 'expo-wavy-slider'
import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
	Pressable,
	ScrollView,
	StyleSheet,
	StatusBar,
	Text,
	View,
} from 'react-native'
import {
	Easing,
	useAnimatedReaction,
	useDerivedValue,
	useFrameCallback,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<View style={styles.section}>
			<Text style={styles.title}>{title}</Text>
			{children}
		</View>
	)
}

function BasicSlider() {
	const [value, setValue] = useState(0.35)

	const handleValueChange = useCallback((nextValue: number) => {
		'worklet'
		scheduleOnRN(setValue, nextValue)
	}, [])

	return (
		<Section title='Controlled by React state'>
			<WavySlider
				style={styles.slider}
				value={value}
				bufferedValue={0.72}
				waveLength={18}
				waveHeight={12}
				waveVelocity={12}
				waveThickness={4}
				trackThickness={4}
				colors={pinkColors}
				onValueChange={handleValueChange}
			/>
			<Text style={styles.caption}>{Math.round(value * 100)}%</Text>
		</Section>
	)
}

function PlayerLikeSlider() {
	const [playing, setPlaying] = useState(true)
	const [timeLabel, setTimeLabel] = useState('0:42 / 3:00')
	const duration = useSharedValue(180)
	const position = useSharedValue(42)
	const progress = useDerivedValue(() => position.value / duration.value)
	const bufferedProgress = useSharedValue(0.76)
	const playingValue = useSharedValue(true)
	const dragging = useSharedValue(false)
	const scrubPosition = useSharedValue(42)
	const waveHeight = useSharedValue(8)
	const waveVelocity = useSharedValue(16)
	const waveThickness = useSharedValue(4)
	const trackThickness = useSharedValue(4)

	useEffect(() => {
		playingValue.set(playing)
	}, [playing, playingValue])

	useFrameCallback((frame) => {
		'worklet'
		if (!playingValue.value || dragging.value) return
		const delta = (frame.timeSincePreviousFrame ?? 0) / 1000
		const nextPosition = position.value + delta
		position.set(nextPosition >= duration.value ? 0 : nextPosition)
	})

	useAnimatedReaction(
		() => [playingValue.value, dragging.value] as const,
		([isPlaying, isDragging]) => {
			waveHeight.set(
				withTiming(isPlaying && !isDragging ? 8 : 0, {
					duration: isDragging ? 120 : 300,
				}),
			)
			waveVelocity.set(
				withTiming(isPlaying ? 16 : 0, {
					duration: isPlaying ? 150 : 100,
				}),
			)
			waveThickness.set(withTiming(isDragging ? 12 : 4, { duration: 180 }))
			trackThickness.set(withTiming(isDragging ? 12 : 4, { duration: 180 }))
		},
	)

	useAnimatedReaction(
		() => Math.trunc(dragging.value ? scrubPosition.value : position.value),
		(nextPosition) => {
			const format = (seconds: number) => {
				'worklet'
				const wholeSeconds = Math.max(0, Math.trunc(seconds))
				const minutes = Math.trunc(wholeSeconds / 60)
				const rest = wholeSeconds % 60
				return `${minutes}:${rest < 10 ? '0' : ''}${rest}`
			}
			scheduleOnRN(
				setTimeLabel,
				`${format(nextPosition)} / ${format(duration.value)}`,
			)
		},
	)

	const handleValueChange = useCallback(
		(nextValue: number) => {
			'worklet'
			dragging.set(true)
			scrubPosition.set(nextValue * duration.value)
		},
		[dragging, duration, scrubPosition],
	)

	const handleValueChangeFinished = useCallback(
		(nextValue: number) => {
			'worklet'
			position.set(nextValue * duration.value)
			dragging.set(false)
		},
		[dragging, duration, position],
	)

	const handleDragStateChange = useCallback(
		(nextDragging: boolean) => {
			'worklet'
			dragging.set(nextDragging)
		},
		[dragging],
	)

	return (
		<Section title='Player progress with drag animation'>
			<View style={styles.toolbar}>
				<Pressable
					style={styles.button}
					onPress={() => {
						setPlaying((value) => !value)
					}}
				>
					<Text style={styles.buttonText}>{playing ? 'Pause' : 'Play'}</Text>
				</Pressable>
				<Text style={styles.caption}>{timeLabel}</Text>
			</View>
			<WavySlider
				style={styles.slider}
				progress={progress}
				bufferedProgress={bufferedProgress}
				waveLength={30}
				waveHeight={waveHeight}
				waveVelocity={waveVelocity}
				waveThickness={waveThickness}
				trackThickness={trackThickness}
				colors={blueColors}
				onValueChange={handleValueChange}
				onValueChangeFinished={handleValueChangeFinished}
				onDragStateChange={handleDragStateChange}
			/>
		</Section>
	)
}

function BufferedSlider() {
	const [value, setValue] = useState(0.28)
	const buffered = useSharedValue(0.68)

	useEffect(() => {
		buffered.set(
			withTiming(value > 0.75 ? 1 : Math.min(value + 0.4, 0.95), {
				duration: 500,
				easing: Easing.out(Easing.cubic),
			}),
		)
	}, [buffered, value])

	const handleValueChange = useCallback(
		(nextValue: number) => {
			'worklet'
			const targetBuffered =
				nextValue > 0.75 ? 1 : Math.min(nextValue + 0.4, 0.95)
			buffered.set(Math.max(buffered.value, targetBuffered))
			scheduleOnRN(setValue, nextValue)
		},
		[buffered],
	)

	return (
		<Section title='Buffered track'>
			<WavySlider
				style={styles.slider}
				value={value}
				bufferedProgress={buffered}
				waveLength={0}
				waveHeight={0}
				waveVelocity={0}
				waveThickness={5}
				trackThickness={5}
				colors={amberColors}
				onValueChange={handleValueChange}
			/>
			<Text style={styles.caption}>
				Buffered progress stays behind the thumb gap.
			</Text>
		</Section>
	)
}

export default function App() {
	return (
		<View style={styles.screen}>
			<StatusBar barStyle='light-content' />
			<ScrollView contentContainerStyle={styles.content}>
				<Text style={styles.heading}>Wavy Slider</Text>
				<BasicSlider />
				<PlayerLikeSlider />
				<BufferedSlider />
			</ScrollView>
		</View>
	)
}

const pinkColors = {
	activeTrackColor: '#ff4b7a',
	bufferedTrackColor: 'rgba(255, 75, 122, 0.28)',
	inactiveTrackColor: '#383640',
	thumbColor: '#ff4b7a',
}

const blueColors = {
	activeTrackColor: '#67d1ff',
	bufferedTrackColor: 'rgba(103, 209, 255, 0.25)',
	inactiveTrackColor: '#303846',
	thumbColor: '#67d1ff',
}

const amberColors = {
	activeTrackColor: '#ffbf47',
	bufferedTrackColor: 'rgba(255, 191, 71, 0.3)',
	inactiveTrackColor: '#40382a',
	thumbColor: '#ffbf47',
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: '#111217',
		paddingTop: StatusBar.currentHeight ?? 0,
	},
	content: {
		gap: 18,
		paddingHorizontal: 20,
		paddingVertical: 28,
	},
	heading: {
		color: '#f4f5f7',
		fontSize: 30,
		fontWeight: '700',
	},
	section: {
		gap: 10,
		paddingVertical: 16,
	},
	title: {
		color: '#f4f5f7',
		fontSize: 16,
		fontWeight: '600',
	},
	slider: {
		alignSelf: 'stretch',
		height: 34,
	},
	caption: {
		color: '#b6bac4',
		fontVariant: ['tabular-nums'],
	},
	toolbar: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: 12,
	},
	button: {
		alignItems: 'center',
		backgroundColor: '#f4f5f7',
		borderRadius: 6,
		height: 36,
		justifyContent: 'center',
		paddingHorizontal: 16,
	},
	buttonText: {
		color: '#111217',
		fontWeight: '700',
	},
})
