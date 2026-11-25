import { Orpheus } from '@bbplayer/orpheus'
import type {
	AudioQualityInfo,
	AudioQualityPreference,
} from '@bbplayer/orpheus'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform, ScrollView, StyleSheet, View } from 'react-native'
import {
	Dialog,
	RadioButton,
	Surface,
	Text,
	TouchableRipple,
	useTheme,
} from 'react-native-paper'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import Button from '@/components/common/Button'
import {
	formatActualAudioQuality,
	formatAudioQualityLabel,
	getAudioQualityAccessHint,
	getVisibleAudioQualityOptions,
	resolveActualAudioQualityPreference,
	resolveAudioQualitySwitchOutcome,
	resolveSelectedAudioQualityPreference,
} from '@/constants/audioQuality'
import { useBilibiliAccountAccess } from '@/hooks/queries/bilibili/user'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { LIST_ITEM_BORDER_RADIUS } from '@/theme/dimensions'
import { toastAndLogError } from '@/utils/error-handling'
import toast from '@/utils/toast'

import {
	createDelayedVisibilityController,
	SWITCH_INDICATOR_DELAY_MS,
	type DelayedVisibilityController,
} from './audioQualityModalState'

function applyPreferredAudioQuality(preference: AudioQualityPreference) {
	Orpheus.preferredAudioQuality = preference
}

const QUALITY_CONFIRM_TIMEOUT_MS = 8_000

