import * as Clipboard from 'expo-clipboard'
import type { ImageRef } from 'expo-image'
import { useRouter } from 'expo-router'
import { memo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import {
	Button,
	Divider,
	IconButton,
	Text,
	TouchableRipple,
} from 'react-native-paper'
import type { IconSource } from 'react-native-paper/lib/typescript/components/Icon'

import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import toast from '@/utils/toast'

interface PlaylistHeaderProps {
	cover?: string | undefined | ImageRef
	title: string | undefined
	subtitles: string | string[] | undefined // 通常格式： "Author • n Tracks"
	description: string | undefined
	onClickMainButton?: () => void
	mainButtonIcon: IconSource
	linkedPlaylistId?: number
	id: string | number
	mainButtonText?: string
	disableMainButton?: boolean
	secondaryButtonText?: string
	secondaryButtonIcon?: string
	onClickSecondaryButton?: () => void
	disableSecondaryButton?: boolean
}

/**
 * 可复用的播放列表头部组件。
 */
export const PlaylistHeader = memo(function PlaylistHeader({
	cover,
	title,
	subtitles,
	description,
	onClickMainButton,
	mainButtonIcon,
	mainButtonText,
	linkedPlaylistId,
	id,
	...props
}: PlaylistHeaderProps) {
	const router = useRouter()
	const [showFullTitle, setShowFullTitle] = useState(false)
	if (!title) return null

	return (
		<View style={styles.container}>
			{/* 收藏夹信息 */}
			<View style={styles.headerContainer}>
				<CoverWithPlaceHolder
					id={id}
					cover={cover}
					title={title}
					size={120}
				/>
				<View style={styles.headerTextContainer}>
					<TouchableRipple
						onPress={() => setShowFullTitle(!showFullTitle)}
						onLongPress={async () => {
							const result = await Clipboard.setStringAsync(title)
							if (!result) {
								toast.error('复制失败')
							} else {
								toast.success('已复制标题到剪贴板')
							}
						}}
					>
						<Text
							variant='titleLarge'
							style={styles.title}
							numberOfLines={showFullTitle ? undefined : 2}
						>
							{title}
						</Text>
					</TouchableRipple>
					<Text
						variant='bodyMedium'
						numberOfLines={Array.isArray(subtitles) ? subtitles.length : 1}
					>
						{Array.isArray(subtitles) ? subtitles.join('\n') : subtitles}
					</Text>
				</View>
			</View>

			{/* 操作按钮 */}
			<View style={styles.actionsContainer}>
				{onClickMainButton && (
					<Button
						mode='contained'
						icon={mainButtonIcon}
						onPress={() => onClickMainButton()}
						disabled={props.disableMainButton}
						testID='playlist-header-main-button'
					>
						{mainButtonText ?? (linkedPlaylistId ? '重新同步' : '同步到本地')}
					</Button>
				)}
				{props.secondaryButtonText && props.onClickSecondaryButton && (
					<Button
						mode='outlined'
						icon={props.secondaryButtonIcon}
						onPress={props.onClickSecondaryButton}
						style={{ marginLeft: 8 }}
						disabled={props.disableSecondaryButton}
					>
						{props.secondaryButtonText}
					</Button>
				)}
				{linkedPlaylistId && (
					<IconButton
						mode='contained'
						icon={'arrow-right'}
						size={20}
						onPress={() =>
							router.push({
								pathname: '/playlist/local/[id]',
								params: { id: linkedPlaylistId.toString() },
							})
						}
					/>
				)}
			</View>

			<Text
				variant='bodyMedium'
				style={[styles.description, !!description && styles.descriptionMargin]}
			>
				{description ?? ''}
			</Text>

			<Divider />
		</View>
	)
})

const styles = StyleSheet.create({
	container: {
		position: 'relative',
		flexDirection: 'column',
	},
	headerContainer: {
		flexDirection: 'row',
		padding: 16,
		alignItems: 'center',
	},
	headerTextContainer: {
		marginLeft: 16,
		flex: 1,
		justifyContent: 'center',
	},
	title: {
		fontWeight: 'bold',
	},
	actionsContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'flex-start',
		marginHorizontal: 16,
	},
	description: {
		margin: 0,
	},
	descriptionMargin: {
		margin: 16,
	},
})
