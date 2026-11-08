import { LegendList, type LegendListRef } from '@legendapp/list/react-native'
import { observe } from '@legendapp/state'
import { useValue } from '@legendapp/state/react'
import { useEffect, useRef } from 'react'
import { Keyboard, StyleSheet, View } from 'react-native'

import IconButton from '@/components/common/IconButton'
import { VariantPlainText } from '@/components/common/VariantPlainText'
import type { SubtitleReaderStore } from '@/features/player/stores/subtitleReaderStore'
import type { SubtitleParagraph } from '@/features/player/utils/subtitles'

import { SubtitleParagraphItem } from './SubtitleParagraphItem'
import { SubtitleSearchToolbar } from './SubtitleSearchToolbar'

export function SubtitleReaderToolbar({
	store,
	label,
	canSelect,
	canSearch,
	onSelect,
}: {
	store: SubtitleReaderStore
	label: string
	canSelect: boolean
	canSearch: boolean
	onSelect: () => void
}) {
	const visible = useValue(store.state$.searchVisible)
	const search = useValue(store.state$.search)
	const resultIndex = useValue(store.state$.resultIndex)
	const resultCount = useValue(
		() => store.state$.searchResults.get().paragraphs.length,
	)
	return (
		<SubtitleSearchToolbar
			label={label}
			canSelect={canSelect}
			canSearch={canSearch}
			visible={visible}
			search={search}
			resultIndex={resultIndex}
			resultCount={resultCount}
			onSelect={onSelect}
			onOpen={store.openSearch}
			onClose={() => {
				Keyboard.dismiss()
				store.resumeFollowing()
			}}
			onChangeSearch={store.changeSearch}
			onNavigate={(direction) => {
				Keyboard.dismiss()
				store.navigateSearch(direction)
			}}
		/>
	)
}

function ReadingSubtitles({
	store,
	active,
}: {
	store: SubtitleReaderStore
	active: boolean
}) {
	const list = useRef<LegendListRef>(null)
	useEffect(
		() =>
			observe(() => {
				const following = store.state$.following.get()
				const query = store.state$.query.get()
				const index = store.state$.currentParagraphIndex.get()
				store.state$.followRevision.get()
				if (active && following && !query) {
					void list.current?.scrollToIndex({
						index,
						animated: true,
						viewPosition: 0.2,
					})
				}
			}),
		[active, store],
	)
	return (
		<LegendList
			ref={list}
			testID='subtitle-reading-list'
			data={store.content.paragraphs}
			estimatedItemSize={180}
			initialScrollIndex={{
				index: store.state$.currentParagraphIndex.peek(),
				viewPosition: 0.2,
			}}
			keyExtractor={(item) => item.id}
			contentContainerStyle={styles.content}
			keyboardShouldPersistTaps='handled'
			keyboardDismissMode='on-drag'
			onScrollBeginDrag={store.pauseFollowing}
			onViewableItemsChanged={({
				viewableItems,
			}: {
				viewableItems: { item: SubtitleParagraph }[]
			}) =>
				store.setVisibleParagraphs(
					viewableItems.map(({ item }) => item.id),
					false,
				)
			}
			viewabilityConfig={{ itemVisiblePercentThreshold: 1 }}
			renderItem={({ item }) => (
				<SubtitleParagraphItem
					paragraph={item}
					store={store}
					query=''
				/>
			)}
		/>
	)
}

function SearchSubtitles({ store }: { store: SubtitleReaderStore }) {
	const list = useRef<LegendListRef>(null)
	const results = useValue(store.state$.searchResults)
	const resultIndex = useValue(store.state$.resultIndex)
	const searching = useValue(() => !!store.state$.query.get())
	useEffect(() => {
		if (searching && results.paragraphs.length) {
			void list.current?.scrollToIndex({
				index: resultIndex,
				animated: true,
				viewPosition: 0.1,
			})
		}
	}, [results, resultIndex, searching])
	return (
		<LegendList
			ref={list}
			testID='subtitle-search-results-list'
			data={results.paragraphs}
			estimatedItemSize={180}
			keyExtractor={(item) => item.id}
			contentContainerStyle={styles.content}
			keyboardShouldPersistTaps='handled'
			keyboardDismissMode='on-drag'
			onScrollBeginDrag={store.pauseFollowing}
			onViewableItemsChanged={({
				viewableItems,
			}: {
				viewableItems: { item: SubtitleParagraph }[]
			}) =>
				store.setVisibleParagraphs(
					viewableItems.map(({ item }) => item.id),
					true,
				)
			}
			viewabilityConfig={{ itemVisiblePercentThreshold: 1 }}
			ListEmptyComponent={
				<View style={styles.empty}>
					<VariantPlainText>没有找到相关字幕，试试其他关键词</VariantPlainText>
				</View>
			}
			renderItem={({ item }) => (
				<SubtitleParagraphItem
					paragraph={item}
					store={store}
					query={results.query}
				/>
			)}
		/>
	)
}

export function SubtitleTranscript({
	store,
	active,
}: {
	store: SubtitleReaderStore
	active: boolean
}) {
	const searching = useValue(() => !!store.state$.query.get())
	const hasSearched = useValue(() => !!store.state$.searchResults.get().query)
	return (
		<View style={styles.container}>
			{/* Opacity preserves the reading list's native text nodes and measurements. */}
			<View
				style={[StyleSheet.absoluteFill, searching && styles.hidden]}
				pointerEvents={searching ? 'none' : 'auto'}
				accessibilityElementsHidden={searching}
				importantForAccessibility={searching ? 'no-hide-descendants' : 'auto'}
			>
				<ReadingSubtitles
					store={store}
					active={active}
				/>
			</View>
			{hasSearched && (
				<View
					style={[StyleSheet.absoluteFill, !searching && styles.hidden]}
					pointerEvents={searching ? 'auto' : 'none'}
					accessibilityElementsHidden={!searching}
					importantForAccessibility={searching ? 'auto' : 'no-hide-descendants'}
				>
					<SearchSubtitles store={store} />
				</View>
			)}
		</View>
	)
}

export function SubtitleLocateButton({
	store,
}: {
	store: SubtitleReaderStore
}) {
	const visible = useValue(() => {
		if (store.state$.following.get()) return false
		const paragraph =
			store.content.paragraphs[store.state$.currentParagraphIndex.get()]
		const ids = store.state$.query.get()
			? store.state$.visibleSearchParagraphIds.get()
			: store.state$.visibleParagraphIds.get()
		return !!paragraph && !ids.includes(paragraph.id)
	})
	if (!visible) return null
	return (
		<View style={styles.locateButton}>
			<IconButton
				icon='crosshairs-gps'
				mode='contained'
				size={24}
				onPress={() => {
					Keyboard.dismiss()
					store.resumeFollowing()
				}}
				accessibilityLabel='定位到正在播放的字幕'
				testID='subtitle-scroll-to-current'
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	hidden: { opacity: 0 },
	content: { paddingTop: 60, paddingBottom: 80 },
	empty: { padding: 24, alignItems: 'center' },
	locateButton: { position: 'absolute', right: 16, bottom: 16 },
})
