import { Orpheus, useIsPlaying, type AbLoopRange } from '@bbplayer/orpheus'
import { useEffect, useRef, useState } from 'react'
import { AppState, Keyboard, StyleSheet, View } from 'react-native'
import { ScrollView, Touchable } from 'react-native-gesture-handler'
import {
	Dialog,
	Divider,
	Switch,
	Text,
	TextInput,
	useTheme,
} from 'react-native-paper'

import Button from '@/components/common/Button'
import IconButton from '@/components/common/IconButton'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { useAbLoopDraftStore } from '@/hooks/stores/useAbLoopDraftStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import {
	AbLoopRecoveryError,
	beginAbLoopEdit,
	clearAbLoop,
	endAbLoopEdit,
	isAbLoopEditCurrent,
	previewAbLoop,
	saveAbLoop,
	seekAbLoopEdit,
} from '@/lib/player/abLoop'
import {
	initialAbLoopRange,
	isAbLoopRangeValid,
	moveAbLoopPoint,
} from '@/lib/player/abLoopDraft'
import playerProgressEmitter from '@/lib/player/progressListener'
import { toastAndLogError } from '@/utils/error-handling'
import toast from '@/utils/toast'

import AbLoopTimeline from './AbLoopTimeline'

export default function AbLoopModal() {
	const track = useCurrentTrack()
	return <AbLoopEditor key={track?.uniqueKey ?? 'empty'} />
}

