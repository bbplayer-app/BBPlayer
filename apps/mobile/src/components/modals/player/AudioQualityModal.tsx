import { Orpheus } from '@bbplayer/orpheus'
import type {
	AudioQualityInfo,
	AudioQualityPreference,
} from '@bbplayer/orpheus'
import { useEffect, useRef, useState } from 'react'
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

	const switchingRef = useRef(false)
	const mountedRef = useRef(true)
	const reloadIndicatorRef = useRef<DelayedVisibilityController | null>(null)

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
		}
	}, [])

	useEffect(() => {
		let cancelled = false

		void Orpheus.getCurrentAudioQuality()
			.then((info) => {
				if (cancelled) return
				setActualQuality(info)
			})
			.catch((error) => {
				toastAndLogError('读取当前音质失败', error, 'Modal.AudioQuality')
			})

		const subscription = Orpheus.addListener(
			'onAudioQualityChanged',
			(info) => {
				if (cancelled) return
				setActualQuality(info)
			},
		)

		return () => {
			cancelled = true
			subscription.remove()
		}
	}, [])

	const switchQuality = async (next: AudioQualityPreference) => {
		if (switchingRef.current) {
			return
		}

		const label = formatAudioQualityLabel(next)

		if (next === preference) {
			toast.info(`当前已经是 ${label}`)

			return
		}

		const previous = preference

		switchingRef.current = true
		reloadIndicatorRef.current?.start()
		setPreference(next)

		try {
			applyPreferredAudioQuality(next)

			const result = await Orpheus.reloadCurrentTrackForQualityChange()

			if (result.reloaded) {
				toast.success(`已切换至 ${label}，正在无缝续播`)
			} else if (result.reason === 'downloaded') {
				toast.info(`已设为默认 ${label}`, {
					description: '当前播放的是离线缓存，下一首或重新下载后才生效',
				})
			} else {
				toast.info(`默认音质已设为 ${label}`)
			}
		} catch (error) {
			if (mountedRef.current) {
				setPreference(previous)
			}

			try {
				applyPreferredAudioQuality(previous)
			} catch (rollbackError) {
				toastAndLogError(
					'回滚音质偏好失败',
					rollbackError,
					'Modal.AudioQuality',
				)
			}

			toastAndLogError('切换音质失败', error, 'Modal.AudioQuality')
		} finally {
			switchingRef.current = false

			const reloadIndicator = reloadIndicatorRef.current

			if (mountedRef.current) {
				reloadIndicator?.finish()
			} else {
				reloadIndicator?.dispose()
			}
		}
	}

	const actual = formatActualAudioQuality(actualQuality)

	const accountAccess = useBilibiliAccountAccess()

	const visibleOptions = getVisibleAudioQualityOptions({
		accountTier: accountAccess.tier,
		availableQualities: actualQuality?.availableQualities,
		isFromDownloadCache: actualQuality?.isFromDownloadCache,
	})

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
							<View style={styles.actualIndicatorSlot}>
								{showReloadIndicator && (
									<ActivityIndicator
										size={14}
										color={colors.onSecondaryContainer}
									/>
								)}
							</View>
						</View>
						<Text
							variant='titleMedium'
							style={[
								styles.actualTitle,
								{ color: colors.onSecondaryContainer },
							]}
						>
							{actual ? actual.title : '暂无正在播放的曲目'}
						</Text>
						<Text
							variant='bodySmall'
							style={{ color: colors.onSecondaryContainer }}
						>
							{actual
								? actual.subtitle
								: '选好档位会存为默认音质，下一首播放时生效。'}
						</Text>
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
						value={preference}
						onValueChange={handleGroupChange}
					>
						<View style={styles.optionList}>
							{visibleOptions.map((option) => {
								const selected = option.value === preference

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
