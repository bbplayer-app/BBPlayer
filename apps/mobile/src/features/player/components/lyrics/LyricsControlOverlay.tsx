import { Icon as ExpoIcon } from '@expo/ui'
import { MenuView } from '@expo/ui/community/menu'
import MaskedView from '@react-native-masked-view/masked-view'
import { LinearGradient } from 'expo-linear-gradient'
import { memo } from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'
import { Touchable } from 'react-native-gesture-handler'
import { Icon, useTheme } from 'react-native-paper'

import { MainPlaybackControls } from '@/features/player/components/controls/PlayerControlContent'
import { PlayerSlider } from '@/features/player/components/main/PlayerSlider'
import useAppStore from '@/hooks/stores/useAppStore'

const ALPHABETICAL_ICON = ExpoIcon.select({
	ios: 'abc',
	android: import('@expo/material-symbols/abc.xml'),
})

const TRANSLATE_ICON = ExpoIcon.select({
	ios: 'translate',
	android: import('@expo/material-symbols/translate.xml'),
})

const EDIT_ICON = ExpoIcon.select({
	ios: 'pencil',
	android: import('@expo/material-symbols/edit.xml'),
})

const OFFSET_ICON = ExpoIcon.select({
	ios: 'arrow.up.arrow.down.circle',
	android: import('@expo/material-symbols/swap_vertical_circle.xml'),
})

const { height: windowHeight } = Dimensions.get('window')
// 面板高度 = 底部控件（~211px）+ 顶部 60px 渐隐条，刚好延伸到菜单按钮上方
export const LYRICS_CONTROLS_OVERLAY_HEIGHT = Math.min(windowHeight * 0.4, 280)

interface LyricsControlOverlayProps {
	offsetMenuVisible: boolean
	showTranslationToggle: boolean
	translationType: 'translation' | 'romaji'
	onToggleTranslation: () => void
	onEditLyrics: () => void
	onOpenOffsetMenu: () => void
}

export const LyricsControlOverlay = memo(function LyricsControlOverlay({
	offsetMenuVisible,
	showTranslationToggle,
	translationType,
	onToggleTranslation,
	onEditLyrics,
	onOpenOffsetMenu,
}: LyricsControlOverlayProps) {
	const { colors } = useTheme()
	const isFluidBackground = useAppStore(
		(state) => state.settings.playerBackgroundStyle === 'fluid',
	)

	return (
		<MaskedView
			style={styles.overlayContainer}
			maskElement={
				<View
					style={styles.maskElement}
					pointerEvents='none'
				>
					<LinearGradient
						style={styles.gradient}
						start={{ x: 0, y: 0 }}
						end={{ x: 0, y: 1 }}
						colors={['transparent', colors.background]}
						locations={[0, 1]}
					/>
					<View
						style={[styles.maskSolid, { backgroundColor: colors.background }]}
					/>
				</View>
			}
		>
			{/* 流体模式直接透出整页背景，歌词自身的遮罩负责避让控件。 */}
			{!isFluidBackground && (
				<View
					style={[
						StyleSheet.absoluteFill,
						{ backgroundColor: colors.background },
					]}
				/>
			)}
			<View style={styles.playerControls}>
				{/* 功能按钮，位于 slider 上方右侧 */}
				<View style={styles.actionMenuRow}>
					<MenuView
						actions={[
							...(showTranslationToggle
								? [
										{
											id: 'translation',
											title:
												translationType === 'translation'
													? '切换罗马音'
													: '切换翻译',
											image:
												translationType === 'translation'
													? ALPHABETICAL_ICON
													: TRANSLATE_ICON,
										},
									]
								: []),
							{ id: 'edit', title: '编辑歌词', image: EDIT_ICON },
							{ id: 'offset', title: '时间轴偏移', image: OFFSET_ICON },
						]}
						onPressAction={({ nativeEvent }) => {
							if (nativeEvent.event === 'translation') onToggleTranslation()
							if (nativeEvent.event === 'edit') onEditLyrics()
							if (nativeEvent.event === 'offset') onOpenOffsetMenu()
						}}
					>
						<Touchable
							androidRipple={{}}
							style={styles.actionMenuButton}
							disabled={offsetMenuVisible}
						>
							<Icon
								source='dots-vertical'
								size={20}
								color={
									offsetMenuVisible ? colors.onSurfaceDisabled : colors.primary
								}
							/>
						</Touchable>
					</MenuView>
				</View>
				<PlayerSlider />
				<View style={styles.playbackButtonsWrapper}>
					<MainPlaybackControls size='compact' />
				</View>
			</View>
		</MaskedView>
	)
})

const styles = StyleSheet.create({
	overlayContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		height: LYRICS_CONTROLS_OVERLAY_HEIGHT,
	},
	maskElement: {
		flex: 1,
	},
	maskSolid: {
		flex: 1,
	},
	gradient: {
		height: 60,
	},
	playerControls: {
		position: 'absolute',
		bottom: 50,
		left: 0,
		right: 0,
	},
	actionMenuRow: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		paddingHorizontal: 16,
		marginBottom: 4,
	},
	actionMenuButton: {
		borderRadius: 99999,
		padding: 10,
	},
	playbackButtonsWrapper: {
		marginTop: 8,
	},
})
