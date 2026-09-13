import { TrueSheet } from '@lodev09/react-native-true-sheet'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { ActivityIndicator, List, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Button from '@/components/common/Button'
import { usePlayerChapters } from '@/features/player/hooks/usePlayerChapters'
import { chapterIndexAt, type Chapter } from '@/features/player/utils/chapters'
import { usePlayerChaptersSheetStore } from '@/hooks/stores/usePlayerChaptersSheetStore'
import { seekWithinTrack } from '@/lib/player/seek'
import { toastAndLogError } from '@/utils/error-handling'
import { formatDurationToHHMMSS } from '@/utils/time'

export function PlayerChaptersSheet() {
	const data = usePlayerChapters()
	const isOpen = usePlayerChaptersSheetStore((state) => state.isOpen)
	const { colors } = useTheme()
	const insets = useSafeAreaInsets()
	const list = useRef<ScrollView>(null)
	const didScroll = useRef(false)
	const rowLayouts = useRef(new Map<string, { y: number; height: number }>())
	const viewportHeight = useRef(0)
	const [seeking, setSeeking] = useState(false)
	const currentIndex = chapterIndexAt(data.chapters, data.position)

	useEffect(() => {
		didScroll.current = false
	}, [isOpen, data.trackId])

	const scrollToCurrent = useCallback(() => {
		if (!isOpen || didScroll.current || currentIndex < 0 || !list.current)
			return
		const chapter = data.chapters[currentIndex]
		const layout = chapter && rowLayouts.current.get(chapter.id)
		if (!layout || !viewportHeight.current) return
		didScroll.current = true
		list.current.scrollTo({
			y: Math.max(0, layout.y - (viewportHeight.current - layout.height) / 2),
			animated: false,
		})
	}, [currentIndex, data.chapters, isOpen])

	useEffect(scrollToCurrent, [
		scrollToCurrent,
		data.chapters.length,
		data.trackId,
	])

	const selectChapter = async (chapter: Chapter) => {
		if (!data.trackId || seeking) return
		setSeeking(true)
		try {
			const target = await seekWithinTrack(data.trackId, chapter.startSeconds)
			if (target !== null) void usePlayerChaptersSheetStore.getState().close()
			setSeeking(false)
		} catch (error) {
			toastAndLogError('章节跳转失败', error, 'Player.Chapters')
			setSeeking(false)
		}
	}

	return (
		<TrueSheet
			name='playerChaptersSheet'
			detents={[0.65]}
			cornerRadius={24}
			backgroundColor={colors.elevation.level1}
			scrollable
			onMount={scrollToCurrent}
			onDidPresent={() => {
				usePlayerChaptersSheetStore.getState().setOpen(true)
			}}
			onWillDismiss={() => {
				usePlayerChaptersSheetStore.getState().setOpen(false)
			}}
			onDidDismiss={() => {
				usePlayerChaptersSheetStore.getState().setOpen(false)
			}}
		>
			<View style={{ height: '100%' }}>
				<Text
					variant='titleMedium'
					style={{ padding: 20 }}
				>
					章节
				</Text>
				<View style={{ flex: 1, minHeight: 2 }}>
					{data.chapters.length > 0 ? (
						<ScrollView
							key={data.trackId}
							ref={list}
							onLayout={(event) => {
								viewportHeight.current = event.nativeEvent.layout.height
								scrollToCurrent()
							}}
							onContentSizeChange={scrollToCurrent}
							nestedScrollEnabled
							onScrollBeginDrag={() => {
								didScroll.current = true
							}}
							contentContainerStyle={{
								paddingBottom: insets.bottom + 20,
							}}
						>
							{data.chapters.map((item, chapterIndex) => (
								<List.Item
									key={item.id}
									onLayout={(event) => {
										rowLayouts.current.set(item.id, event.nativeEvent.layout)
										scrollToCurrent()
									}}
									title={item.title}
									titleNumberOfLines={3}
									description={
										chapterIndex === currentIndex ? '正在播放' : undefined
									}
									left={() => (
										<Text
											style={{
												paddingLeft: 16,
												alignSelf: 'center',
												fontVariant: ['tabular-nums'],
											}}
										>
											{formatDurationToHHMMSS(item.startSeconds)}
										</Text>
									)}
									right={
										chapterIndex === currentIndex
											? (props) => (
													<List.Icon
														{...props}
														icon='equalizer'
														color={colors.primary}
													/>
												)
											: undefined
									}
									style={{
										backgroundColor:
											chapterIndex === currentIndex
												? colors.secondaryContainer
												: undefined,
									}}
									titleStyle={{
										color:
											chapterIndex === currentIndex
												? colors.onSecondaryContainer
												: colors.onSurface,
									}}
									accessibilityState={{
										selected: chapterIndex === currentIndex,
										disabled: seeking,
									}}
									disabled={seeking}
									onPress={() => {
										void selectChapter(item)
									}}
								/>
							))}
						</ScrollView>
					) : (
						<View style={{ padding: 24, gap: 16, alignItems: 'center' }}>
							{data.isLoading ? (
								<>
									<ActivityIndicator />
									<Text>正在加载章节…</Text>
								</>
							) : data.isError ? (
								<>
									<Text>章节加载失败，播放不受影响</Text>
									<Button
										onPress={() => {
											void data.retry()
										}}
									>
										重试
									</Button>
								</>
							) : (
								<Text>
									{data.isLocal ? '此音频暂无章节' : '此视频暂无章节'}
								</Text>
							)}
						</View>
					)}
				</View>
			</View>
		</TrueSheet>
	)
}
