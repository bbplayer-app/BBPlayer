import {
	EQ_BAND_COUNT,
	EQ_MAX_GAIN_DB,
	EQ_MIN_GAIN_DB,
	Orpheus,
	type EqualizerPreset,
	type EqualizerSettings,
} from '@bbplayer/orpheus'
import { Host, Slider } from '@expo/ui/jetpack-compose'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform, ScrollView, StyleSheet, View } from 'react-native'
import {
	ActivityIndicator,
	Appbar,
	Surface,
	Text,
	useTheme,
} from 'react-native-paper'
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Button from '@/components/common/Button'
import IconButton from '@/components/common/IconButton'
import SettingsSectionTitle from '@/components/common/SettingsSectionTitle'
import UniversalSwitch from '@/components/common/UniversalSwitch'
import { useSettingsSplit } from '@/components/layout/SettingsNavigation'
import EqBandSliders from '@/features/equalizer/components/EqBandSliders'
import EqPresetBar from '@/features/equalizer/components/EqPresetBar'
import EqResponseCurve from '@/features/equalizer/components/EqResponseCurve'
import {
	deleteCustomPreset,
	parseCustomPresetsJson,
	renameCustomPreset,
	serializeCustomPresets,
	upsertCustomPreset,
} from '@/features/equalizer/utils/customPresets'
import { persistCustomPresetsWithRollback } from '@/features/equalizer/utils/customPresetsWrite'
import {
	canWriteCustomPresets,
	canWriteSettings,
	createEqReadiness,
	type EqReadiness,
	isEqDataLoading,
	isPresetsFailed,
	isSettingsFailed,
	resolveEditingCustomPresetId,
	resolvePresetsStatus,
	resolveSettingsStatus,
} from '@/features/equalizer/utils/eqReadiness'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { toastAndLogError } from '@/utils/error-handling'
import log from '@/utils/log'
import toast from '@/utils/toast'

const eqLogger = log.extend('Equalizer')

const FLAT_GAINS = Array.from({ length: EQ_BAND_COUNT }, () => 0)

const INITIAL_SETTINGS: EqualizerSettings = {
	enabled: false,
	preampDb: 0,
	limiterEnabled: true,
	gainsDb: FLAT_GAINS,
	activePresetId: 'flat',
}

const PREAMP_STEP_DB = 0.5

const PREAMP_THROTTLE_MS = 50

const NATIVE_SEND_THROTTLE_MS = 40

const PRESET_TRANSITION_MS = 260

const VISUAL_TOLERANCE_DB = 1e-3

const PREAMP_STEPS =
	Math.round((EQ_MAX_GAIN_DB - EQ_MIN_GAIN_DB) / PREAMP_STEP_DB) - 1

function quantizePreampDb(preampDb: number): number {
	const stepped = Math.round(preampDb / PREAMP_STEP_DB) * PREAMP_STEP_DB

	return Math.min(EQ_MAX_GAIN_DB, Math.max(EQ_MIN_GAIN_DB, stepped))
}

function formatPreampDb(preampDb: number): string {
	const magnitude = Math.abs(preampDb).toFixed(1)

	if (preampDb > 0) return `+${magnitude}`

	if (preampDb < 0) return `-${magnitude}`

	return magnitude
}

interface PreampControlProps {
	enabled: boolean
	value: number
	onChange: (preampDb: number) => void
	onCommit: (preampDb: number) => void
	onDragActiveChange: (active: boolean) => void
}

