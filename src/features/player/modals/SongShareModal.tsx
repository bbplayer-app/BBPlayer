import { SongShareCard } from '@/features/player/components/sharing/SongShareCard'
import { useCurrentTrack } from '@/hooks/player/useCurrentTrack'
import { useModalStore } from '@/hooks/stores/useModalStore'
import toast from '@/utils/toast'
import BottomSheet, {
	BottomSheetBackdrop,
	BottomSheetView,
	useBottomSheetTimingConfigs,
	type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import type { BottomSheetMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import * as MediaLibrary from 'expo-media-library'
import * as Sharing from 'expo-sharing'
import { useCallback, useMemo, useRef, useState, type RefObject } from 'react'
import { StyleSheet, View } from 'react-native'
import { Button, IconButton, Text, useTheme } from 'react-native-paper'
import { Easing } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type ViewShot from 'react-native-view-shot'
import { captureRef } from 'react-native-view-shot'

export default function SongShareModal({
	sheetRef,
}: {
	sheetRef: RefObject<BottomSheetMethods>
}) {
	const theme = useTheme()
	const insets = useSafeAreaInsets()
	const currentTrack = useCurrentTrack()
	const close = useModalStore((state) => state.close)

	const [permissionResponse, requestPermission] = MediaLibrary.usePermissions()
	const [isSharing, setIsSharing] = useState(false)

	const viewShotRef = useRef<ViewShot>(null)
	const snapPoints = useMemo(() => ['60%'], [])

	const animationConfigs = useBottomSheetTimingConfigs({
		duration: 300,
		easing: Easing.exp,
	})

	const renderBackdrop = useCallback(
		(props: BottomSheetBackdropProps) => (
			<BottomSheetBackdrop
				{...props}
				disappearsOnIndex={-1}
				appearsOnIndex={0}
				pressBehavior='close'
			/>
		),
		[],
	)

	const handleShare = async (action: 'save' | 'share') => {
		if (!viewShotRef.current) return

		try {
			setIsSharing(true)

			// 1. Capture Image
			const uri = await captureRef(viewShotRef, {
				format: 'png',
				quality: 1,
				result: 'tmpfile',
			})

			// 2. Action
			if (action === 'save') {
				if (
					permissionResponse?.status !== MediaLibrary.PermissionStatus.GRANTED
				) {
					const { status } = await requestPermission()
					if (status !== MediaLibrary.PermissionStatus.GRANTED) {
						toast.error('无法保存图片', { description: '请允许访问相册' })
						setIsSharing(false)
						return
					}
				}
				await MediaLibrary.saveToLibraryAsync(uri)
				toast.success('已保存到相册')
			} else {
				if (await Sharing.isAvailableAsync()) {
					await Sharing.shareAsync(uri)
				} else {
					toast.error('分享不可用')
				}
			}
			close('SongShare')
		} catch (e) {
			console.error(e)
			toast.error('生成图片失败')
		} finally {
			setIsSharing(false)
		}
	}

	return (
		<BottomSheet
			ref={sheetRef}
			index={0}
			enablePanDownToClose={true}
			snapPoints={snapPoints}
			backdropComponent={renderBackdrop}
			backgroundStyle={{ backgroundColor: theme.colors.elevation.level1 }}
			handleStyle={{
				borderBottomWidth: 1,
				borderBottomColor: theme.colors.elevation.level5,
			}}
			animationConfigs={animationConfigs}
			onClose={() => close('SongShare')}
		>
			<View style={styles.header}>
				<Text variant='titleMedium'>分享歌曲</Text>
				<IconButton
					icon='close'
					onPress={() => sheetRef.current?.close()}
				/>
			</View>

			<View style={styles.previewContainer}>
				<Text
					variant='bodyMedium'
					style={{ textAlign: 'center', opacity: 0.6 }}
				>
					正在生成预览... (实际点击分享时生成高清图)
				</Text>
			</View>

			<BottomSheetView
				style={[
					styles.footer,
					{
						paddingBottom: insets.bottom + 10,
						backgroundColor: theme.colors.elevation.level2,
					},
				]}
			>
				<Button
					mode='outlined'
					onPress={() => handleShare('save')}
					loading={isSharing}
					disabled={isSharing}
					icon='download'
					style={{ flex: 1 }}
				>
					保存
				</Button>
				<Button
					mode='contained'
					onPress={() => handleShare('share')}
					loading={isSharing}
					disabled={isSharing}
					icon='share-variant'
					style={{ flex: 1 }}
				>
					分享
				</Button>
			</BottomSheetView>

			{/* Render off-screen to capture */}
			<View
				style={{
					position: 'absolute',
					top: 99999,
					left: 0,
					opacity: 0,
				}}
				pointerEvents='none'
			>
				{currentTrack && (
					<SongShareCard
						track={currentTrack}
						viewShotRef={viewShotRef}
					/>
				)}
			</View>
		</BottomSheet>
	)
}

const styles = StyleSheet.create({
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingVertical: 8,
	},
	previewContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		padding: 20,
	},
	footer: {
		flexDirection: 'row',
		gap: 12,
		padding: 16,
		borderTopWidth: 1,
		borderColor: 'rgba(0,0,0,0.05)',
	},
})
