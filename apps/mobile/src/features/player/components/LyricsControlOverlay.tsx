import { Icon as ExpoIcon } from '@expo/ui'
import MaskedView from '@react-native-masked-view/masked-view'
import { LinearGradient } from 'expo-linear-gradient'
import { memo } from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'
import { Touchable } from 'react-native-gesture-handler'
import { Icon, useTheme } from 'react-native-paper'

import FunctionalMenu from '@/components/common/FunctionalMenu'
import { MainPlaybackControls } from '@/features/player/components/PlayerControls'
import { PlayerSlider } from '@/features/player/components/PlayerSlider'

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
const OVERLAY_HEIGHT = Math.min(windowHeight * 0.4, 280)

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
			{/* 面板背景：底部不透明，顶部渐隐 */}
			<View
				style={[
					StyleSheet.absoluteFill,
					{ backgroundColor: colors.background },
				]}
			/>
			<View style={styles.playerControls}>
				{/* 功能按钮，位于 slider 上方右侧 */}
				<View style={styles.actionMenuRow}>
					<FunctionalMenu
						anchor={
							<Touchable
								androidRipple={{}}
								style={styles.actionMenuButton}
								disabled={offsetMenuVisible}
							>
								<Icon
									source='dots-vertical'
									size={20}
									color={
										offsetMenuVisible
											? colors.onSurfaceDisabled
											: colors.primary
									}
								/>
							</Touchable>
						}
					>
						{showTranslationToggle && (
							<FunctionalMenu.Item
								title={
									translationType === 'translation' ? '切换罗马音' : '切换翻译'
								}
								leadingIcon={
									translationType === 'translation'
										? ALPHABETICAL_ICON
										: TRANSLATE_ICON
								}
								onPress={onToggleTranslation}
							/>
						)}
						<FunctionalMenu.Item
							title='编辑歌词'
							leadingIcon={EDIT_ICON}
							onPress={onEditLyrics}
						/>
						<FunctionalMenu.Item
							title='时间轴偏移'
							leadingIcon={OFFSET_ICON}
							onPress={onOpenOffsetMenu}
						/>
					</FunctionalMenu>
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
		height: OVERLAY_HEIGHT,
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
