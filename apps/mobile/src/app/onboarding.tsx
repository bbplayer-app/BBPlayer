import { router } from 'expo-router'
import { useCallback, useState } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { Icon, Text, useTheme } from 'react-native-paper'
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Button from '@/components/common/Button'
import usePreventRemove from '@/hooks/router/usePreventRemove'
import { storage } from '@/utils/mmkv'

const ICON_SIZE = 72

function WelcomeSlide() {
	const { colors } = useTheme()
	return (
		<View style={slideStyles.content}>
			<Animated.Image
				source={require('../../assets/images/icon.png')}
				style={slideStyles.logo}
				resizeMode='contain'
			/>
			<Text
				variant='displaySmall'
				style={[slideStyles.title, { color: colors.onSurface }]}
			>
				欢迎使用
			</Text>
			<Text
				variant='headlineLarge'
				style={[slideStyles.brand, { color: colors.primary }]}
			>
				BBPlayer
			</Text>
			<Text
				variant='bodyLarge'
				style={[slideStyles.desc, { color: colors.onSurfaceVariant }]}
			>
				你的 BiliBili 音乐伴侣{'\n'}开源 · 简洁 · 纯粹
			</Text>
		</View>
	)
}

function DisclaimerSlide() {
	const { colors } = useTheme()
	return (
		<View style={slideStyles.content}>
			<Icon
				source='shield-alert'
				size={ICON_SIZE}
				color={colors.error}
			/>
			<Text
				variant='displaySmall'
				style={[slideStyles.title, { color: colors.onSurface }]}
			>
				安全提示
			</Text>
			<Text
				variant='bodyLarge'
				style={[slideStyles.desc, { color: colors.onSurfaceVariant }]}
			>
				虽然开发者尽力负责任地调用 BiliBili API，但
				<Text style={{ fontWeight: '800', color: colors.error }}>
					{' 仍不保证 '}
				</Text>
				您的账号安全无虞。{'\n\n'}
				您可能会遇到包括但不限于：账号被风控、短期封禁乃至永久封禁等风险。请权衡利弊后再选择登录。
				{'\n\n'}
				选择「游客模式」仍可使用本地播放列表、搜索、查看合集等大部分功能。
			</Text>
		</View>
	)
}

function StartSlide({
	onQRCode,
	onPhone,
	onGuest,
}: {
	onQRCode: () => void
	onPhone: () => void
	onGuest: () => void
}) {
	const { colors } = useTheme()
	return (
		<View style={slideStyles.content}>
			<Icon
				source='rocket-launch'
				size={ICON_SIZE}
				color={colors.primary}
			/>
			<Text
				variant='displaySmall'
				style={[slideStyles.title, { color: colors.onSurface }]}
			>
				准备开始
			</Text>
			<View style={slideStyles.startOptions}>
				<Button
					mode='contained'
					onPress={onQRCode}
					icon='qrcode-scan'
					style={slideStyles.startButton}
					contentStyle={slideStyles.startButtonContent}
				>
					扫码登录
				</Button>
				<Button
					mode='outlined'
					onPress={onPhone}
					icon='cellphone'
					style={slideStyles.startButton}
					contentStyle={slideStyles.startButtonContent}
				>
					手机号登录
				</Button>
				<Button
					mode='outlined'
					onPress={onGuest}
					style={slideStyles.guestButton}
					contentStyle={slideStyles.startButtonContent}
				>
					游客模式
				</Button>
			</View>
		</View>
	)
}

export default function OnboardingPage() {
	const [step, setStep] = useState(0)
	const { width } = useWindowDimensions()
	const insets = useSafeAreaInsets()
	const { colors } = useTheme()
	const translateX = useSharedValue(0)
	const [isClickFinalButton, setIsClickFinalButton] = useState(false)

	const goToStep = useCallback(
		(index: number) => {
			translateX.set(withTiming(-index * width, { duration: 300 }))
			setStep(index)
		},
		[translateX, width],
	)

	const goNext = useCallback(() => {
		if (step < 2) goToStep(step + 1)
	}, [step, goToStep])

	usePreventRemove(!isClickFinalButton, () => {
		if (step > 0) goToStep(step - 1)
	})

	const complete = useCallback(() => {
		storage.set('first_open', false)
		setIsClickFinalButton(true)
		if (router.canGoBack()) {
			router.back()
		} else {
			router.replace('/(tabs)')
		}
	}, [])

	const handleQRCode = useCallback(() => {
		storage.set('first_open', false)
		setIsClickFinalButton(true)
		router.replace('/settings/bilibili-account/qrcode-login' as never)
	}, [])

	const handlePhone = useCallback(() => {
		storage.set('first_open', false)
		setIsClickFinalButton(true)
		router.replace('/settings/bilibili-account/phone-login' as never)
	}, [])

	const animatedRowStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: translateX.value }],
	}))

	return (
		<View style={[styles.root, { backgroundColor: colors.background }]}>
			{step > 0 && (
				<Button
					onPress={() => goToStep(step - 1)}
					icon='chevron-left'
					style={[styles.backButton, { top: insets.top + 8 }]}
				>
					{' '}
				</Button>
			)}

			<View style={styles.slideContainer}>
				<Animated.View
					style={[styles.row, { width: width * 3 }, animatedRowStyle]}
				>
					<View style={{ width }}>
						<WelcomeSlide />
					</View>
					<View style={{ width }}>
						<DisclaimerSlide />
					</View>
					<View style={{ width }}>
						<StartSlide
							onQRCode={handleQRCode}
							onPhone={handlePhone}
							onGuest={complete}
						/>
					</View>
				</Animated.View>
			</View>

			<View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>
				<View style={styles.dots}>
					{[0, 1, 2].map((i) => (
						<View
							key={i}
							style={[
								styles.dot,
								{
									backgroundColor:
										i === step ? colors.primary : colors.surfaceVariant,
								},
								i === step && styles.dotActive,
							]}
						/>
					))}
				</View>

				{step < 2 && (
					<Button
						mode='contained'
						onPress={goNext}
						style={styles.actionButton}
						contentStyle={styles.actionButtonContent}
					>
						继续
					</Button>
				)}
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
	backButton: {
		position: 'absolute',
		left: 8,
		zIndex: 1,
	},
	slideContainer: {
		flex: 1,
		overflow: 'hidden',
	},
	row: {
		flex: 1,
		flexDirection: 'row',
	},
	bottom: {
		paddingHorizontal: 24,
		alignItems: 'center',
		gap: 24,
	},
	dots: {
		flexDirection: 'row',
		gap: 8,
	},
	dot: {
		width: 8,
		height: 8,
		borderRadius: 4,
	},
	dotActive: {
		width: 24,
	},
	actionButton: {
		width: '100%',
		borderRadius: 28,
	},
	actionButtonContent: {
		paddingVertical: 6,
	},
})

const slideStyles = StyleSheet.create({
	content: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 32,
	},
	logo: {
		width: 120,
		height: 120,
		borderRadius: 24,
		marginBottom: 32,
	},
	icon: {
		marginBottom: 24,
	},
	title: {
		marginBottom: 8,
		fontWeight: '700',
	},
	brand: {
		marginBottom: 16,
		fontWeight: '800',
	},
	desc: {
		textAlign: 'center',
		lineHeight: 24,
	},
	startOptions: {
		marginTop: 32,
		width: '100%',
		gap: 12,
	},
	startButton: {
		width: '100%',
		borderRadius: 16,
	},
	startButtonContent: {
		paddingVertical: 6,
	},
	guestButton: {
		alignSelf: 'center',
		marginTop: 8,
	},
})
