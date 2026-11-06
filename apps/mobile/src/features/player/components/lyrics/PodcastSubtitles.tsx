import { LegendList, type LegendListRef } from '@legendapp/list/react-native'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native'
import {
	ActivityIndicator,
	Dialog,
	List,
	Portal,
	Searchbar,
	Text,
	useTheme,
} from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Button from '@/components/common/Button'
import IconButton from '@/components/common/IconButton'
import { MainPlaybackControls } from '@/features/player/components/controls/PlayerControlContent'
import { PlayerSlider } from '@/features/player/components/main/PlayerSlider'
import { usePlayerSubtitles } from '@/features/player/hooks/usePlayerSubtitles'
import { useSubtitlePlayback } from '@/features/player/hooks/useSubtitlePlayback'
import {
	subtitleLabel,
	subtitleParagraphs,
} from '@/features/player/utils/subtitles'
import useAppStore from '@/hooks/stores/useAppStore'
import { seekWithinTrack } from '@/lib/player/seek'
import { toastAndLogError } from '@/utils/error-handling'

import { SubtitleParagraphItem } from './SubtitleParagraphItem'

export function PodcastSubtitles({ active }: { active: boolean }) {
	const data = usePlayerSubtitles(active)
	const { colors } = useTheme()
	const insets = useSafeAreaInsets()
	const [pickerVisible, setPickerVisible] = useState(false)
	const [height, setHeight] = useState(0)
	const list = useRef<LegendListRef>(null)
	const hasBilibiliCookie = useAppStore((state) => state.hasBilibiliCookie())
	const [following, setFollowing] = useState(true)
	const followingRef = useRef(true)
	const [searchVisible, setSearchVisible] = useState(false)
	const [search, setSearch] = useState('')
	const query = search.trim().toLocaleLowerCase()
	const paragraphs = useMemo(() => subtitleParagraphs(data.lines), [data.lines])
	const results = useMemo(
		() =>
			query
				? paragraphs.filter((paragraph) =>
						paragraph.content.toLocaleLowerCase().includes(query),
					)
				: paragraphs,
		[paragraphs, query],
	)
	const { index: currentCue, ready: playbackReady } = useSubtitlePlayback(
		data.lines,
		active,
	)
	const cueToParagraph = useMemo(() => {
		const mapping = new Map<number, number>()
		paragraphs.forEach((paragraph, paragraphIndex) => {
			paragraph.cues.forEach(({ index }) => mapping.set(index, paragraphIndex))
		})
		return mapping
	}, [paragraphs])
	const showControls = height - insets.bottom >= 520
	const scrollToCue = useCallback(
		(index: number, animated = true) => {
			const paragraphIndex = cueToParagraph.get(index)
			if (paragraphIndex === undefined) return
			void list.current?.scrollToIndex({
				index: paragraphIndex,
				animated,
				viewPosition: 0.2,
			})
		},
		[cueToParagraph],
	)
	const pauseFollowing = () => {
		followingRef.current = false
		setFollowing(false)
	}
	const resumeFollowing = () => {
		Keyboard.dismiss()
		setSearch('')
		setSearchVisible(false)
		followingRef.current = true
		setFollowing(true)
	}
	useEffect(() => {
		if (active && followingRef.current && !query) scrollToCue(currentCue)
	}, [active, following, currentCue, query, scrollToCue])
	useEffect(() => {
		followingRef.current = true
		setFollowing(true)
		setSearch('')
		setSearchVisible(false)
	}, [data.key, data.selected?.id_str, data.selected?.id])
	const jumpToLine = async (index: number) => {
		const line = data.lines[index]
		if (!line || !data.trackId) return
		try {
			const target = await seekWithinTrack(data.trackId, line.startTime / 1000)
			if (target !== null) {
				resumeFollowing()
				if (!query) scrollToCue(index)
			}
		} catch (error) {
			toastAndLogError('字幕跳转失败', error, 'Player.Subtitles')
		}
	}

	useEffect(() => {
		setPickerVisible(false)
	}, [data.key, active])

	return (
		<View
			style={styles.container}
			onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
			testID='player-subtitles-view'
		>
			<View style={styles.toolbar}>
				<View style={styles.toolbarRow}>
					<Button
						style={{ flex: 1 }}
						icon='subtitles-outline'
						onPress={() => setPickerVisible(true)}
						disabled={!data.tracks.length}
					>
						{data.selected ? subtitleLabel(data.selected) : 'B 站字幕'}
					</Button>
					<IconButton
						icon='magnify'
						accessibilityLabel='搜索字幕'
						disabled={!data.lines.length}
						onPress={() => {
							pauseFollowing()
							setSearchVisible(true)
						}}
					/>
				</View>
				{searchVisible ? (
					<Searchbar
						placeholder='搜索本期字幕'
						accessibilityLabel='搜索本期字幕'
						value={search}
						onChangeText={setSearch}
						icon='arrow-left'
						onIconPress={() => {
							setSearch('')
							setSearchVisible(false)
						}}
						autoFocus
					/>
				) : null}
				<Text
					variant='bodySmall'
					style={{ color: colors.onSurfaceVariant, textAlign: 'center' }}
				>
					{query
						? `找到 ${results.length} 段相关内容 · 点句跳转播放`
						: '来自 B 站 · 点句跳转播放'}
				</Text>
			</View>
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
				<LegendList
					key={`${data.key}:${data.selected?.id_str ?? data.selected?.id}:${query ? 'search' : 'read'}`}
					ref={list}
					data={results}
					dataKey={query}
					extraData={currentCue}
					estimatedItemSize={180}
					initialScrollIndex={
						query
							? 0
							: {
									index: cueToParagraph.get(currentCue) ?? 0,
									viewPosition: 0.2,
								}
					}
					keyExtractor={(item) => item.id}
					contentContainerStyle={{ paddingTop: 8, paddingBottom: 80 }}
					showsVerticalScrollIndicator
					keyboardShouldPersistTaps='handled'
					keyboardDismissMode='on-drag'
					onScrollBeginDrag={pauseFollowing}
					ListEmptyComponent={
						<View style={styles.message}>
							<Text>没有找到相关字幕，试试其他关键词</Text>
						</View>
					}
					renderItem={({ item }) => (
						<SubtitleParagraphItem
							paragraph={item}
							currentCue={currentCue}
							query={query}
							onSeek={(index) => {
								void jumpToLine(index)
							}}
						/>
					)}
				/>
			)}
			{!following && data.lines.length > 0 && (
				<View style={styles.followBar}>
					<Button
						icon='play-circle-outline'
						mode='contained-tonal'
						onPress={resumeFollowing}
					>
						回到正在播放
					</Button>
				</View>
			)}
			{showControls && (
				<View
					style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 8 }}
				>
					<PlayerSlider showChapterTitle={false} />
					<MainPlaybackControls size='compact' />
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
						<Button onPress={() => setPickerVisible(false)}>完成</Button>
					</Dialog.Actions>
				</Dialog>
			</Portal>
		</View>
	)
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	toolbarRow: { flexDirection: 'row', alignItems: 'center' },
	followBar: { alignItems: 'center', paddingVertical: 8 },
	toolbar: { paddingHorizontal: 24, paddingBottom: 8, gap: 4 },
	message: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		padding: 24,
		gap: 16,
	},
})
