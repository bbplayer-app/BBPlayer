import { useEffect, useRef, type ComponentRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { Icon, Searchbar, TouchableRipple, useTheme } from 'react-native-paper'
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'

import IconButton from '@/components/common/IconButton'
import { VariantPlainText } from '@/components/common/VariantPlainText'

export function SubtitleSearchToolbar({
	label,
	canSelect,
	canSearch,
	visible,
	search,
	resultIndex,
	resultCount,
	onSelect,
	onOpen,
	onClose,
	onChangeSearch,
	onNavigate,
}: {
	label: string
	canSelect: boolean
	canSearch: boolean
	visible: boolean
	search: string
	resultIndex: number
	resultCount: number
	onSelect: () => void
	onOpen: () => void
	onClose: () => void
	onChangeSearch: (value: string) => void
	onNavigate: (direction: number) => void
}) {
	const { colors } = useTheme()
	const input = useRef<ComponentRef<typeof Searchbar>>(null)
	const progress = useSharedValue(0)
	useEffect(() => {
		progress.set(
			withTiming(visible ? 1 : 0, {
				duration: 280,
				easing: Easing.bezier(0.2, 0, 0, 1),
			}),
		)
		if (!visible) {
			input.current?.blur()
			return
		}
		const timer = setTimeout(() => input.current?.focus(), 280)
		return () => clearTimeout(timer)
	}, [visible, progress])
	const languageStyle = useAnimatedStyle(() => ({
		flexGrow: 1 - progress.value,
	}))
	const labelStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }))
	const searchStyle = useAnimatedStyle(() => ({ flexGrow: progress.value }))
	const fieldStyle = useAnimatedStyle(() => ({ opacity: progress.value }))
	const hasQuery = !!search.trim()
	return (
		<View style={styles.toolbar}>
			<View style={styles.row}>
				<Animated.View style={[styles.slot, languageStyle]}>
					<TouchableRipple
						onPress={onSelect}
						disabled={!canSelect}
						accessibilityRole='button'
						accessibilityLabel={`选择字幕：${label}`}
						testID='subtitle-language'
						style={[
							styles.language,
							{ backgroundColor: colors.surfaceVariant },
						]}
					>
						<View style={styles.languageContent}>
							<Icon
								source='subtitles-outline'
								size={24}
								color={
									canSelect ? colors.onSurfaceVariant : colors.onSurfaceDisabled
								}
							/>
							<Animated.View style={[styles.label, labelStyle]}>
								<VariantPlainText
									numberOfLines={1}
									variant='labelLarge'
									style={{ color: colors.onSurfaceVariant }}
								>
									{label}
								</VariantPlainText>
							</Animated.View>
						</View>
					</TouchableRipple>
				</Animated.View>
				<Animated.View style={[styles.slot, searchStyle]}>
					<Animated.View
						style={[StyleSheet.absoluteFill, fieldStyle]}
						pointerEvents={visible ? 'auto' : 'none'}
						accessibilityElementsHidden={!visible}
						importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
					>
						<Searchbar
							ref={input}
							placeholder='搜索本期字幕'
							accessibilityLabel='搜索本期字幕'
							testID='subtitle-search-input'
							value={search}
							onChangeText={onChangeSearch}
							icon='magnify'
							onIconPress={() => input.current?.focus()}
							right={() => (
								<IconButton
									icon='close'
									accessibilityLabel='关闭字幕搜索'
									onPress={onClose}
									style={styles.icon}
								/>
							)}
							style={styles.searchbar}
							inputStyle={styles.input}
							onSubmitEditing={() => onNavigate(1)}
						/>
					</Animated.View>
					{!visible && (
						<IconButton
							icon='magnify'
							accessibilityLabel='搜索字幕'
							testID='subtitle-search-open'
							disabled={!canSearch}
							onPress={onOpen}
							style={styles.open}
						/>
					)}
				</Animated.View>
			</View>
			{visible && hasQuery && (
				<View style={styles.details}>
					<VariantPlainText
						variant='bodySmall'
						accessibilityLiveRegion='polite'
						style={{ color: colors.onSurfaceVariant, flex: 1 }}
					>
						{resultCount
							? `${resultIndex + 1} / ${resultCount} 段匹配`
							: '未找到匹配内容'}
					</VariantPlainText>
					<View style={styles.navigation}>
						<IconButton
							icon='chevron-up'
							accessibilityLabel='上一条搜索结果'
							testID='subtitle-search-previous'
							disabled={!hasQuery || !resultCount || resultIndex === 0}
							onPress={() => onNavigate(-1)}
							style={styles.icon}
						/>
						<IconButton
							icon='chevron-down'
							accessibilityLabel='下一条搜索结果'
							testID='subtitle-search-next'
							disabled={!hasQuery || resultIndex >= resultCount - 1}
							onPress={() => onNavigate(1)}
							style={styles.icon}
						/>
					</View>
				</View>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	toolbar: { paddingHorizontal: 24, paddingBottom: 4, gap: 4 },
	row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	slot: {
		flexBasis: 48,
		flexShrink: 0,
		minWidth: 48,
		height: 48,
		overflow: 'hidden',
		borderRadius: 24,
	},
	language: { flex: 1, borderRadius: 24 },
	languageContent: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 12,
		gap: 12,
	},
	label: { flex: 1 },
	searchbar: { height: 48, borderRadius: 24, elevation: 0 },
	input: { minHeight: 48, paddingLeft: 0, fontSize: 14 },
	open: { margin: 0, width: 48, height: 48 },
	icon: { margin: 0, width: 44, height: 44 },
	details: {
		minHeight: 44,
		flexDirection: 'row',
		alignItems: 'center',
		paddingLeft: 12,
	},
	navigation: { flexDirection: 'row', alignItems: 'center' },
})