const AudioQualityModal = () => {
	const close = useModalStore((state) => state.close)
	const colors = useTheme().colors

	const [preference, setPreference] = useState<AudioQualityPreference>(() =>
		Platform.OS === 'android' ? Orpheus.preferredAudioQuality : 'high',
	)

	const [actualQuality, setActualQuality] = useState<AudioQualityInfo | null>(
		null,
	)

	const [showReloadIndicator, setShowReloadIndicator] = useState(false)

	const [pendingTarget, setPendingTarget] =
		useState<AudioQualityPreference | null>(null)

	const [qualityLoading, setQualityLoading] = useState(true)
	const [qualityLoadFailed, setQualityLoadFailed] = useState(false)

	const switchingRef = useRef(false)
	const mountedRef = useRef(true)
	const reloadIndicatorRef = useRef<DelayedVisibilityController | null>(null)

	const pendingRef = useRef<{
		target: AudioQualityPreference
		timer: ReturnType<typeof setTimeout>
	} | null>(null)

	useEffect(() => {
		mountedRef.current = true

		const controller = createDelayedVisibilityController(
			SWITCH_INDICATOR_DELAY_MS,
			setShowReloadIndicator,
		)

		reloadIndicatorRef.current = controller

		return () => {
			mountedRef.current = false
			controller.dispose()

			if (reloadIndicatorRef.current === controller) {
				reloadIndicatorRef.current = null
			}

			const pending = pendingRef.current

			if (pending) {
				clearTimeout(pending.timer)
				pendingRef.current = null
			}
		}
	}, [])

	const clearPendingSwitch = useCallback(() => {
		const pending = pendingRef.current

		if (pending) {
			clearTimeout(pending.timer)
			pendingRef.current = null
		}

		switchingRef.current = false

		if (!mountedRef.current) {
			return
		}

		setPendingTarget(null)
		reloadIndicatorRef.current?.finish()
	}, [])

	const startPendingSwitch = useCallback((target: AudioQualityPreference) => {
		const timer = setTimeout(() => {
			pendingRef.current = null
			switchingRef.current = false

			if (!mountedRef.current) {
				return
			}

			setPendingTarget(null)
			reloadIndicatorRef.current?.finish()
			toast.info('切换结果未确认', {
				description: '可稍后重新打开音质面板查看实际档位',
			})
		}, QUALITY_CONFIRM_TIMEOUT_MS)

		pendingRef.current = { target, timer }
		switchingRef.current = true
		setPendingTarget(target)
		reloadIndicatorRef.current?.start()
	}, [])

	const handleActualQuality = useCallback(
		(info: AudioQualityInfo) => {
			setActualQuality(info)
			setQualityLoadFailed(false)

			const pending = pendingRef.current

			if (pending === null || info.preferredQuality !== pending.target) {
				return
			}

			const outcome = resolveAudioQualitySwitchOutcome(info, pending.target)

			if (outcome === 'unknown') {
				return
			}

			clearPendingSwitch()

			const targetLabel = formatAudioQualityLabel(pending.target)

			if (outcome === 'applied') {
				toast.success(`已切换至 ${targetLabel}`)

				return
			}

			const actualInfo = formatActualAudioQuality(info)

			toast.info(`${targetLabel} 本曲暂不支持`, {
				description: actualInfo
					? `实际使用 ${actualInfo.title}`
					: '已自动降级到当前可用的最高档位',
			})
		},
		[clearPendingSwitch],
	)

	const loadCurrentQuality = useCallback(async () => {
		setQualityLoading(true)
		setQualityLoadFailed(false)

		try {
			const info = await Orpheus.getCurrentAudioQuality()

			if (mountedRef.current) {
				setActualQuality(info)
			}
		} catch (error) {
			if (mountedRef.current) {
				setQualityLoadFailed(true)
			}

			toastAndLogError('读取当前音质失败', error, 'Modal.AudioQuality')
		} finally {
			if (mountedRef.current) {
				setQualityLoading(false)
			}
		}
	}, [])

	useEffect(() => {
		void loadCurrentQuality()

		const subscription = Orpheus.addListener(
			'onAudioQualityChanged',
			handleActualQuality,
		)

		return () => {
			subscription.remove()
		}
	}, [handleActualQuality, loadCurrentQuality])

	const switchQuality = async (next: AudioQualityPreference) => {
		if (switchingRef.current) {
			return
		}

		const label = formatAudioQualityLabel(next)
		const actualPreference = resolveActualAudioQualityPreference(actualQuality)

		const isDegraded =
			actualQuality?.isFallback === true ||
			(actualPreference !== null && actualPreference !== preference)

		if (next === preference && !isDegraded) {
			toast.info(`当前已经是 ${label}`)

			return
		}

		switchingRef.current = true

		try {
			applyPreferredAudioQuality(next)
		} catch (error) {
			switchingRef.current = false
			toastAndLogError('设置音质偏好失败', error, 'Modal.AudioQuality')

			return
		}

		setPreference(next)

		try {
			const result = await Orpheus.reloadCurrentTrackForQualityChange()

			if (result.reloaded) {
				startPendingSwitch(next)

				return
			}

			clearPendingSwitch()

			if (result.reason === 'downloaded') {
				toast.error(`已设为默认 ${label}，当前离线缓存不再重新加载`, {
					description: '下一首或重新下载后生效',
				})
			} else if (result.reason === 'not_bilibili') {
				toast.error(`已设为默认 ${label}`, {
					description: '当前曲目不是 B 站音源，无法即时重新加载',
				})
			} else if (result.reason === 'no_track') {
				toast.error(`已设为默认 ${label}，当前没有播放中的曲目`, {
					description: '下一首播放时生效',
				})
			} else {
				toast.error('切换音质失败', {
					description: '未能重新加载当前曲目',
				})
			}
		} catch (error) {
			clearPendingSwitch()
			toastAndLogError('切换音质失败', error, 'Modal.AudioQuality')
		}
	}

	const actual = formatActualAudioQuality(actualQuality)

	let actualTitleText: string
	let actualSubtitleText: string | undefined

	if (actual) {
		actualTitleText = actual.title
		actualSubtitleText = actual.subtitle
	} else if (qualityLoading) {
		actualTitleText = '正在读取当前音质'
		actualSubtitleText = '正在向播放服务查询当前音质。'
	} else if (qualityLoadFailed) {
		actualTitleText = '读取当前音质失败'
		actualSubtitleText = '播放服务暂时没有返回结果，可以重试。'
	} else {
		actualTitleText = '暂无正在播放的曲目'
		actualSubtitleText = '选好档位会存为默认音质，下一首播放时生效。'
	}

	const accountAccess = useBilibiliAccountAccess()

	const visibleOptions = getVisibleAudioQualityOptions({
		accountTier: accountAccess.tier,
		availableQualities: actualQuality?.availableQualities,
		isFromDownloadCache: actualQuality?.isFromDownloadCache,
	})

	const selectedPreference = resolveSelectedAudioQualityPreference(
		preference,
		visibleOptions,
	)

	const accessHint = getAudioQualityAccessHint(accountAccess.tier)

	const handleGroupChange = (value: string) => {
		const option = visibleOptions.find((item) => item.value === value)

		if (!option) {
			return
		}

		void switchQuality(option.value)
	}

	return (
		<>
			<Dialog.Title>音质</Dialog.Title>
			<Dialog.Content style={styles.content}>
				<ScrollView
					style={styles.scroll}
					contentContainerStyle={styles.scrollContent}
					showsVerticalScrollIndicator={false}
				>
					<Surface
						elevation={0}
						style={[
							styles.actualCard,
							{ backgroundColor: colors.secondaryContainer },
						]}
					>
						<View style={styles.actualHeader}>
							<Text
								variant='labelMedium'
								style={[
									styles.actualHeaderLabel,
									{ color: colors.onSecondaryContainer },
								]}
							>
								当前实际播放音质
							</Text>
							<View style={styles.actualStatus}>
								{pendingTarget !== null && (
									<Text
										variant='labelSmall'
										style={{ color: colors.onSecondaryContainer }}
									>
										切换中…
									</Text>
								)}
								<View style={styles.actualIndicatorSlot}>
									{showReloadIndicator && (
										<ActivityIndicator
											size={14}
											color={colors.onSecondaryContainer}
										/>
									)}
								</View>
							</View>
						</View>
						<Text
							variant='titleMedium'
							style={[
								styles.actualTitle,
								{ color: colors.onSecondaryContainer },
							]}
						>
							{actualTitleText}
						</Text>
						<Text
							variant='bodySmall'
							style={{ color: colors.onSecondaryContainer }}
						>
							{actualSubtitleText}
						</Text>
						{qualityLoadFailed && actual === null && (
							<Button
								mode='text'
								compact
								onPress={() => {
									void loadCurrentQuality()
								}}
								textColor={colors.onSecondaryContainer}
							>
								重试
							</Button>
						)}
					</Surface>

					{accessHint !== null && (
						<Text
							variant='bodySmall'
							style={[styles.accessHint, { color: colors.onSurfaceVariant }]}
						>
							{accessHint}
						</Text>
					)}

					<RadioButton.Group
						value={selectedPreference}
						onValueChange={handleGroupChange}
					>
						<View style={styles.optionList}>
							{visibleOptions.map((option) => {
								const selected = option.value === selectedPreference

								return (
									<TouchableRipple
										key={option.value}
										testID={`audio-quality-option-${option.value}`}
										borderless
										accessibilityRole='radio'
										accessibilityState={{ checked: selected, selected }}
										onPress={() => {
											void switchQuality(option.value)
										}}
										style={[
											styles.optionRow,
											{
												backgroundColor: selected
													? colors.surfaceVariant
													: 'transparent',
											},
										]}
									>
										<View style={styles.optionContent}>
											<View pointerEvents='none'>
												<RadioButton
													value={option.value}
													status={selected ? 'checked' : 'unchecked'}
												/>
											</View>
											<View style={styles.optionText}>
												<View style={styles.optionHeader}>
													<Text variant='titleSmall'>{option.label}</Text>
													<Text
														variant='labelSmall'
														style={[
															styles.optionBadge,
															{ color: colors.primary },
														]}
													>
														{option.badge}
													</Text>
												</View>
												<Text
													variant='bodySmall'
													style={{ color: colors.onSurfaceVariant }}
												>
													{option.description}
												</Text>
											</View>
										</View>
									</TouchableRipple>
								)
							})}
						</View>
					</RadioButton.Group>
				</ScrollView>
			</Dialog.Content>
			<Dialog.Actions>
				<Button onPress={() => close('AudioQuality')}>关闭</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		flexShrink: 1,
	},
	scroll: {
		flexShrink: 1,
	},
	scrollContent: {
		paddingBottom: 8,
	},
	actualCard: {
		borderRadius: 16,
		paddingHorizontal: 14,
		paddingVertical: 12,
		marginBottom: 12,
		gap: 2,
	},
	actualHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	actualHeaderLabel: {
		flexShrink: 1,
	},
	actualStatus: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
	},
	actualIndicatorSlot: {
		height: 16,
		width: 16,
		alignItems: 'center',
		justifyContent: 'center',
	},
	actualTitle: {
		fontWeight: 'bold',
	},
	optionList: {
		gap: 2,
	},
	accessHint: {
		marginBottom: 8,
	},
	optionRow: {
		borderRadius: LIST_ITEM_BORDER_RADIUS,
		paddingHorizontal: 8,
		paddingVertical: 6,
	},
	optionContent: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
	},
	optionText: {
		flexShrink: 1,
		flexGrow: 1,
		gap: 2,
	},
	optionHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		flexShrink: 1,
		gap: 6,
	},
	optionBadge: {
		fontWeight: 'bold',
		flexShrink: 1,
	},
})

export default AudioQualityModal
