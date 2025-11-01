import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import toast from '@/utils/toast'
import * as Clipboard from 'expo-clipboard'
import { useRouter } from 'expo-router'
import { memo, useState } from 'react'
import { View } from 'react-native'
import {
	Button,
	Divider,
	IconButton,
	Text,
	TouchableRipple,
} from 'react-native-paper'
import type { IconSource } from 'react-native-paper/lib/typescript/components/Icon'

interface PlaylistHeaderProps {
	coverUri: string | undefined
	title: string | undefined
	subtitles: string | string[] | undefined // 通常格式： "Author • n Tracks"
	description: string | undefined
	onClickMainButton?: () => void
	mainButtonIcon: IconSource
	linkedPlaylistId?: number
	id: string | number
}

/**
 * 可复用的播放列表头部组件。
 */
export const PlaylistHeader = memo(function PlaylistHeader({
	coverUri,
	title,
	subtitles,
	description,
	onClickMainButton,
	mainButtonIcon,
	linkedPlaylistId,
	id,
}: PlaylistHeaderProps) {
	const router = useRouter()
	const [showFullTitle, setShowFullTitle] = useState(false)
	if (!title) return null

	return (
		<View style={{ position: 'relative', flexDirection: 'column' }}>
			{/* 收藏夹信息 */}
			<View style={{ flexDirection: 'row', padding: 16, alignItems: 'center' }}>
				<CoverWithPlaceHolder
					id={id}
					coverUrl={coverUri}
					title={title}
					size={120}
					borderRadius={8}
				/>
				<View style={{ marginLeft: 16, flex: 1, justifyContent: 'center' }}>
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
							style={{ fontWeight: 'bold' }}
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
			<View
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					justifyContent: 'flex-start',
					marginHorizontal: 16,
				}}
			>
				{onClickMainButton && (
					<Button
						mode='contained'
						icon={mainButtonIcon}
						onPress={() => onClickMainButton()}
					>
						{linkedPlaylistId ? '重新同步' : '同步到本地'}
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
				style={{ margin: description ? 16 : 0 }}
			>
				{description ?? ''}
			</Text>

			<Divider />
		</View>
	)
})
