import ImageThemeColors from '@bbplayer/image-theme-colors'
import { Image, useImage } from 'expo-image'
import * as MediaLibrary from 'expo-media-library'
import * as Sharing from 'expo-sharing'
import { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { ActivityIndicator, Dialog, Text, useTheme } from 'react-native-paper'
import type ViewShot from 'react-native-view-shot'
import { captureRef } from 'react-native-view-shot'

import Button from '@/components/common/Button'
import { SongShareCard } from '@/features/player/components/sharing/SongShareCard'
import { useCurrentTrack } from '@/hooks/player/useCurrentTrack'
import { useGetMultiPageList } from '@/hooks/queries/bilibili/video'
import { useModalStore } from '@/hooks/stores/useModalStore'
import toast from '@/utils/toast'

const sanitizeFileName = (name: string) => name.replace(/[/\\?%*:|"<>]/g, '-')

async function performShare(
	action: 'save' | 'share',
	previewUri: string | null,
	viewShotRef: { current: ViewShot | null },
	uniqueKey: string,
	permissionResponse: MediaLibrary.PermissionResponse | null,
	requestPermission: () => Promise<MediaLibrary.PermissionResponse>,
	closeModal: () => void,
	setIsSharing: (v: boolean) => void,
	isSharingRef: { current: boolean },
) {
	isSharingRef.current = true
	setIsSharing(true)

	try {
		let uri = previewUri
		const needsCapture = !uri && viewShotRef.current !== null
		if (needsCapture) {
			const fileName = `bbplayer-share-song-${sanitizeFileName(uniqueKey)}-${Date.now()}`
			try {
				uri = await captureRef(viewShotRef, {
					format: 'png',
					quality: 1,
					result: 'tmpfile',
					fileName,
				})
			} catch {
				toast.error('生成图片失败')
				return
			}
		}

		if (!uri) {
			toast.error('生成图片失败')
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
				return
			}
		}

		if (action === 'save') {
			await MediaLibrary.saveToLibraryAsync(uri)
			toast.success('已保存到相册')
		} else {
			const sharingAvailable = await Sharing.isAvailableAsync()
			if (sharingAvailable) {
				await Sharing.shareAsync(uri)
			} else {
				toast.error('分享不可用')
				return
			}
		}
		closeModal()
	} catch {
		toast.error('操作失败')
	} finally {
		setIsSharing(false)
		isSharingRef.current = false
	}
}

const SongShareModal = () => {
	const currentTrack = useCurrentTrack()
	const close = useModalStore((state) => state.close)

	const theme = useTheme()
	const [permissionResponse, requestPermission] = MediaLibrary.usePermissions()
	const [isSharing, setIsSharing] = useState(false)
	const [previewUri, setPreviewUri] = useState<string | null>(null)
	const [isGenerating, setIsGenerating] = useState(true)
	const [cardColor, setCardColor] = useState(theme.colors.elevation.level3)

	const isBilibili = currentTrack?.source === 'bilibili'
	const bvid = isBilibili ? currentTrack.bilibiliMetadata.bvid : undefined
	const cid = isBilibili ? currentTrack.bilibiliMetadata.cid : undefined

	// 只有在有 cid 的情况下才请求分 P 列表，否则没意义
	const { data: pageList, isPending: isPageListQueryPending } =
		useGetMultiPageList(cid ? bvid : undefined)

	const isPageListPending = !!cid && isPageListQueryPending

	const imageRef = useImage(
		{ uri: currentTrack?.coverUrl ?? '' },
		{
			onError: () => void 0,
		},
	)

	const viewShotRef = useRef<ViewShot>(null)

	useEffect(() => {
		if (imageRef) {
			ImageThemeColors.extractThemeColorAsync(imageRef)
				.then((palette) => {
					if (!palette) return

					const bgColor = theme.dark
						? (palette.darkMuted?.hex ?? palette.muted?.hex)
						: (palette.lightMuted?.hex ?? palette.muted?.hex)

					if (bgColor) {
						setCardColor(bgColor)
					}
				})
				.catch(() => undefined)
		}
	}, [imageRef, theme.dark])

	const generatePreview = useCallback(async () => {
		let retryCount = 0
		while (!viewShotRef.current && retryCount < 5) {
			// oxlint-disable-next-line no-await-in-loop
			await new Promise((resolve) => setTimeout(resolve, 200))
			retryCount++
		}

		if (!viewShotRef.current) {
			setIsGenerating(false)
			return
		}

		// 等待图片加载完成
		if (!imageRef && currentTrack?.coverUrl) {
			// 如果图片还没好，就继续等待，不设置 false
			return
		}
		// 等待分 P 列表加载完成
		if (isPageListPending) {
			return
		}

		setIsGenerating(true)
		try {
			const fileName = `bbplayer-share-song-${Date.now()}`
			const uri = await captureRef(viewShotRef, {
				format: 'png',
				quality: 1,
				result: 'tmpfile',
				fileName,
			})
			setPreviewUri(uri)
			setIsGenerating(false)
		} catch {
			toast.error('生成预览失败')
			setIsGenerating(false)
		}
	}, [imageRef, currentTrack?.coverUrl, isPageListPending])

	// 当 imageRef 准备好时，尝试生成预览
	useEffect(() => {
		if (imageRef) {
			// 给一点时间让组件渲染
			const timer = setTimeout(() => {
				void generatePreview()
			}, 100)
			return () => clearTimeout(timer)
		} else if (!currentTrack?.coverUrl) {
			// 没有封面，直接生成
			void generatePreview()
		}
	}, [
		imageRef,
		generatePreview,
		currentTrack?.coverUrl,
		isPageListPending,
		pageList,
	])

	const isSharingRef = useRef(false)

	const handleShare = (action: 'save' | 'share') => {
		if (isSharingRef.current) return
		void performShare(
			action,
			previewUri,
			viewShotRef,
			currentTrack?.uniqueKey ?? '',
			permissionResponse,
			requestPermission,
			() => close('SongShare'),
			setIsSharing,
			isSharingRef,
		)
	}

	if (!currentTrack) {
		return (
			<>
				<Dialog.Title>分享歌曲</Dialog.Title>
				<Dialog.Content style={styles.errorContainer}>
					<Text
						variant='bodyMedium'
						style={styles.errorText}
					>
						当前没有正在播放的歌曲
					</Text>
				</Dialog.Content>
				<Dialog.Actions>
					<Button onPress={() => close('SongShare')}>关闭</Button>
				</Dialog.Actions>
			</>
		)
	}

	if (currentTrack.source !== 'bilibili') {
		return (
			<>
				<Dialog.Title>分享歌曲</Dialog.Title>
				<Dialog.Content style={styles.errorContainer}>
					<Text
						variant='bodyMedium'
						style={styles.errorText}
					>
						当前仅支持分享 Bilibili 来源的歌曲
					</Text>
				</Dialog.Content>
				<Dialog.Actions>
					<Button onPress={() => close('SongShare')}>关闭</Button>
				</Dialog.Actions>
			</>
		)
	}

	// 计算 shareUrl
	let shareUrl = `https://bbplayer.roitium.com/share/track?id=${encodeURIComponent(currentTrack.uniqueKey)}&title=${encodeURIComponent(currentTrack.title)}&cover=${encodeURIComponent(currentTrack.coverUrl ?? '')}`
	if (cid && pageList) {
		const page = pageList.find((p) => p.cid === cid)
		if (page) {
			shareUrl += `&p=${page.page}`
		}
	}

	return (
		<>
			<Dialog.Title>分享歌曲</Dialog.Title>
			<Dialog.Content style={styles.contentArea}>
				{isGenerating ? (
					<View style={styles.loadingContainer}>
						<ActivityIndicator size='large' />
						<Text
							variant='bodyMedium'
							style={styles.loadingText}
						>
							正在生成预览...
						</Text>
					</View>
				) : previewUri ? (
					<Image
						source={{ uri: previewUri }}
						style={styles.previewImage}
						contentFit='contain'
					/>
				) : (
					<View style={styles.loadingContainer}>
						<Text
							variant='bodyMedium'
							style={styles.loadingText}
						>
							预览加载失败
						</Text>
						<Button
							mode='outlined'
							onPress={() => generatePreview()}
							icon='refresh'
						>
							重试
						</Button>
					</View>
				)}
			</Dialog.Content>
			<Dialog.Actions>
				<Button
					mode='outlined'
					onPress={() => handleShare('save')}
					loading={isSharing}
					disabled={isSharing || isGenerating}
					icon='download'
				>
					保存
				</Button>
				<Button
					mode='contained'
					onPress={() => handleShare('share')}
					loading={isSharing}
					disabled={isSharing || isGenerating}
					icon='share-variant'
				>
					分享
				</Button>
				<Button onPress={() => close('SongShare')}>关闭</Button>
			</Dialog.Actions>

			{/* Hidden Capture View */}
			<View
				style={styles.hiddenCapture}
				pointerEvents='none'
			>
				<SongShareCard
					title={currentTrack.title}
					artistName={currentTrack.artist?.name ?? 'Unknown Artist'}
					imageRef={imageRef}
					shareUrl={shareUrl}
					viewShotRef={viewShotRef}
					backgroundColor={cardColor}
				/>
			</View>
		</>
	)
}

const styles = StyleSheet.create({
	contentArea: {
		paddingHorizontal: 16,
		minHeight: 280,
	},
	previewImage: {
		width: '100%',
		aspectRatio: 0.7,
		borderRadius: 12,
	},
	loadingContainer: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 80,
	},
	loadingText: {
		marginTop: 16,
		marginBottom: 16,
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

export default SongShareModal