function AbLoopEditor() {
	const trackId = useCurrentTrack()?.uniqueKey
	const close = useModalStore((state) => state.close)
	const draft = useAbLoopDraftStore((state) => state.draft)
	const range = draft?.trackId === trackId ? draft : null
	const { colors } = useTheme()
	const isPlaying = useIsPlaying()
	const [duration, setDuration] = useState(0)
	const [position, setPosition] = useState(0)
	const [scrubbing, setScrubbing] = useState<number | null>(null)
	const [ready, setReady] = useState(false)
	const [busy, setBusy] = useState(false)
	const [previewing, setPreviewing] = useState(false)
	const [hasSavedLoop, setHasSavedLoop] = useState(false)
	const [foreground, setForeground] = useState(
		AppState.currentState === 'active',
	)
	const [error, setError] = useState<string | null>(null)
	const [retry, setRetry] = useState(0)
	const [pointInput, setPointInput] = useState<{
		point: 'start' | 'end'
		text: string
		error?: string
	} | null>(null)
	const session = useRef<number | null>(null)
	const mounted = useRef(false)
	const inFlight = useRef(false)
	const rangeRef = useRef(range)
	useEffect(() => {
		rangeRef.current = range
	}, [range])

	useEffect(() => {
		mounted.current = true
		const sub = AppState.addEventListener('change', (state) => {
			if (state !== 'active') {
				setReady(false)
				setPreviewing(false)
			}
			setForeground(state === 'active')
		})
		return () => {
			mounted.current = false
			sub.remove()
		}
	}, [])

	useEffect(() => {
		if (!trackId || !foreground) return
		let disposed = false
		let token: number | null = null
		setReady(false)
		setPreviewing(false)
		setScrubbing(null)
		setError(null)
		const syncProgress = (progress: { position: number; duration: number }) => {
			if (disposed) return
			setPosition(progress.position)
			setDuration(progress.duration)
		}
		const unsubscribe = playerProgressEmitter.subscribe(
			'progress',
			syncProgress,
		)
		void (async () => {
			try {
				const editor = await beginAbLoopEdit(trackId)
				if (!editor) {
					if (!disposed) setError('当前曲目已变化，请重新打开设置')
					return
				}
				token = editor.token
				if (disposed) {
					await endAbLoopEdit(token)
					return
				}
				session.current = token
				const [pos, dur] = await Promise.all([
					Orpheus.getPosition(),
					Orpheus.getDuration(),
				])
				if (disposed || !isAbLoopEditCurrent(token)) return
				syncProgress({ position: pos, duration: dur })
				setHasSavedLoop(!!editor.savedLoop)
				const existing = useAbLoopDraftStore.getState().draft
				if (
					Number.isFinite(dur) &&
					dur >= 0.001 &&
					(!existing ||
						existing.trackId !== trackId ||
						!isAbLoopRangeValid(existing, dur))
				) {
					const saved = editor.savedLoop
					useAbLoopDraftStore
						.getState()
						.setDraft(
							trackId,
							saved && isAbLoopRangeValid(saved, dur)
								? saved
								: initialAbLoopRange(pos, dur),
						)
				}
				setReady(true)
			} catch (e) {
				if (!disposed) {
					setError('无法初始化 AB 编辑器，请重试')
					toastAndLogError('读取 AB 设置失败', e, 'Modal.AbLoop')
				}
			}
		})()
		return () => {
			disposed = true
			unsubscribe()
			session.current = null
			if (token !== null)
				void endAbLoopEdit(token).catch((e: unknown) =>
					toastAndLogError('恢复区间循环失败', e, 'Modal.AbLoop'),
				)
		}
	}, [trackId, foreground, retry])

	// 流媒体晚到的时长也可以初始化草稿。
	useEffect(() => {
		if (!ready || !trackId || !Number.isFinite(duration) || duration < 0.001)
			return
		const existing = useAbLoopDraftStore.getState().draft
		if (!existing || existing.trackId !== trackId)
			useAbLoopDraftStore
				.getState()
				.setDraft(trackId, initialAbLoopRange(position, duration))
		else if (!isAbLoopRangeValid(existing, duration)) {
			const end = Math.min(duration, existing.end)
			const start = Math.min(existing.start, Math.max(0, end - 0.001))
			useAbLoopDraftStore.getState().setDraft(trackId, { start, end })
			setPreviewing(false)
			const token = session.current
			if (token !== null)
				void previewAbLoop(token, null).catch((e: unknown) =>
					toastAndLogError('暂停试听失败', e, 'Modal.AbLoop'),
				)
		}
	}, [ready, trackId, duration, position])

	const valid = !!range && isAbLoopRangeValid(range, duration)
	const enabled = ready && foreground && valid && !busy
	const run = async (operation: (token: number) => Promise<void>) => {
		const token = session.current
		if (
			token === null ||
			!isAbLoopEditCurrent(token) ||
			inFlight.current ||
			!ready
		)
			return
		inFlight.current = true
		setBusy(true)
		setError(null)
		try {
			await operation(token)
		} catch (e) {
			if (mounted.current && session.current === token) {
				setError(
					e instanceof AbLoopRecoveryError
						? e.message
						: '操作失败，草稿已保留，请重试',
				)
				toastAndLogError('区间循环操作失败', e, 'Modal.AbLoop')
			}
		} finally {
			inFlight.current = false
			if (mounted.current) setBusy(false)
		}
	}
	const updatePoint = (point: 'start' | 'end', value: number) => {
		if (!enabled || !mounted.current || !trackId || !rangeRef.current) return
		const next = moveAbLoopPoint(rangeRef.current, point, value, duration)
		useAbLoopDraftStore.getState().setDraft(trackId, next)
		rangeRef.current = { trackId, ...next }
		return next
	}
	const commitRange = (next: AbLoopRange | undefined) => {
		if (!next || !previewing) return
		return run(async (token) => {
			if (!(await previewAbLoop(token, next))) throw new Error('试听区间未应用')
			const pos = await Orpheus.getPosition()
			if (pos < next.start || pos >= next.end)
				await seekAbLoopEdit(token, next.start)
		})
	}
	const confirmPointInput = () => {
		if (!enabled || !pointInput) return
		const text = pointInput.text.trim().replace(',', '.')
		const value = Number(text)
		if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) || !Number.isFinite(value)) {
			setPointInput({ ...pointInput, error: '请输入有效的秒数' })
			return
		}
		if (value < 0 || value > duration) {
			setPointInput({ ...pointInput, error: '秒数不能超过曲目时长' })
			return
		}
		const next = updatePoint(pointInput.point, value)
		if (!next) return
		setPointInput(null)
		Keyboard.dismiss()
		void commitRange(next)
	}
	const handleSave = () =>
		void run(async (token) => {
			const next = rangeRef.current
			if (!trackId || !next || !isAbLoopRangeValid(next, duration)) return
			const pos = await Orpheus.getPosition()
			if (pos < next.start || pos >= next.end)
				await seekAbLoopEdit(token, next.start)
			const result = await saveAbLoop(trackId, next.start, next.end, token)
			if (result.status === 'ignored') throw new Error('循环未保存')
			if (!mounted.current || session.current !== token) return
			toast.success(
				result.playback === 'applied'
					? '区间循环已保存并开启'
					: '区间循环已保存，下次播放生效',
			)
			close('AbLoop')
		})
	const togglePreview = (value: boolean) =>
		void run(async (token) => {
			const next = rangeRef.current
			if (!next) return
			if (!(await previewAbLoop(token, value ? next : null)))
				throw new Error('试听状态未应用')
			if (value) await seekAbLoopEdit(token, next.start)
			if (mounted.current && session.current === token) setPreviewing(value)
		})
	const handleSeek = async (_point: 'start' | 'end', value: number) => {
		let accepted: AbLoopRange | undefined
		await run(async (token) => {
			setScrubbing(value)
			try {
				if (previewing && !(await previewAbLoop(token, null))) return
				const target = await seekAbLoopEdit(token, value)
				if (mounted.current && session.current === token) {
					setPreviewing(false)
					if (target !== null) {
						setPosition(target)
						accepted = { start: target, end: duration }
					}
				}
			} finally {
				if (mounted.current) setScrubbing(null)
			}
		})
		return accepted
	}

	return (
		<>
			<Dialog.Title style={styles.title}>区间循环</Dialog.Title>
			<ScrollView
				style={styles.scroll}
				contentContainerStyle={styles.content}
				keyboardShouldPersistTaps='handled'
			>
				<Text
					variant='bodySmall'
					style={{ color: colors.onSurfaceVariant }}
				>
					拖动 A/B 选段，点击数值可输入秒数。
				</Text>
				<AbLoopTimeline
					duration={Number.isFinite(duration) ? duration : 0}
					range={range ?? { start: 0, end: 0 }}
					disabled={!enabled}
					onCommit={async (point, value, next) => {
						const token = session.current
						if (
							!enabled ||
							!mounted.current ||
							!trackId ||
							token === null ||
							!isAbLoopEditCurrent(token)
						)
							return
						next ??= updatePoint(point, value)
						if (!next) return
						if (!isAbLoopRangeValid(next, duration)) return
						useAbLoopDraftStore.getState().setDraft(trackId, next)
						rangeRef.current = { trackId, ...next }
						await commitRange(next)
						return next
					}}
				/>
				{(['start', 'end'] as const).map((point) => (
					<View
						key={point}
						style={styles.pointRow}
					>
						<View style={styles.pointControls}>
							<Text variant='labelLarge'>{point === 'start' ? 'A' : 'B'}</Text>
							<IconButton
								icon='minus'
								size={20}
								style={styles.pointButton}
								accessibilityLabel={
									(point === 'start' ? 'A' : 'B') + ' 点后退 0.5 秒'
								}
								disabled={!enabled}
								onPress={() =>
									commitRange(updatePoint(point, (range?.[point] ?? 0) - 0.5))
								}
							/>
							{pointInput?.point === point ? (
								<TextInput
									mode='outlined'
									dense
									label='秒'
									accessibilityLabel={`${point === 'start' ? 'A' : 'B'} 点时间（秒）`}
									value={pointInput.text}
									onChangeText={(text) => setPointInput({ point, text })}
									keyboardType='decimal-pad'
									autoFocus
									selectTextOnFocus
									disabled={!enabled}
									error={!!pointInput.error}
									onSubmitEditing={confirmPointInput}
									style={styles.pointInput}
									testID='ab-loop-point-input'
								/>
							) : (
								<Touchable
									disabled={!enabled}
									accessibilityRole='button'
									accessibilityLabel={`输入 ${point === 'start' ? 'A' : 'B'} 点时间（秒）`}
									onPress={() => {
										if (!enabled || !range) return
										setPointInput({
											point,
											text: String(Math.round(range[point] * 1000) / 1000),
										})
									}}
									style={styles.pointValue}
									testID={`ab-loop-edit-${point}`}
								>
									<Text
										variant='bodyLarge'
										style={{
											color: enabled
												? colors.primary
												: colors.onSurfaceDisabled,
											fontVariant: ['tabular-nums'],
										}}
									>
										{(range?.[point] ?? 0).toFixed(1)} 秒
									</Text>
								</Touchable>
							)}
							<IconButton
								icon='plus'
								size={20}
								style={styles.pointButton}
								accessibilityLabel={
									(point === 'start' ? 'A' : 'B') + ' 点前进 0.5 秒'
								}
								disabled={!enabled}
								onPress={() =>
									commitRange(updatePoint(point, (range?.[point] ?? 0) + 0.5))
								}
							/>
							{pointInput?.point !== point && (
								<Button
									compact
									mode='outlined'
									disabled={!enabled}
									labelStyle={styles.currentLabel}
									testID={'ab-loop-set-' + point}
									onPress={() =>
										void run(async (token) => {
											const pos = await Orpheus.getPosition()
											if (
												mounted.current &&
												isAbLoopEditCurrent(token) &&
												trackId === (await Orpheus.getCurrentTrack())?.id
											) {
												const next = updatePoint(point, pos)
												if (previewing && next) await previewAbLoop(token, next)
											}
										})
									}
								>
									取当前
								</Button>
							)}
							{pointInput?.point === point && (
								<View style={styles.inputRow}>
									<IconButton
										icon='close'
										size={20}
										style={styles.pointButton}
										accessibilityLabel='取消输入时间'
										onPress={() => {
											setPointInput(null)
											Keyboard.dismiss()
										}}
										testID='ab-loop-point-cancel'
									/>
									<IconButton
										icon='check'
										size={20}
										style={styles.pointButton}
										accessibilityLabel='确认时间'
										disabled={!enabled}
										onPress={confirmPointInput}
										testID='ab-loop-point-confirm'
									/>
								</View>
							)}
						</View>
						{pointInput?.point === point && pointInput.error && (
							<Text style={{ color: colors.error }}>{pointInput.error}</Text>
						)}
					</View>
				))}
				<Divider style={styles.divider} />
				<Text variant='labelLarge'>播放进度</Text>
				<AbLoopTimeline
					duration={Number.isFinite(duration) ? duration : 0}
					position={scrubbing ?? position}
					disabled={!enabled}
					onCommit={handleSeek}
				/>
				<View style={styles.playbackRow}>
					<Button
						mode='contained-tonal'
						icon={isPlaying ? 'pause' : 'play'}
						disabled={!enabled}
						testID='ab-loop-play'
						onPress={() =>
							void run(async (token) => {
								if (
									(await Orpheus.getCurrentTrack())?.id !== trackId ||
									!isAbLoopEditCurrent(token)
								)
									return
								if (isPlaying) await Orpheus.pause()
								else await Orpheus.play()
							})
						}
					>
						{isPlaying ? '暂停' : '播放'}
					</Button>
					<View style={styles.previewControl}>
						<Text>循环试听</Text>
						<Switch
							value={previewing}
							disabled={!enabled}
							onValueChange={togglePreview}
							accessibilityLabel='循环试听'
							testID='ab-loop-preview'
						/>
					</View>
				</View>
				<Text
					style={{ color: colors.onSurfaceVariant }}
					variant='bodySmall'
				>
					拖动播放进度会退出循环试听；草稿只在保存后正式生效。
				</Text>
				{(!Number.isFinite(duration) || duration < 0.001) && (
					<Text style={{ color: colors.error }}>
						当前曲目时长不可用，暂时无法选段或试听。
					</Text>
				)}
				{error && (
					<Text
						style={{ color: colors.error }}
						testID='ab-loop-error'
					>
						{error}
					</Text>
				)}
				{!ready && foreground && error && (
					<Button onPress={() => setRetry((value) => value + 1)}>重试</Button>
				)}
			</ScrollView>
			{hasSavedLoop && (
				<Button
					textColor={colors.error}
					compact
					disabled={!ready || busy}
					testID='ab-loop-clear'
					onPress={() =>
						void run(async (token) => {
							if (!trackId) return
							const result = await clearAbLoop(trackId, token)
							if (result.status === 'ignored') throw new Error('循环未清除')
							if (mounted.current && session.current === token) {
								toast.success(
									result.playback === 'applied'
										? '已清除区间循环'
										: '已清除区间循环，下次播放生效',
								)
								close('AbLoop')
							}
						})
					}
				>
					清除循环
				</Button>
			)}
			<Dialog.Actions style={styles.actions}>
				<Button
					onPress={() => close('AbLoop')}
					compact
					testID='ab-loop-close'
				>
					关闭
				</Button>
				<Button
					mode='contained'
					compact
					disabled={!enabled}
					loading={busy}
					onPress={handleSave}
					testID='ab-loop-save'
				>
					保存并开启
				</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	title: { marginTop: 12, marginBottom: 8, marginHorizontal: 20 },
	scroll: { flexShrink: 1, minHeight: 0 },
	content: { paddingHorizontal: 20, paddingBottom: 8, gap: 6 },
	pointRow: { gap: 4 },
	pointControls: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		minHeight: 52,
	},
	pointButton: { margin: 0 },
	currentLabel: { fontSize: 12, marginHorizontal: 6 },
	inputRow: { flexDirection: 'row', alignItems: 'center' },
	pointInput: { width: 88, height: 48 },
	pointValue: {
		width: 88,
		height: 48,
		paddingHorizontal: 4,
		justifyContent: 'center',
		alignItems: 'center',
	},
	divider: { marginVertical: 4 },
	playbackRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		flexWrap: 'wrap',
		gap: 8,
	},
	previewControl: { flexDirection: 'row', alignItems: 'center', gap: 4 },
	actions: { flexWrap: 'wrap', flexShrink: 0 },
})
