import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from 'react'
import { StyleSheet, View } from 'react-native'
import { Dialog, Text } from 'react-native-paper'
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'

import Button from '@/components/common/Button'
import usePreventRemove from '@/hooks/router/usePreventRemove'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { storage } from '@/utils/mmkv'

const titles = ['欢迎使用 BBPlayer', '登录？']

function Step0() {
	return (
		<View>
			<Text>
				看起来你是第一次打开 BBPlayer，容我介绍一下：BBPlayer
				是一款开源、简洁的音乐播放器，你可以使用他播放来自
				{' BiliBili '}的歌曲。
				{'\n\n'}
				风险声明：虽然开发者尽力负责任地调用{' BiliBili API'}，但
				<Text style={styles.boldText}>仍不保证</Text>
				您的账号安全无虞，你可能会遇到包括但不限于：账号被风控、短期封禁乃至永久封禁等风险。请权衡利弊后再选择登录。（虽然我用了这么久还没遇到任何问题）
				{'\n\n'}
				如果您选择「游客模式」，本地播放列表、搜索、查看合集等大部分功能仍可使用，但无法访问并即时查看您自己收藏夹中的更新。
			</Text>
		</View>
	)
}

function Step1({
	onLogin,
	onGuestMode,
}: {
	onLogin: () => void
	onGuestMode: () => void
}) {
	return (
		<View>
			<Text>最后一步！选择登录还是游客模式？</Text>

			<View style={styles.stepButtonContainer}>
				<Button
					mode='contained'
					onPress={onLogin}
				>
					登录
				</Button>
				<Button
					onPress={onGuestMode}
					testID='welcome-guest-mode'
				>
					游客模式
				</Button>
			</View>
		</View>
	)
}

export default function WelcomeModal() {
	const _close = useModalStore((s) => s.close)
	const close = useCallback(() => _close('Welcome'), [_close])
	const open = useModalStore((s) => s.open)

	const [step, setStep] = useState(0)

	const containerRef = useRef<View>(null)
	const [measuredWidth, setMeasuredWidth] = useState(0)
	const [stepHeights, setStepHeights] = useState<[number, number]>([0, 0])

	const translateX = useSharedValue(0)
	const containerHeight = useSharedValue(0)

	const animatedContainerStyle = useAnimatedStyle(() => ({
		height: containerHeight.value,
		overflow: 'hidden',
	}))

	const animatedRowStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: translateX.value }],
	}))

	useEffect(() => {
		// oxlint-disable-next-line react-you-might-not-need-an-effect/no-event-handler
		if (measuredWidth <= 0) return
		translateX.set(withTiming(-step * measuredWidth, { duration: 300 }))
		containerHeight.set(withTiming(stepHeights[step], { duration: 300 }))
	}, [step, translateX, containerHeight, stepHeights, measuredWidth])

	useLayoutEffect(() => {
		containerRef.current?.measure((_x, _y, width) => {
			setMeasuredWidth(width)
		})
	}, [containerRef])

	const goToStep = (index: number) => {
		const maxIndex = Math.max(0, (titles.length || stepHeights.length) - 1)
		const idx = Math.max(0, Math.min(maxIndex, index))
		setStep(idx)
	}

	const confirmGuestMode = useCallback(() => {
		storage.set('first_open', false)
		close()
	}, [close])
	const confirmLogin = useCallback(() => {
		storage.set('first_open', false)
		open('QRCodeLogin', undefined)
		close()
	}, [close, open])

	usePreventRemove(true, () => goToStep(step - 1))

	return (
		<>
			<View
				style={styles.hiddenStepsContainer}
				accessible={false}
			>
				<View
					style={{ width: measuredWidth }}
					collapsable={false}
					onLayout={(e) => {
						const height = e.nativeEvent.layout.height ?? 0
						if (height <= stepHeights[0]) {
							return
						}
						setStepHeights((s) => [height, s[1]])
					}}
				>
					<Step0 />
				</View>
				<View
					collapsable={false}
					style={{ width: measuredWidth }}
					onLayout={(e) => {
						const height = e.nativeEvent.layout.height ?? 0
						if (height <= stepHeights[1]) {
							return
						}
						setStepHeights((s) => [s[0], height])
					}}
				>
					<Step1
						onLogin={confirmLogin}
						onGuestMode={confirmGuestMode}
					/>
				</View>
			</View>
			<Dialog.Title>{titles[step]}</Dialog.Title>

			<Dialog.Content>
				<Animated.View
					style={[animatedContainerStyle]}
					ref={containerRef}
				>
					<Animated.View
						style={[
							animatedRowStyle,
							{ flexDirection: 'row', width: measuredWidth * 2 },
						]}
					>
						<View style={{ width: measuredWidth }}>
							<Step0 />
						</View>
						<View style={{ width: measuredWidth }}>
							<Step1
								onLogin={confirmLogin}
								onGuestMode={confirmGuestMode}
							/>
						</View>
					</Animated.View>
				</Animated.View>
			</Dialog.Content>

			<Dialog.Actions>
				{step > 0 && <Button onPress={() => goToStep(step - 1)}>上一步</Button>}

				{step < 1 && (
					<Button
						onPress={() => goToStep(step + 1)}
						testID='welcome-next-step'
					>
						下一步
					</Button>
				)}
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	boldText: {
		fontWeight: '800',
	},
	stepButtonContainer: {
		flexDirection: 'row',
		gap: 8,
		paddingTop: 20,
		justifyContent: 'flex-end',
	},
	hiddenStepsContainer: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		pointerEvents: 'none',
		opacity: 0,
	},
})
