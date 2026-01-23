import { LyricsShareCard } from '@/features/player/components/sharing/LyricsShareCard'
import { useCurrentTrack } from '@/hooks/player/useCurrentTrack'
import { useSmartFetchLyrics } from '@/hooks/queries/lyrics'
import { useModalStore } from '@/hooks/stores/useModalStore'
import type { LyricLine } from '@/types/player/lyrics'
import toast from '@/utils/toast'
import ImageThemeColors from '@roitium/expo-image-theme-colors'
import { FlashList } from '@shopify/flash-list'
import { Image, useImage } from 'expo-image'
import * as MediaLibrary from 'expo-media-library'
import * as Sharing from 'expo-sharing'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import {
	ActivityIndicator,
	Button,
	Checkbox,
	Dialog,
	Text,
	TouchableRipple,
	useTheme,
} from 'react-native-paper'
import type ViewShot from 'react-native-view-shot'
import { captureRef } from 'react-native-view-shot'

const LyricItem = memo(function LyricItem({
	item,
	index,
	isSelected,
	onToggle,
	primaryColor,
	onSurfaceColor,
	onSurfaceVariantColor,
}: {
	item: LyricLine
	index: number
	isSelected: boolean
	onToggle: (index: number) => void
	primaryColor: string
	onSurfaceColor: string
	onSurfaceVariantColor: string
}) {
	return (
		<TouchableRipple onPress={() => onToggle(index)}>
			<View style={styles.itemContainer}>
				<View style={{ flex: 1 }}>
					<Text
						variant='bodyLarge'
						style={{
							fontWeight: isSelected ? 'bold' : 'normal',
							color: isSelected ? primaryColor : onSurfaceColor,
						}}
					>
						{item.text}
					</Text>
					{item.translation && (
						<Text
							variant='bodySmall'
							style={{
								color: isSelected ? primaryColor : onSurfaceVariantColor,
							}}
						>
							{item.translation}
						</Text>
					)}
				</View>
				<Checkbox
					status={isSelected ? 'checked' : 'unchecked'}
					onPress={() => onToggle(index)}
				/>
			</View>
		</TouchableRipple>
	)
})

