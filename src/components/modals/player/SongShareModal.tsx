import { SongShareCard } from '@/features/player/components/sharing/SongShareCard'
import { useCurrentTrack } from '@/hooks/player/useCurrentTrack'
import { useModalStore } from '@/hooks/stores/useModalStore'
import toast from '@/utils/toast'
import { Image } from 'expo-image'
import * as MediaLibrary from 'expo-media-library'
import * as Sharing from 'expo-sharing'
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { ActivityIndicator, Button, Dialog, Text } from 'react-native-paper'
import type ViewShot from 'react-native-view-shot'
import { captureRef } from 'react-native-view-shot'

const SongShareModal = () => {
	const currentTrack = useCurrentTrack()
	const close = useModalStore((state) => state.close)

	const [permissionResponse, requestPermission] = MediaLibrary.usePermissions()
	const [isSharing, setIsSharing] = useState(false)
	const [previewUri, setPreviewUri] = useState<string | null>(null)
	const [isGenerating, setIsGenerating] = useState(true)

	const viewShotRef = useRef<ViewShot>(null)

	const generatePreview = async () => {
		if (!viewShotRef.current) {
			setIsGenerating(false)
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
		} catch (e) {
			console.error(e)
			toast.error('生成预览失败')
			setIsGenerating(false)
		}
	}

	// 打开时自动生成预览
	useEffect(() => {
		const timer = setTimeout(() => {
			void generatePreview()
		}, 300) // 延迟确保组件已渲染
		return () => clearTimeout(timer)
	}, [])

	const handleShare = async (action: 'save' | 'share') => {
		setIsSharing(true)

		let uri = previewUri
		const needsCapture = !uri && viewShotRef.current !== null
		if (needsCapture) {
			try {
				const fileName = `bbplayer-share-song-${Date.now()}`
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
			close('SongShare')
		} catch (e) {
			console.error(e)
			toast.error('操作失败')
			setIsSharing(false)
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
							onPress={generatePreview}
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
				{currentTrack && (
					<SongShareCard
						track={currentTrack}
						viewShotRef={viewShotRef}
					/>
				)}
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
	hiddenCapture: {
		position: 'absolute',
		top: 99999,
		left: 0,
		opacity: 0,
	},
})

export default SongShareModal