function PreampControl({
	enabled,
	value,
	onChange,
	onCommit,
	onDragActiveChange,
}: PreampControlProps) {
	const { colors } = useTheme()

	const [displayValue, setDisplayValue] = useState(value)

	const latestValueRef = useRef(value)

	const draggingRef = useRef(false)

	const lastEmitRef = useRef(0)

	useEffect(() => {
		latestValueRef.current = value

		setDisplayValue(value)
	}, [value])

	const releaseDrag = useCallback(() => {
		if (!draggingRef.current) return

		draggingRef.current = false

		lastEmitRef.current = 0

		onDragActiveChange(false)
	}, [onDragActiveChange])

	useEffect(() => {
		if (enabled) return

		releaseDrag()
	}, [enabled, releaseDrag])

	useEffect(() => releaseDrag, [releaseDrag])

	const handleValueChange = useCallback(
		(nextValue: number) => {
			const quantized = quantizePreampDb(nextValue)

			latestValueRef.current = quantized

			setDisplayValue(quantized)

			if (!draggingRef.current) {
				draggingRef.current = true

				lastEmitRef.current = 0

				onDragActiveChange(true)
			}

			const now = Date.now()

			if (now - lastEmitRef.current < PREAMP_THROTTLE_MS) return

			lastEmitRef.current = now

			onChange(quantized)
		},
		[onChange, onDragActiveChange],
	)

	const handleValueChangeFinished = useCallback(() => {
		const finalValue = quantizePreampDb(latestValueRef.current)

		latestValueRef.current = finalValue

		setDisplayValue(finalValue)

		releaseDrag()

		onCommit(finalValue)
	}, [onCommit, releaseDrag])

	const handleReset = useCallback(() => {
		latestValueRef.current = 0

		setDisplayValue(0)

		onChange(0)

		onCommit(0)
	}, [onChange, onCommit])

	const isAndroid = Platform.OS === 'android'

	const activeColor = enabled ? colors.primary : colors.outline

	const captionStyle = [
		styles.preampCaption,
		{ color: colors.onSurfaceVariant },
	]

	return (
		<View
			style={styles.preamp}
			testID='eq-preamp-control'
		>
			<View style={styles.preampHeader}>
				<View style={styles.preampLabel}>
					<Text variant='bodyLarge'>前置增益（Preamp）</Text>
					<Text
						variant='bodySmall'
						style={captionStyle}
					>
						补偿整体电平，范围 {formatPreampDb(EQ_MIN_GAIN_DB)} 至{' '}
						{formatPreampDb(EQ_MAX_GAIN_DB)} dB，步进{' '}
						{formatPreampDb(PREAMP_STEP_DB)} dB。
					</Text>
				</View>
				<View style={styles.preampValue}>
					<Text
						variant='labelLarge'
						style={[styles.preampValueText, { color: colors.onSurface }]}
					>
						{formatPreampDb(displayValue)} dB
					</Text>
					<IconButton
						icon='restore'
						size={18}
						testID='eq-preamp-reset'
						accessibilityLabel='前置增益归零'
						onPress={handleReset}
					/>
				</View>
			</View>
			{isAndroid ? (
				<Host
					matchContents={{ vertical: true }}
					style={styles.preampHost}
				>
					<Slider
						value={displayValue}
						min={EQ_MIN_GAIN_DB}
						max={EQ_MAX_GAIN_DB}
						steps={PREAMP_STEPS}
						enabled={enabled}
						colors={{
							thumbColor: activeColor,
							activeTrackColor: activeColor,
							inactiveTrackColor: colors.outlineVariant,
							activeTickColor: activeColor,
							inactiveTickColor: colors.outline,
						}}
						onValueChange={handleValueChange}
						onValueChangeFinished={handleValueChangeFinished}
					/>
				</Host>
			) : (
				<Text
					variant='bodySmall'
					style={captionStyle}
				>
					前置增益调节仅支持 Android 设备。
				</Text>
			)}
			<Text
				variant='bodySmall'
				style={captionStyle}
			>
				提升整体电平会让频段提升更容易削波，建议同时开启防破音保护。
			</Text>
		</View>
	)
}

