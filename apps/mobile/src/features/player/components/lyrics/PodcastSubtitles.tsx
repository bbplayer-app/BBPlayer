import { useValue } from '@legendapp/state/react'
import MaskedView from '@react-native-masked-view/masked-view'
import { LinearGradient } from 'expo-linear-gradient'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import {
	ActivityIndicator,
	Dialog,
	List,
	Portal,
	Text,
	useTheme,
} from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Button from '@/components/common/Button'
import { MainPlaybackControls } from '@/features/player/components/controls/PlayerControlContent'
import { PlayerSlider } from '@/features/player/components/main/PlayerSlider'
import { usePlayerSubtitles } from '@/features/player/hooks/usePlayerSubtitles'
import { useSubtitlePlayback } from '@/features/player/hooks/useSubtitlePlayback'
import { createSubtitleReaderStore } from '@/features/player/stores/subtitleReaderStore'
import { exportSubtitles } from '@/features/player/utils/exportSubtitles'
import { subtitleLabel } from '@/features/player/utils/subtitles'
import useAppStore from '@/hooks/stores/useAppStore'
import { toastAndLogError } from '@/utils/error-handling'

import {
	SubtitleLocateButton,
	SubtitleReaderToolbar,
	SubtitleTranscript,
} from './SubtitleReader'

export function PodcastSubtitles({ active }: { active: boolean }) {
	const data = usePlayerSubtitles(active)
	const { lines, trackId } = data
	const { colors } = useTheme()
	const insets = useSafeAreaInsets()
	const [pickerVisible, setPickerVisible] = useState(false)
	const [exporting, setExporting] = useState(false)
	const exportingRef = useRef(false)
	const [height, setHeight] = useState(0)
	const hasBilibiliCookie = useAppStore((state) => state.hasBilibiliCookie())
	const sourceKey = `${data.key}:${data.selected?.id_str ?? data.selected?.id}`
	const store = useMemo(
		() => createSubtitleReaderStore(lines, trackId ?? undefined, sourceKey),
		[lines, trackId, sourceKey],
	)
	useSubtitlePlayback(store, active)
	const playbackReady = useValue(store.state$.ready)
	const showControls = height - insets.bottom >= 520
	const openPicker = useCallback(() => setPickerVisible(true), [])

	useEffect(() => {
		setPickerVisible(false)
	}, [data.key, active])
	const handleExport = async () => {
		if (exportingRef.current || !data.selected || !data.lines.length) return
		exportingRef.current = true
		setExporting(true)
		try {
			await exportSubtitles(
				data.lines,
				data.title,
				subtitleLabel(data.selected),
			)
		} catch (error) {
			toastAndLogError('字幕导出失败', error, 'Player.Subtitles')
		} finally {
			exportingRef.current = false
			setExporting(false)
		}
	}

	return (
		<View
			style={styles.container}
			onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
			testID='player-subtitles-view'
		>
			<SubtitleReaderToolbar
				store={store}
				label={data.selected ? subtitleLabel(data.selected) : 'B 站字幕'}
				canSelect={!!data.tracks.length}
				canSearch={!!data.lines.length}
				onSelect={openPicker}
			/>
			<View style={styles.transcript}>
				{data.isLoading || (data.lines.length > 0 && !playbackReady) ? (
					<View style={styles.message}>
						<ActivityIndicator />
						<Text>正在加载字幕…</Text>
					</View>
				) : data.isError ? (
					<View style={styles.message}>
						<Text>字幕加载失败，播放不受影响</Text>
						<Button
							onPress={() => {
								void data.retry()
							}}
						>
							重试
						</Button>
					</View>
				) : !data.lines.length ? (
					<View style={styles.message}>
						<Text>
							{data.isLocal
								? '本地音频不支持 B 站字幕'
								: data.selected
									? '这份字幕暂无内容，可尝试切换其他字幕'
									: '此视频暂无可用字幕'}
						</Text>
						{!data.isLocal && !hasBilibiliCookie && (
							<Text
								variant='bodySmall'
								style={{ color: colors.onSurfaceVariant }}
							>
								部分字幕需要先在「我的」登录 B 站账号
							</Text>
						)}
					</View>
				) : (
					<MaskedView
						style={styles.transcript}
						maskElement={
							<View
								style={styles.transcript}
								pointerEvents='none'
							>
								<LinearGradient
									style={styles.edgeFade}
									colors={['transparent', '#000']}
									start={{ x: 0, y: 0 }}
									end={{ x: 0, y: 1 }}
								/>
								<View style={styles.maskSolid} />
								<LinearGradient
									style={styles.edgeFade}
									colors={['#000', 'transparent']}
									start={{ x: 0, y: 0 }}
									end={{ x: 0, y: 1 }}
								/>
							</View>
						}
					>
						<SubtitleTranscript
							key={sourceKey}
							store={store}
							active={active}
						/>
					</MaskedView>
				)}
				{playbackReady &&
					!data.isLoading &&
					!data.isError &&
					data.lines.length > 0 && <SubtitleLocateButton store={store} />}
			</View>
			{showControls && (
				<View
					style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 8 }}
				>
					<PlayerSlider showChapterTitle={false} />
					<MainPlaybackControls
						podcast
						size='compact'
					/>
				</View>
			)}
			<Portal>
				<Dialog
					visible={pickerVisible && active}
					onDismiss={() => setPickerVisible(false)}
				>
					<Dialog.Title>选择字幕</Dialog.Title>
					<Dialog.Content>
						<Text variant='bodyMedium'>
							记住你的语言偏好；没有对应字幕时优先使用人工字幕。
						</Text>
					</Dialog.Content>
					<Dialog.ScrollArea style={{ maxHeight: 320 }}>
						<ScrollView>
							{data.tracks.map((track) => (
								<List.Item
									key={track.id_str ?? String(track.id)}
									title={subtitleLabel(track)}
									titleNumberOfLines={3}
									accessibilityRole='radio'
									accessibilityState={{ checked: track === data.selected }}
									right={(props) => (
										<List.Icon
											{...props}
											icon={
												track === data.selected
													? 'radiobox-marked'
													: 'radiobox-blank'
											}
											color={
												track === data.selected
													? colors.primary
													: colors.onSurfaceVariant
											}
										/>
									)}
									onPress={() => {
										data.select(track)
										setPickerVisible(false)
									}}
								/>
							))}
						</ScrollView>
					</Dialog.ScrollArea>
					<Dialog.Actions>
						<Button
							icon='download-outline'
							loading={exporting}
							disabled={
								exporting ||
								data.isLoading ||
								data.isError ||
								!data.lines.length
							}
							onPress={() => {
								void handleExport()
							}}
							testID='subtitle-export-lrc'
						>
							导出 LRC
						</Button>
						<Button onPress={() => setPickerVisible(false)}>完成</Button>
					</Dialog.Actions>
				</Dialog>
			</Portal>
		</View>
	)
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	transcript: { flex: 1 },
	edgeFade: { height: 60 },
	maskSolid: { flex: 1, backgroundColor: '#000' },
	message: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		padding: 24,
		gap: 16,
	},
})
