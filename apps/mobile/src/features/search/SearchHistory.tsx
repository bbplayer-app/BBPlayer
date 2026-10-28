import { Keyboard, ScrollView, StyleSheet, View } from 'react-native'
import { Chip, IconButton, Text, useTheme } from 'react-native-paper'

export interface SearchHistoryItem {
	id: string
	text: string
	timestamp: number
}

interface SearchHistoryProps {
	searchHistory?: SearchHistoryItem[]
	onHistoryPress: (query: string) => void
	onClearHistory: () => void
	onRemoveHistoryItem: (id: string) => void
	onDismiss: () => void
	panelVisible: boolean
}

export default function SearchHistory({
	searchHistory,
	onHistoryPress,
	onClearHistory,
	onRemoveHistoryItem,
	onDismiss,
	panelVisible,
}: SearchHistoryProps) {
	const { colors } = useTheme()
	return (
		<ScrollView
			style={styles.historySection}
			pointerEvents={panelVisible ? 'none' : 'auto'}
			onTouchStart={onDismiss}
			keyboardShouldPersistTaps='handled'
		>
			<View style={styles.historyHeader}>
				<Text
					variant='titleMedium'
					style={styles.historyTitle}
				>
					最近搜索
				</Text>
				{searchHistory && searchHistory.length > 0 && onClearHistory && (
					<IconButton
						icon='trash-can-outline'
						accessibilityLabel='清空搜索历史'
						size={20}
						onPress={onClearHistory}
					/>
				)}
			</View>
			<View style={styles.historyChipsContainer}>
				{searchHistory && searchHistory.length > 0 ? (
					searchHistory.map((item) => (
						<Chip
							key={item.id}
							onPress={() => {
								Keyboard.dismiss()
								onHistoryPress(item.text)
							}}
							onLongPress={() => onRemoveHistoryItem?.(item.id)}
							style={styles.chip}
							mode='outlined'
						>
							{item.text}
						</Chip>
					))
				) : (
					<Text
						style={[styles.noHistoryText, { color: colors.onSurfaceVariant }]}
					>
						暂无搜索历史
					</Text>
				)}
			</View>
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	historySection: {
		flex: 1,
		paddingTop: 8,
	},
	historyHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 8,
	},
	historyTitle: {
		fontWeight: 'bold',
	},
	historyChipsContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
	},
	chip: {
		marginRight: 8,
		marginBottom: 8,
	},
	noHistoryText: { paddingVertical: 16, textAlign: 'center' },
})
