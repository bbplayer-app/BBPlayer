import { LegendList, type LegendListRef } from '@legendapp/list/react-native'
import { TrueSheet } from '@lodev09/react-native-true-sheet'
import { useCallback, useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
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
	const list = useRef<LegendListRef>(null)
	const didScroll = useRef(false)
	const [seeking, setSeeking] = useState(false)
	const currentIndex = chapterIndexAt(data.chapters, data.position)

	useEffect(() => {
		didScroll.current = false
	}, [isOpen, data.trackId])

	const scrollToCurrent = useCallback(() => {
		if (!isOpen || didScroll.current || currentIndex < 0 || !list.current)
			return
		didScroll.current = true
		void list.current
			.scrollToIndex({
				index: currentIndex,
				animated: false,
				viewPosition: 0.5,
			})
			.catch(() => {
				didScroll.current = false
			})
	}, [currentIndex, isOpen])

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
		} catch (error) {
			toastAndLogError('章节跳转失败', error, 'Player.Chapters')
		} finally {
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
						<LegendList
							key={data.trackId}
							ref={list}
							data={data.chapters}
							keyExtractor={(item) => item.id}
							onLoad={scrollToCurrent}
							onLayout={scrollToCurrent}
							onScrollBeginDrag={() => {
								didScroll.current = true
							}}
							extraData={currentIndex}
							contentContainerStyle={{
								paddingBottom: insets.bottom + 20,
							}}
							renderItem={({ item, index: chapterIndex }) => (
								<List.Item
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
							)}
						/>
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
