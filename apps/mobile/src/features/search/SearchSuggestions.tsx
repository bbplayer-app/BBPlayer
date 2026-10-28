import { useCallback, useEffect, useMemo } from 'react'
import {
	FlatList,
	Keyboard,
	StyleSheet,
	useWindowDimensions,
	View,
} from 'react-native'
import { Touchable } from 'react-native-gesture-handler'
import { Divider, Text, useTheme } from 'react-native-paper'
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import { useSearchSuggestions } from '@/hooks/queries/bilibili/search'
import type { BilibiliSearchSuggestionItem } from '@/types/apis/bilibili'

export interface SearchSuggestionsProps {
	query: string
	visible: boolean
	availableHeight: number
	onSuggestionPress: (q: string) => void
}

/**
 * 将带有 <em>...</em> 的字符串解析成若干段：
 * - 普通段 { text, emphasized: false }
 * - 强调段 { text, emphasized: true }
 */
function parseEmTags(text: string | undefined) {
	const s = text ?? ''
	const regex = /<em[^>]*>(.*?)<\/em>/gi
	const segments: { text: string; emphasized: boolean }[] = []
	let lastIndex = 0
	let match: RegExpExecArray | null
	while ((match = regex.exec(s)) !== null) {
		if (match.index > lastIndex) {
			segments.push({
				text: s.slice(lastIndex, match.index),
				emphasized: false,
			})
		}
		segments.push({ text: match[1], emphasized: true })
		lastIndex = regex.lastIndex
	}
	if (lastIndex < s.length) {
		segments.push({ text: s.slice(lastIndex), emphasized: false })
	}
	if (segments.length === 0) return [{ text: s, emphasized: false }]
	return segments
}

export default function SearchSuggestions({
	query,
	visible,
	availableHeight,
	onSuggestionPress,
}: SearchSuggestionsProps) {
	const { colors } = useTheme()
	const { height: windowHeight } = useWindowDimensions()
	const progress = useSharedValue(0)
	useEffect(() => {
		progress.set(
			withTiming(visible ? 1 : 0, {
				duration: 200,
				easing: Easing.out(Easing.quad),
			}),
		)
	}, [progress, visible])
	const panelHeight = Math.max(0, Math.min(availableHeight, windowHeight * 0.4))
	const panelStyle = useAnimatedStyle(() => ({
		height: panelHeight * progress.get(),
		opacity: progress.get(),
		transform: [{ translateY: -8 * (1 - progress.get()) }],
	}))
	const { data: items, isFetching } = useSearchSuggestions(query)
	const parsedItems = useMemo(
		() =>
			items?.map((item) => ({ ...item, segments: parseEmTags(item.name) })) ??
			[],
		[items],
	)
	const keyExtractor = useCallback(
		(item: BilibiliSearchSuggestionItem) => item.name,
		[],
	)

	const renderItem = useCallback(
		({
			item,
			index,
		}: {
			item: BilibiliSearchSuggestionItem & {
				segments?: { text: string; emphasized: boolean }[]
			}
			index: number
		}) => {
			return (
				<Touchable
					androidRipple={{}}
					onPress={() => {
						Keyboard.dismiss()
						onSuggestionPress(item.value)
					}}
					style={[styles.itemButton, { backgroundColor: colors.surface }]}
					testID={`search-suggestion-${index}`}
				>
					<Text
						numberOfLines={1}
						style={{ color: colors.onSurface }}
					>
						{(item.segments ?? [{ text: item.value, emphasized: false }]).map(
							(seg, i) => (
								<Text
									// oxlint-disable-next-line react/no-array-index-key
									key={i}
									style={[
										styles.itemText,
										seg.emphasized && { color: colors.primary },
									]}
								>
									{seg.text}
								</Text>
							),
						)}
					</Text>
				</Touchable>
			)
		},
		[colors.onSurface, colors.primary, colors.surface, onSuggestionPress],
	)

	return (
		<Animated.View
			pointerEvents={visible ? 'auto' : 'none'}
			onStartShouldSetResponder={() => true}
			style={[
				styles.container,
				{ backgroundColor: colors.surface },
				panelStyle,
			]}
		>
			{isFetching && parsedItems.length === 0 ? (
				<View style={styles.loading}>
					<ActivityIndicator />
				</View>
			) : (
				<FlatList
					keyboardDismissMode='on-drag'
					ListEmptyComponent={
						<Text
							style={[styles.noHistoryText, { color: colors.onSurfaceVariant }]}
						>
							没有搜索建议，可直接提交搜索
						</Text>
					}
					data={parsedItems ?? []}
					keyExtractor={keyExtractor}
					keyboardShouldPersistTaps='handled'
					renderItem={renderItem}
					ItemSeparatorComponent={() => <Divider />}
				/>
			)}
		</Animated.View>
	)
}

const styles = StyleSheet.create({
	loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
	container: {
		borderRadius: 12,
		overflow: 'hidden',
		shadowColor: '#000',
		shadowOpacity: 0.08,
		shadowRadius: 10,
		elevation: 6,
	},
	itemButton: {
		paddingVertical: 12,
		paddingHorizontal: 14,
	},
	itemText: {
		fontWeight: 'bold',
	},
	noHistoryText: {
		paddingVertical: 16,
		textAlign: 'center',
	},
})
