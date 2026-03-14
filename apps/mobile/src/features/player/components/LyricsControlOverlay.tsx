import { LinearGradient } from 'expo-linear-gradient'
import { memo, useCallback, useEffect, useRef } from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'
import {
	Gesture,
	GestureDetector,
	RectButton,
} from 'react-native-gesture-handler'
import { Icon, useTheme } from 'react-native-paper'
import Animated, {
	useAnimatedReaction,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
	interpolate,
	type SharedValue,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { MainPlaybackControls } from '@/features/player/components/PlayerControls'
import { PlayerSlider } from '@/features/player/components/PlayerSlider'

const { height: windowHeight } = Dimensions.get('window')
const OVERLAY_HEIGHT = windowHeight * 0.4
const AUTO_HIDE_DELAY = 3000

interface LyricsControlOverlayProps {
	scrollDirection: SharedValue<'up' | 'down' | 'idle'>
	offsetMenuVisible: boolean
	onOpenActionMenu: (anchor: {
		x: number
		y: number
		width: number
		height: number
	}) => void
	onControlsVisibilityChange?: (visible: boolean) => void
}

export const LyricsControlOverlay = memo(function LyricsControlOverlay({
	scrollDirection,
	offsetMenuVisible,
	onOpenActionMenu,
	onControlsVisibilityChange,
}: LyricsControlOverlayProps) {
	const { colors, dark } = useTheme()
	const actionButtonRef = useRef<View>(null)
	const controlsOpacity = useSharedValue(0)
	const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const clearHideTimer = useCallback(() => {
		if (hideTimerRef.current) {
			clearTimeout(hideTimerRef.current)
			hideTimerRef.current = null
		}
	}, [])

	const startHideTimer = useCallback(() => {
		clearHideTimer()
		hideTimerRef.current = setTimeout(() => {
			controlsOpacity.set(withTiming(0, { duration: 300 }))
		}, AUTO_HIDE_DELAY)
	}, [clearHideTimer, controlsOpacity])

	const showControls = useCallback(() => {
		controlsOpacity.set(withTiming(1, { duration: 200 }))
		onControlsVisibilityChange?.(true)
		startHideTimer()
	}, [controlsOpacity, startHideTimer, onControlsVisibilityChange])

	const hideControls = useCallback(() => {
		clearHideTimer()
		controlsOpacity.set(withTiming(0, { duration: 200 }))
		onControlsVisibilityChange?.(false)
	}, [clearHideTimer, controlsOpacity, onControlsVisibilityChange])

	const resetHideTimer = useCallback(() => {
		startHideTimer()
	}, [startHideTimer])

	// 监听滚动方向变化
	useAnimatedReaction(
		() => scrollDirection.value,
		(current, previous) => {
			if (current === previous) return
			if (current === 'up') {
				// 上滑 - 隐藏控件
				scheduleOnRN(hideControls)
			} else if (current === 'down') {
				// 下滑 - 显示控件
				scheduleOnRN(showControls)
			}
		},
	)

	// 清理定时器
	useEffect(() => {
		return () => {
			clearHideTimer()
		}
	}, [clearHideTimer])

	// 点击手势切换控件显示
	const tapGesture = Gesture.Tap().onEnd(() => {
		'worklet'
		if (controlsOpacity.value < 0.5) {
			scheduleOnRN(showControls)
		} else {
			scheduleOnRN(resetHideTimer)
		}
	})

	// 控件交互时重置隐藏定时器
	const handleInteraction = useCallback(() => {
		resetHideTimer()
	}, [resetHideTimer])

	// 按钮动画样式
	const utilityButtonsAnimatedStyle = useAnimatedStyle(() => {
		return {
			opacity: interpolate(
				controlsOpacity.value,
				[0, 1],
				[1, 0], // 当控件显示时，完全隐藏按钮
			),
			pointerEvents: controlsOpacity.value > 0.5 ? 'none' : 'auto',
		}
	})

	const controlsAnimatedStyle = useAnimatedStyle(() => ({
		opacity: controlsOpacity.value,
		pointerEvents: controlsOpacity.value > 0.5 ? 'auto' : 'none',
	}))

	// 渐变颜色
	const gradientColors = dark
		? (['rgba(0,0,0,0)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)'] as const)
		: ([
				'rgba(255,255,255,0)',
				'rgba(255,255,255,0.4)',
				'rgba(255,255,255,0.8)',
			] as const)

	return (
		<View
			style={styles.overlayContainer}
			pointerEvents='box-none'
		>
			{/* 渐变背景 + 点击区域 */}
			<GestureDetector gesture={tapGesture}>
				<Animated.View style={styles.gradient}>
					<LinearGradient
						style={styles.gradientInner}
						colors={gradientColors}
						locations={[0, 0.4, 1]}
					/>
				</Animated.View>
			</GestureDetector>

			{/* 功能按钮 - 始终可见，右下角 */}
			<Animated.View
				style={[styles.utilityButtons, utilityButtonsAnimatedStyle]}
			>
				<RectButton
					style={styles.utilityButton}
					// @ts-expect-error -- RectButton ref typing
					ref={actionButtonRef}
					enabled={!offsetMenuVisible}
					onPress={() => {
						actionButtonRef.current?.measure((_x, _y, w, h, pageX, pageY) => {
							onOpenActionMenu({ x: pageX, y: pageY, width: w, height: h })
						})
					}}
				>
					<Icon
						source='dots-vertical'
						size={20}
						color={
							offsetMenuVisible ? colors.onSurfaceDisabled : colors.primary
						}
					/>
				</RectButton>
			</Animated.View>

			{/* 播放器控件 - 条件显示 */}
			<Animated.View style={[styles.playerControls, controlsAnimatedStyle]}>
				<PlayerSlider onInteraction={handleInteraction} />
				<View style={styles.playbackButtonsWrapper}>
					<MainPlaybackControls
						size='compact'
						onInteraction={handleInteraction}
					/>
				</View>
			</Animated.View>
		</View>
	)
})

const styles = StyleSheet.create({
	overlayContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		height: OVERLAY_HEIGHT,
	},
	gradient: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
	},
	gradientInner: {
		flex: 1,
	},
	utilityButtons: {
		position: 'absolute',
		bottom: 40,
		right: 16,
		flexDirection: 'column',
	},
	utilityButton: {
		borderRadius: 99999,
		padding: 10,
	},
	playerControls: {
		position: 'absolute',
		bottom: 50,
		left: 0,
		right: 0,
	},
	playbackButtonsWrapper: {
		marginTop: 8,
	},
})