const LyricsSelectionModal = () => {
	const theme = useTheme()
	const currentTrack = useCurrentTrack()
	const close = useModalStore((state) => state.close)

	const {
		data: lyricsData,
		isPending,
		isError,
		error,
	} = useSmartFetchLyrics(true, currentTrack ?? undefined)
	const lyrics = lyricsData?.lyrics

	const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
		() => new Set(),
	)
	const [permissionResponse, requestPermission] = MediaLibrary.usePermissions()
	const [isSharing, setIsSharing] = useState(false)
	const [showPreview, setShowPreview] = useState(false)
	const [previewUri, setPreviewUri] = useState<string | null>(null)
	const [isGenerating, setIsGenerating] = useState(false)
	const [cardColor, setCardColor] = useState(theme.colors.elevation.level3)
	const imageRef = useImage(
		{ uri: currentTrack?.coverUrl ?? undefined },
		{
			onError: () => void 0,
		},
	)

	const viewShotRef = useRef<ViewShot>(null)

	useEffect(() => {
		if (imageRef) {
			ImageThemeColors.extractThemeColorAsync(imageRef)
				.then((palette) => {
					const bgColor = theme.dark
						? (palette.darkMuted?.hex ?? palette.muted?.hex)
						: (palette.lightMuted?.hex ?? palette.muted?.hex)

					if (bgColor) {
						setCardColor(bgColor)
					} else {
						setCardColor(theme.colors.elevation.level3)
					}
				})
				.catch(() => {
					setCardColor(theme.colors.elevation.level3)
				})
		} else {
			setCardColor(theme.colors.elevation.level3)
		}
	}, [imageRef, theme.colors.elevation.level3, theme.dark])

	const toggleSelection = useCallback((index: number) => {
		setSelectedIndices((prev) => {
			const newSelected = new Set(prev)
			if (newSelected.has(index)) {
				newSelected.delete(index)
			} else {
				if (newSelected.size >= 5) {
					toast.error('最多选择 5 句歌词')
					return prev
				}
				newSelected.add(index)
			}
			return newSelected
		})
		// 选择变化后清除旧预览
		setPreviewUri(null)
	}, [])

	const keyExtractor = useCallback(
		(item: LyricLine, index: number) => `${index}-${item.timestamp}`,
		[],
	)

	const sanitizeFileName = (name: string) => name.replace(/[/\\?%*:|"<>]/g, '-')

	const generatePreview = async () => {
		if (!viewShotRef.current) {
			toast.error('无法生成预览')
			return
		}
		setIsGenerating(true)
		const fileName = `bbplayer-share-lyrics-${sanitizeFileName(currentTrack?.uniqueKey ?? '')}-${Date.now()}`
		try {
			const uri = await captureRef(viewShotRef, {
				format: 'png',
				quality: 1,
				result: 'tmpfile',
				fileName,
			})
			setPreviewUri(uri)
			setShowPreview(true)
			setIsGenerating(false)
		} catch (e) {
			console.error(e)
			toast.error('生成预览失败')
			setIsGenerating(false)
		}
	}

	const handleShare = async (action: 'save' | 'share') => {
		if (selectedIndices.size === 0) {
			toast.error('请先选择歌词')
			return
		}

		setIsSharing(true)

		let uri = previewUri
		const needsCapture = !uri && viewShotRef.current !== null
		if (needsCapture) {
			try {
				const fileName = `bbplayer-share-lyrics-${Date.now()}`
				uri = await captureRef(viewShotRef, {
					format: 'png',
					quality: 1,
					result: 'tmpfile',
					fileName,
				})
			} catch (e) {
				console.error(e)
				toast.error('生成图片失败')
				setIsSharing(false)
				return
			}
		}

		if (!uri) {
			toast.error('生成图片失败')
			setIsSharing(false)
			return
		}

		const permissionStatus = permissionResponse?.status
		if (
			action === 'save' &&
			permissionStatus !== MediaLibrary.PermissionStatus.GRANTED
		) {
			const { status } = await requestPermission()
			if (status !== MediaLibrary.PermissionStatus.GRANTED) {
				toast.error('无法保存图片', { description: '请允许访问相册' })
				setIsSharing(false)
				return
			}
		}

		try {
			if (action === 'save') {
				await MediaLibrary.saveToLibraryAsync(uri)
				toast.success('已保存到相册')
			} else {
				const sharingAvailable = await Sharing.isAvailableAsync()
				if (sharingAvailable) {
					await Sharing.shareAsync(uri)
				} else {
					toast.error('分享不可用')
					setIsSharing(false)
					return
				}
			}
			setIsSharing(false)
			close('LyricsSelection')
		} catch (e) {
			console.error(e)
			toast.error('操作失败')
			setIsSharing(false)
		}
	}

	const renderItem = useCallback(
		({ item, index }: { item: LyricLine; index: number }) => (
			<LyricItem
				item={item}
				index={index}
				isSelected={selectedIndices.has(index)}
				onToggle={toggleSelection}
				primaryColor={theme.colors.primary}
				onSurfaceColor={theme.colors.onSurface}
				onSurfaceVariantColor={theme.colors.onSurfaceVariant}
			/>
		),
		[
			selectedIndices,
			theme.colors.onSurface,
			theme.colors.onSurfaceVariant,
			theme.colors.primary,
			toggleSelection,
		],
	)

	if (!currentTrack) {
		return (
			<>
				<Dialog.Title>选择歌词分享</Dialog.Title>
				<Dialog.Content style={styles.errorContainer}>
					<Text
						variant='bodyMedium'
						style={styles.errorText}
					>
						当前没有正在播放的歌曲
					</Text>
				</Dialog.Content>
				<Dialog.Actions>
					<Button onPress={() => close('LyricsSelection')}>关闭</Button>
				</Dialog.Actions>
			</>
		)
	}

	if (isPending) {
		return (
			<>
				<Dialog.Title>选择歌词分享</Dialog.Title>
				<Dialog.Content style={styles.loadingContainer}>
					<ActivityIndicator size='large' />
					<Text
						variant='bodyMedium'
						style={styles.loadingText}
					>
						正在加载歌词...
					</Text>
				</Dialog.Content>
				<Dialog.Actions>
					<Button onPress={() => close('LyricsSelection')}>关闭</Button>
				</Dialog.Actions>
			</>
		)
	}

	if (isError) {
		return (
			<>
				<Dialog.Title>选择歌词分享</Dialog.Title>
				<Dialog.Content style={styles.errorContainer}>
					<Text
						variant='bodyMedium'
						style={styles.errorText}
					>
						歌词加载失败：{error?.message ?? '未知错误'}
					</Text>
				</Dialog.Content>
				<Dialog.Actions>
					<Button onPress={() => close('LyricsSelection')}>关闭</Button>
				</Dialog.Actions>
			</>
		)
	}

	if (!lyrics || lyrics.length === 0) {
		return (
			<>
				<Dialog.Title>选择歌词分享</Dialog.Title>
				<Dialog.Content style={styles.errorContainer}>
					<Text
						variant='bodyMedium'
						style={styles.errorText}
					>
						暂无歌词
					</Text>
				</Dialog.Content>
				<Dialog.Actions>
					<Button onPress={() => close('LyricsSelection')}>关闭</Button>
				</Dialog.Actions>
			</>
		)
	}

	// 预览模式：显示生成的预览图
	if (showPreview && previewUri) {
		return (
			<>
				<Dialog.Title>预览分享卡片</Dialog.Title>
				<Dialog.Content style={styles.previewContentArea}>
					<Image
						source={{ uri: previewUri }}
						style={styles.previewImage}
						contentFit='contain'
					/>
				</Dialog.Content>
				<Dialog.Actions style={styles.actions}>
					<Button
						mode='text'
						onPress={() => setShowPreview(false)}
						icon='arrow-left'
						compact
					>
						返回选择
					</Button>
					<View style={{ flex: 1 }} />
					<Button
						mode='outlined'
						onPress={() => handleShare('save')}
						loading={isSharing}
						disabled={isSharing}
						icon='download'
					>
						保存
					</Button>
					<Button
						mode='contained'
						onPress={() => handleShare('share')}
						loading={isSharing}
						disabled={isSharing}
						icon='share-variant'
					>
						分享
					</Button>
				</Dialog.Actions>
			</>
		)
	}

	return (
		<>
			<Dialog.Title>选择歌词分享 ({selectedIndices.size}/5)</Dialog.Title>
			<Dialog.ScrollArea style={styles.scrollArea}>
				<FlashList
					data={lyrics}
					keyExtractor={keyExtractor}
					renderItem={renderItem}
					showsVerticalScrollIndicator={false}
				/>
			</Dialog.ScrollArea>
			<Dialog.Actions style={styles.actions}>
				<Button
					mode='text'
					onPress={generatePreview}
					icon='eye'
					compact
					disabled={selectedIndices.size === 0 || isGenerating}
					loading={isGenerating}
				>
					预览
				</Button>
				<View style={{ flex: 1 }} />
				<Button
					mode='outlined'
					onPress={() => handleShare('save')}
					loading={isSharing}
					disabled={isSharing || selectedIndices.size === 0}
					icon='download'
				>
					保存
				</Button>
				<Button
					mode='contained'
					onPress={() => handleShare('share')}
					loading={isSharing}
					disabled={isSharing || selectedIndices.size === 0}
					icon='share-variant'
				>
					分享
				</Button>
				<Button onPress={() => close('LyricsSelection')}>关闭</Button>
			</Dialog.Actions>

			{/* Hidden Capture View - 始终渲染以确保 viewShotRef 可用 */}
			<View
				style={styles.hiddenCapture}
				pointerEvents='none'
			>
				{currentTrack && lyrics && (
					<LyricsShareCard
						track={currentTrack}
						selectedLyrics={lyrics.filter((_, i) => selectedIndices.has(i))}
						viewShotRef={viewShotRef}
						backgroundColor={cardColor}
					/>
				)}
			</View>
		</>
	)
}

const styles = StyleSheet.create({
	scrollArea: {
		height: 350,
	},
	itemContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingVertical: 10,
	},
	actions: {
		flexWrap: 'wrap',
		gap: 4,
	},
	previewContentArea: {
		paddingHorizontal: 16,
		minHeight: 200,
	},
	previewImage: {
		width: '100%',
		aspectRatio: 0.8,
		borderRadius: 12,
	},
	loadingContainer: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 40,
	},
	loadingText: {
		marginTop: 16,
		opacity: 0.7,
	},
	errorContainer: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 40,
	},
	errorText: {
		opacity: 0.7,
		textAlign: 'center',
	},
	hiddenCapture: {
		position: 'absolute',
		top: 99999,
		left: 0,
		opacity: 0,
	},
})

export default LyricsSelectionModal
