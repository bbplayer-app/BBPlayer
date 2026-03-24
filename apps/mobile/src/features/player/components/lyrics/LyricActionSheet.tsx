import { Menu } from 'react-native-paper'

import FunctionalMenu from '@/components/common/FunctionalMenu'

interface Props {
	visible: boolean
	anchor: { x: number; y: number } | null
	onDismiss: () => void
	showTranslationToggle: boolean
	translationType: 'translation' | 'romaji'
	onToggleTranslation: () => void
	onEditLyrics: () => void
	onOpenOffsetMenu: () => void
}

export function LyricActionSheet({
	visible,
	anchor,
	onDismiss,
	showTranslationToggle,
	translationType,
	onToggleTranslation,
	onEditLyrics,
	onOpenOffsetMenu,
}: Props) {
	if (!anchor) return null

	return (
		<FunctionalMenu
			visible={visible}
			onDismiss={onDismiss}
			anchor={anchor}
			statusBarHeight={0}
		>
			{showTranslationToggle && (
				<Menu.Item
					title={translationType === 'translation' ? '切换罗马音' : '切换翻译'}
					leadingIcon={
						translationType === 'translation'
							? 'alphabetical-variant'
							: 'translate'
					}
					onPress={() => {
						onToggleTranslation()
						onDismiss()
					}}
				/>
			)}
			<Menu.Item
				title='编辑歌词'
				leadingIcon='pencil'
				onPress={() => {
					onEditLyrics()
					onDismiss()
				}}
			/>
			<Menu.Item
				title='时间轴偏移'
				leadingIcon='swap-vertical-circle-outline'
				onPress={() => {
					onOpenOffsetMenu()
					onDismiss()
				}}
			/>
		</FunctionalMenu>
	)
}