export default function EqualizerSettingsPage() {
	const router = useRouter()
	const split = useSettingsSplit()
	const { colors } = useTheme()
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()

	const isAndroid = Platform.OS === 'android'

	const [settings, setSettings] = useState<EqualizerSettings>(INITIAL_SETTINGS)

	const [customPresets, setCustomPresets] = useState<EqualizerPreset[]>([])

	const [readiness, setReadiness] = useState<EqReadiness>(() =>
		createEqReadiness(isAndroid),
	)

	const [editingCustomPresetId, setEditingCustomPresetId] = useState<
		string | null
	>(null)

	const [loadAttempt, setLoadAttempt] = useState(0)

	const [scrollEnabled, setScrollEnabled] = useState(true)

	const draggingRef = useRef(false)

	const bandErrorRef = useRef(false)

	const bandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const pendingBandRef = useRef<{ bandIndex: number; gainDb: number } | null>(
		null,
	)

	const lastBandSentAtRef = useRef(0)

	const preampErrorRef = useRef(false)

	const preampTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const pendingPreampRef = useRef<number | null>(null)

	const lastPreampSentAtRef = useRef(0)

	const bandGain0 = useSharedValue(0)

	const bandGain1 = useSharedValue(0)

	const bandGain2 = useSharedValue(0)

	const bandGain3 = useSharedValue(0)

	const bandGain4 = useSharedValue(0)

	const bandGain5 = useSharedValue(0)

	const bandGain6 = useSharedValue(0)

	const bandGain7 = useSharedValue(0)

	const bandGain8 = useSharedValue(0)

	const bandGain9 = useSharedValue(0)

	const preampSharedValue = useSharedValue(0)

	const bandGainSharedValues = useMemo(
		() => [
			bandGain0,
			bandGain1,
			bandGain2,
			bandGain3,
			bandGain4,
			bandGain5,
			bandGain6,
			bandGain7,
			bandGain8,
			bandGain9,
		],
		[
			bandGain0,
			bandGain1,
			bandGain2,
			bandGain3,
			bandGain4,
			bandGain5,
			bandGain6,
			bandGain7,
			bandGain8,
			bandGain9,
		],
	)

	const lastVisualTargetRef = useRef({
		gainsDb: [...FLAT_GAINS],
		preampDb: 0,
	})

	const hasHydratedRef = useRef(false)

	const pushVisualTarget = useCallback(
		(gainsDb: readonly number[], preampDb: number, animate: boolean) => {
			const target = lastVisualTargetRef.current

			const nextGains: number[] = []

			for (let index = 0; index < bandGainSharedValues.length; index += 1) {
				const sharedGain = bandGainSharedValues[index]

				const gain = gainsDb[index] ?? 0

				sharedGain.set(
					animate
						? withTiming(gain, {
								duration: PRESET_TRANSITION_MS,
								easing: Easing.out(Easing.cubic),
							})
						: gain,
				)

				nextGains.push(gain)
			}

			target.gainsDb = nextGains

			target.preampDb = preampDb

			preampSharedValue.set(
				animate
					? withTiming(preampDb, {
							duration: PRESET_TRANSITION_MS,
							easing: Easing.out(Easing.cubic),
						})
					: preampDb,
			)
		},
		[bandGainSharedValues, preampSharedValue],
	)

	const matchesVisualTarget = useCallback((next: EqualizerSettings) => {
		const target = lastVisualTargetRef.current

		if (Math.abs(next.preampDb - target.preampDb) > VISUAL_TOLERANCE_DB) {
			return false
		}

		for (let index = 0; index < target.gainsDb.length; index += 1) {
			const nextGain = next.gainsDb[index] ?? 0

			const currentGain = target.gainsDb[index] ?? 0

			if (Math.abs(nextGain - currentGain) > VISUAL_TOLERANCE_DB) return false
		}

		return true
	}, [])

	const applySettledSettings = useCallback(
		(next: EqualizerSettings) => {
			setSettings(next)

			if (matchesVisualTarget(next)) return

			pushVisualTarget(next.gainsDb, next.preampDb, hasHydratedRef.current)
		},
		[matchesVisualTarget, pushVisualTarget],
	)

	const retryLoad = useCallback(() => {
		setLoadAttempt((attempt) => attempt + 1)
	}, [])

	useEffect(() => {
		if (!isAndroid) return

		let cancelled = false

		setReadiness(() => ({ settings: 'loading', presets: 'loading' }))

		void (async () => {
			const [settingsResult, customPresetsResult] = await Promise.allSettled([
				Orpheus.getEqualizerSettings(),
				Orpheus.getCustomEqualizerPresetsJson(),
			])

			if (cancelled) return

			let loadedPresets: EqualizerPreset[] | null = null

			if (settingsResult.status === 'fulfilled') {
				setSettings(settingsResult.value)

				pushVisualTarget(
					settingsResult.value.gainsDb,
					settingsResult.value.preampDb,
					false,
				)
			} else {
				toastAndLogError(
					'读取均衡器设置失败',
					settingsResult.reason,
					'Equalizer',
				)
			}

			if (
				customPresetsResult.status === 'fulfilled' &&
				customPresetsResult.value !== ''
			) {
				loadedPresets = parseCustomPresetsJson(customPresetsResult.value)

				setCustomPresets(loadedPresets)
			} else {
				toastAndLogError(
					'读取自定义预设失败',
					customPresetsResult.status === 'rejected'
						? customPresetsResult.reason
						: new Error('自定义预设存储不可用'),
					'Equalizer',
				)
			}

			setReadiness({
				settings: resolveSettingsStatus(settingsResult),
				presets: resolvePresetsStatus(customPresetsResult),
			})

			if (settingsResult.status === 'fulfilled' && loadedPresets !== null) {
				setEditingCustomPresetId(
					resolveEditingCustomPresetId(
						settingsResult.value.activePresetId,
						loadedPresets,
					),
				)
			}

			hasHydratedRef.current = true
		})()

		return () => {
			cancelled = true
		}
	}, [isAndroid, loadAttempt, pushVisualTarget])

	useEffect(() => {
		if (!isAndroid) return

		const subscription = Orpheus.addListener('onEqualizerChanged', (next) => {
			if (draggingRef.current) return

			applySettledSettings(next)
		})

		return () => {
			subscription.remove()
		}
	}, [applySettledSettings, isAndroid])

	const runEqualizerAction = useCallback(
		async (
			action: () => Promise<EqualizerSettings>,
			failureMessage: string,
		) => {
			try {
				const next = await action()

				applySettledSettings(next)
			} catch (error) {
				toastAndLogError(failureMessage, error, 'Equalizer')
			}
		},
		[applySettledSettings],
	)

	const persistCustomPresets = useCallback(
		async (nextPresets: EqualizerPreset[]) => {
			await persistCustomPresetsWithRollback(
				customPresets,
				nextPresets,
				setCustomPresets,
				async (presets) => {
					if (!isAndroid) return

					await Orpheus.setCustomEqualizerPresetsJson(
						serializeCustomPresets(presets),
					)
				},
			)
		},
		[customPresets, isAndroid],
	)

	const applyPreset = useCallback(
		(preset: EqualizerPreset, currentSettings: EqualizerSettings) => {
			if (!isAndroid || !canWriteSettings(readiness)) return

			setSettings({
				...currentSettings,
				activePresetId: preset.id,
				gainsDb: [...preset.gainsDb],
				preampDb: preset.preampDb,
			})

			pushVisualTarget(preset.gainsDb, preset.preampDb, true)

			setEditingCustomPresetId(preset.isBuiltin ? null : preset.id)

			void runEqualizerAction(
				() =>
					Orpheus.setEqualizerSettings(
						currentSettings.enabled,
						preset.preampDb,
						currentSettings.limiterEnabled,
						preset.gainsDb,
						preset.id,
					),
				'应用均衡器预设失败',
			)
		},
		[isAndroid, pushVisualTarget, readiness, runEqualizerAction],
	)

	const handleToggleEnabled = useCallback(() => {
		if (!isAndroid || !canWriteSettings(readiness)) return

		void runEqualizerAction(
			() =>
				Orpheus.setEqualizerSettings(
					!settings.enabled,
					settings.preampDb,
					settings.limiterEnabled,
					settings.gainsDb,
					settings.activePresetId,
				),
			'切换均衡器失败',
		)
	}, [isAndroid, readiness, runEqualizerAction, settings])

	const handleToggleLimiter = useCallback(() => {
		if (!isAndroid || !canWriteSettings(readiness)) return

		void runEqualizerAction(
			() => Orpheus.setEqualizerLimiterEnabled(!settings.limiterEnabled),
			'切换防破音保护失败',
		)
	}, [isAndroid, readiness, runEqualizerAction, settings.limiterEnabled])

	const handleReset = useCallback(() => {
		if (!isAndroid) return

		const previousGains = [...lastVisualTargetRef.current.gainsDb]

		const previousPreamp = lastVisualTargetRef.current.preampDb

		pushVisualTarget(FLAT_GAINS, 0, true)

		void (async () => {
			try {
				const next = await Orpheus.resetEqualizer()

				applySettledSettings(next)

				setEditingCustomPresetId(null)

				toast.success('已恢复平坦响应')
			} catch (error) {
				pushVisualTarget(previousGains, previousPreamp, true)

				toastAndLogError('重置均衡器失败', error, 'Equalizer')
			}
		})()
	}, [applySettledSettings, isAndroid, pushVisualTarget])

	const handleSelectPreset = useCallback(
		(preset: EqualizerPreset) => {
			applyPreset(preset, settings)
		},
		[applyPreset, settings],
	)

	const flushBandGain = useCallback(() => {
		if (bandErrorRef.current) {
			pendingBandRef.current = null

			return
		}

		const pending = pendingBandRef.current

		if (pending === null) return

		pendingBandRef.current = null

		lastBandSentAtRef.current = Date.now()

		void (async () => {
			try {
				await Orpheus.setEqualizerBandGain(pending.bandIndex, pending.gainDb)
			} catch (error) {
				if (bandErrorRef.current) {
					eqLogger.error(
						'equalizer.band_gain.write_failed',
						{ 'operation.message': '调整均衡器失败（已忽略重复提示）' },
						error,
					)

					return
				}

				bandErrorRef.current = true

				toastAndLogError('调整均衡器失败', error, 'Equalizer')
			}
		})()
	}, [])

	const handleBandChange = useCallback(
		(bandIndex: number, gainDb: number) => {
			lastVisualTargetRef.current.gainsDb[bandIndex] = gainDb

			setSettings((previous) =>
				previous.activePresetId === null
					? previous
					: { ...previous, activePresetId: null },
			)

			if (!isAndroid || bandErrorRef.current) return

			pendingBandRef.current = { bandIndex, gainDb }

			if (bandTimerRef.current !== null) return

			const elapsed = Date.now() - lastBandSentAtRef.current

			if (elapsed >= NATIVE_SEND_THROTTLE_MS) {
				flushBandGain()

				return
			}

			bandTimerRef.current = setTimeout(() => {
				bandTimerRef.current = null

				flushBandGain()
			}, NATIVE_SEND_THROTTLE_MS - elapsed)
		},
		[flushBandGain, isAndroid],
	)

	const handleBandCommit = useCallback(
		(bandIndex: number, gainDb: number) => {
			if (bandTimerRef.current !== null) {
				clearTimeout(bandTimerRef.current)

				bandTimerRef.current = null
			}

			pendingBandRef.current = null

			bandErrorRef.current = false

			lastVisualTargetRef.current.gainsDb[bandIndex] = gainDb

			setSettings((previous) => {
				const gainsDb = [...previous.gainsDb]

				gainsDb[bandIndex] = gainDb

				return { ...previous, gainsDb, activePresetId: null }
			})

			if (!isAndroid) return

			void runEqualizerAction(
				() => Orpheus.setEqualizerBandGain(bandIndex, gainDb),
				'保存均衡器设置失败',
			)
		},
		[isAndroid, runEqualizerAction],
	)

	const flushPreamp = useCallback(() => {
		if (preampErrorRef.current) {
			pendingPreampRef.current = null

			return
		}

		const pending = pendingPreampRef.current

		if (pending === null) return

		pendingPreampRef.current = null

		lastPreampSentAtRef.current = Date.now()

		void (async () => {
			try {
				await Orpheus.setEqualizerPreamp(pending)
			} catch (error) {
				if (preampErrorRef.current) {
					eqLogger.error(
						'equalizer.preamp.write_failed',
						{ 'operation.message': '调整前置增益失败（已忽略重复提示）' },
						error,
					)

					return
				}

				preampErrorRef.current = true

				toastAndLogError('调整前置增益失败', error, 'Equalizer')
			}
		})()
	}, [])

	const handlePreampChange = useCallback(
		(preampDb: number) => {
			lastVisualTargetRef.current.preampDb = preampDb

			preampSharedValue.set(preampDb)

			if (!isAndroid || preampErrorRef.current) return

			pendingPreampRef.current = preampDb

			if (preampTimerRef.current !== null) return

			const elapsed = Date.now() - lastPreampSentAtRef.current

			if (elapsed >= NATIVE_SEND_THROTTLE_MS) {
				flushPreamp()

				return
			}

			preampTimerRef.current = setTimeout(() => {
				preampTimerRef.current = null

				flushPreamp()
			}, NATIVE_SEND_THROTTLE_MS - elapsed)
		},
		[flushPreamp, isAndroid, preampSharedValue],
	)

	const handlePreampCommit = useCallback(
		(preampDb: number) => {
			if (preampTimerRef.current !== null) {
				clearTimeout(preampTimerRef.current)

				preampTimerRef.current = null
			}

			pendingPreampRef.current = null

			preampErrorRef.current = false

			lastVisualTargetRef.current.preampDb = preampDb

			preampSharedValue.set(preampDb)

			setSettings((previous) => ({ ...previous, preampDb }))

			if (!isAndroid) return

			void runEqualizerAction(
				() => Orpheus.setEqualizerPreamp(preampDb),
				'保存前置增益失败',
			)
		},
		[isAndroid, preampSharedValue, runEqualizerAction],
	)

	useEffect(
		() => () => {
			if (bandTimerRef.current !== null) {
				clearTimeout(bandTimerRef.current)
			}

			if (preampTimerRef.current !== null) {
				clearTimeout(preampTimerRef.current)
			}
		},
		[],
	)

	const handleDragActiveChange = useCallback((active: boolean) => {
		draggingRef.current = active

		setScrollEnabled(!active)
	}, [])

	const handleSavePresetAs = useCallback(
		async (name: string) => {
			if (!canWriteCustomPresets(readiness)) {
				throw new Error('自定义预设尚未读取完成，暂时无法保存')
			}

			const { presets, preset } = upsertCustomPreset(customPresets, {
				name,
				gainsDb: settings.gainsDb,
				preampDb: settings.preampDb,
			})

			if (!preset) {
				toast.error('预设名称不能为空')

				return
			}

			await persistCustomPresets(presets)

			toast.success(`已保存「${preset.name}」`)

			applyPreset(preset, settings)
		},
		[applyPreset, customPresets, persistCustomPresets, readiness, settings],
	)

	const handleOverwritePreset = useCallback(
		async (id: string) => {
			if (!canWriteCustomPresets(readiness)) return

			const target = customPresets.find((preset) => preset.id === id)

			if (!target) return

			const { presets, preset } = upsertCustomPreset(customPresets, {
				id,
				name: target.name,
				gainsDb: settings.gainsDb,
				preampDb: settings.preampDb,
			})

			if (!preset) return

			try {
				await persistCustomPresets(presets)

				toast.success(`已覆盖「${preset.name}」`)

				applyPreset(preset, settings)
			} catch (error) {
				toastAndLogError('保存自定义预设失败', error, 'Equalizer')
			}
		},
		[applyPreset, customPresets, persistCustomPresets, readiness, settings],
	)

	const handleRenamePreset = useCallback(
		async (id: string, name: string) => {
			if (!canWriteCustomPresets(readiness)) {
				throw new Error('自定义预设尚未读取完成，暂时无法重命名')
			}

			if (!name.trim()) {
				toast.error('预设名称不能为空')

				return
			}

			await persistCustomPresets(renameCustomPreset(customPresets, id, name))
		},
		[customPresets, persistCustomPresets, readiness],
	)

	const handleDeletePreset = useCallback(
		async (id: string) => {
			if (!canWriteCustomPresets(readiness)) return

			try {
				await persistCustomPresets(deleteCustomPreset(customPresets, id))
			} catch (error) {
				toastAndLogError('删除自定义预设失败', error, 'Equalizer')

				return
			}

			if (editingCustomPresetId === id) {
				setEditingCustomPresetId(null)
			}

			if (settings.activePresetId !== id) return

			setSettings((previous) => ({ ...previous, activePresetId: null }))

			if (!isAndroid || !canWriteSettings(readiness)) return

			void runEqualizerAction(
				() =>
					Orpheus.setEqualizerSettings(
						settings.enabled,
						settings.preampDb,
						settings.limiterEnabled,
						settings.gainsDb,
						null,
					),
				'更新当前预设失败',
			)
		},
		[
			customPresets,
			editingCustomPresetId,
			isAndroid,
			persistCustomPresets,
			readiness,
			runEqualizerAction,
			settings,
		],
	)

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header>
				{!split && <Appbar.BackAction onPress={() => router.back()} />}
				<Appbar.Content title='均衡器' />
				<Appbar.Action
					icon='restart'
					testID='eq-reset-button'
					accessibilityLabel='重置为平坦响应'
					disabled={!isAndroid || readiness.settings !== 'ready'}
					onPress={handleReset}
				/>
			</Appbar.Header>
			{!isAndroid ? (
				<View style={styles.placeholder}>
					<Text
						variant='bodyLarge'
						style={{ textAlign: 'center' }}
					>
						均衡器目前仅支持 Android 设备。
					</Text>
				</View>
			) : isEqDataLoading(readiness) ? (
				<View style={styles.placeholder}>
					<ActivityIndicator />
				</View>
			) : isSettingsFailed(readiness) ? (
				<View style={styles.placeholder}>
					<Text
						variant='bodyLarge'
						style={{ textAlign: 'center' }}
					>
						均衡器设置读取失败
					</Text>
					<Text
						variant='bodySmall'
						style={[styles.retryHint, { color: colors.onSurfaceVariant }]}
					>
						读取成功前不会提交任何均衡器设置，请重试。
					</Text>
					<Button
						mode='contained-tonal'
						style={styles.retryButton}
						testID='eq-retry-settings'
						onPress={retryLoad}
					>
						重试
					</Button>
				</View>
			) : (
				<ScrollView
					style={styles.scrollView}
					scrollEnabled={scrollEnabled}
					contentContainerStyle={[
						styles.scrollContent,
						{ paddingBottom: insets.bottom + (haveTrack ? 90 : 24) },
					]}
				>
					<Surface
						mode='flat'
						style={[styles.card, { backgroundColor: colors.surfaceVariant }]}
					>
						<View style={styles.row}>
							<View style={styles.rowText}>
								<Text variant='bodyLarge'>启用均衡器</Text>
								<Text
									variant='bodySmall'
									style={{ color: colors.onSurfaceVariant }}
								>
									关闭后播放链路完全绕过均衡器，与原始音频一致。
								</Text>
							</View>
							<UniversalSwitch
								testID='eq-master-switch'
								value={settings.enabled}
								onValueChange={handleToggleEnabled}
							/>
						</View>
					</Surface>
					<Surface
						mode='flat'
						style={[styles.card, { backgroundColor: colors.surfaceVariant }]}
					>
						<EqResponseCurve
							enabled={settings.enabled}
							bandGainSharedValues={bandGainSharedValues}
							preampSharedValue={preampSharedValue}
						/>
					</Surface>
					<SettingsSectionTitle title='预设' />
					{isPresetsFailed(readiness) ? (
						<Surface
							mode='flat'
							style={[styles.card, { backgroundColor: colors.surfaceVariant }]}
						>
							<View style={styles.row}>
								<View style={styles.rowText}>
									<Text variant='bodyLarge'>自定义预设读取失败</Text>
									<Text
										variant='bodySmall'
										style={{ color: colors.onSurfaceVariant }}
									>
										读取成功前不能另存、覆盖、重命名或删除预设。
									</Text>
								</View>
								<Button
									mode='text'
									testID='eq-retry-presets'
									onPress={retryLoad}
								>
									重试
								</Button>
							</View>
						</Surface>
					) : null}
					<EqPresetBar
						activePresetId={settings.activePresetId}
						editingCustomPresetId={editingCustomPresetId}
						customPresets={customPresets}
						enabled={settings.enabled}
						presetsReady={canWriteCustomPresets(readiness)}
						onDelete={handleDeletePreset}
						onOverwrite={handleOverwritePreset}
						onRename={handleRenamePreset}
						onSaveAs={handleSavePresetAs}
						onSelect={handleSelectPreset}
					/>
					<SettingsSectionTitle title='频段' />
					<EqBandSliders
						gainsDb={settings.gainsDb}
						bandGainSharedValues={bandGainSharedValues}
						enabled={settings.enabled}
						onBandChange={handleBandChange}
						onBandCommit={handleBandCommit}
						onDragActiveChange={handleDragActiveChange}
					/>
					<SettingsSectionTitle title='高级控制' />
					<Surface
						mode='flat'
						style={[styles.card, { backgroundColor: colors.surfaceVariant }]}
					>
						<PreampControl
							enabled={settings.enabled}
							value={settings.preampDb}
							onChange={handlePreampChange}
							onCommit={handlePreampCommit}
							onDragActiveChange={handleDragActiveChange}
						/>
						<View
							style={[
								styles.divider,
								{ backgroundColor: colors.outlineVariant },
							]}
						/>
						<View style={styles.row}>
							<View style={styles.rowText}>
								<Text variant='bodyLarge'>防破音保护（软限幅）</Text>
								<Text
									variant='bodySmall'
									style={{ color: colors.onSurfaceVariant }}
								>
									抑制提升带来的削波失真，可能略微压缩动态。
								</Text>
							</View>
							<UniversalSwitch
								testID='eq-limiter-switch'
								value={settings.limiterEnabled}
								onValueChange={handleToggleLimiter}
							/>
						</View>
					</Surface>
				</ScrollView>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		gap: 12,
		paddingHorizontal: 16,
		paddingTop: 8,
	},
	placeholder: {
		alignItems: 'center',
		flex: 1,
		justifyContent: 'center',
		paddingHorizontal: 32,
	},
	retryHint: {
		marginTop: 8,
		textAlign: 'center',
	},
	retryButton: {
		marginTop: 16,
	},
	card: {
		borderRadius: 16,
		padding: 16,
	},
	row: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between',
	},
	rowText: {
		flex: 1,
		flexShrink: 1,
		marginEnd: 12,
	},
	hint: {
		marginTop: 12,
		opacity: 0.9,
	},
	divider: {
		height: StyleSheet.hairlineWidth,
		marginVertical: 12,
	},
	preamp: {
		gap: 4,
	},
	preampHeader: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between',
	},
	preampLabel: {
		flexShrink: 1,
		marginEnd: 12,
	},
	preampCaption: {
		marginTop: 2,
		opacity: 0.9,
	},
	preampValue: {
		alignItems: 'center',
		flexDirection: 'row',
	},
	preampValueText: {
		fontVariant: ['tabular-nums'],
	},
	preampHost: {
		width: '100%',
		marginTop: 8,
	},
})
