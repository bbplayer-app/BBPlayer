import { LyricsShareCard } from '@/features/player/components/sharing/LyricsShareCard'
import { useCurrentTrack } from '@/hooks/player/useCurrentTrack'
import { useSmartFetchLyrics } from '@/hooks/queries/lyrics'
import { useModalStore } from '@/hooks/stores/useModalStore'
import toast from '@/utils/toast'
import BottomSheet, {
	BottomSheetBackdrop,
	BottomSheetFlatList,
	BottomSheetView,
	useBottomSheetTimingConfigs,
	type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import type { BottomSheetMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import * as MediaLibrary from 'expo-media-library'
import * as Sharing from 'expo-sharing'
import { useCallback, useMemo, useRef, useState, type RefObject } from 'react'
import { StyleSheet, View } from 'react-native'
import {
	Button,
	Checkbox,
	IconButton,
	Text,
	TouchableRipple,
	useTheme,
} from 'react-native-paper'
import { Easing } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type ViewShot from 'react-native-view-shot'
import { captureRef } from 'react-native-view-shot'

interface LyricLine {
	timestamp: number
	text: string
	translation?: string
}

export default function LyricsSelectionModal({
	sheetRef,
}: {
	sheetRef: RefObject<BottomSheetMethods>
}) {
	const theme = useTheme()
	const insets = useSafeAreaInsets()
	const currentTrack = useCurrentTrack()
	const close = useModalStore((state) => state.close)

	const { data: lyricsData } = useSmartFetchLyrics(
		true,
		currentTrack ?? undefined,
	)
	const lyrics = lyricsData?.lyrics

	const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
		() => new Set(),
	)
	const [permissionResponse, requestPermission] = MediaLibrary.usePermissions()
	const [isSharing, setIsSharing] = useState(false)

	const viewShotRef = useRef<ViewShot>(null)

	const snapPoints = useMemo(() => ['85%'], [])

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
	}, [])

	const handleShare = async (action: 'save' | 'share') => {
		if (selectedIndices.size === 0) {
			toast.error('请先选择歌词')
			return
		}

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
			close('LyricsSelection')
		} catch (e) {
			console.error(e)
			toast.error('生成图片失败')
		} finally {
			setIsSharing(false)
		}
	}

	const renderItem = useCallback(
		({ item, index }: { item: LyricLine; index: number }) => {
			const isSelected = selectedIndices.has(index)
			return (
				<TouchableRipple onPress={() => toggleSelection(index)}>
					<View style={styles.itemContainer}>
						<View style={{ flex: 1 }}>
							<Text
								variant='bodyLarge'
								style={{
									fontWeight: isSelected ? 'bold' : 'normal',
									color: isSelected
										? theme.colors.primary
										: theme.colors.onSurface,
								}}
							>
								{item.text}
							</Text>
							{item.translation && (
								<Text
									variant='bodySmall'
									style={{
										color: isSelected
											? theme.colors.primary
											: theme.colors.onSurfaceVariant,
									}}
								>
									{item.translation}
								</Text>
							)}
						</View>
						<Checkbox
							status={isSelected ? 'checked' : 'unchecked'}
							onPress={() => toggleSelection(index)}
						/>
					</View>
				</TouchableRipple>
			)
		},
		[
			selectedIndices,
			theme.colors.onSurface,
			theme.colors.onSurfaceVariant,
			theme.colors.primary,
			toggleSelection,
		],
	)

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
			onClose={() => close('LyricsSelection')}
		>
			<View style={styles.header}>
				<Text variant='titleMedium'>
					选择歌词分享 ({selectedIndices.size}/5)
				</Text>
				<IconButton
					icon='close'
					onPress={() => sheetRef.current?.close()}
				/>
			</View>

			<BottomSheetFlatList
				data={lyrics ?? []}
				keyExtractor={(item: LyricLine, index: number) =>
					`${index}-${item.timestamp}`
				}
				renderItem={renderItem}
				contentContainerStyle={{ paddingBottom: 100 }}
			/>

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
					disabled={isSharing || selectedIndices.size === 0}
					icon='download'
					style={{ flex: 1 }}
				>
					保存
				</Button>
				<Button
					mode='contained'
					onPress={() => handleShare('share')}
					loading={isSharing}
					disabled={isSharing || selectedIndices.size === 0}
					icon='share-variant'
					style={{ flex: 1 }}
				>
					分享
				</Button>
			</BottomSheetView>

			{/* Hidden Capture View */}
			<View
				style={{
					position: 'absolute',
					top: 99999, // Move off-screen
					left: 0,
					opacity: 0, // Invisible but renderable
				}}
				pointerEvents='none'
			>
				{currentTrack && (
					<LyricsShareCard
						track={currentTrack}
						selectedLyrics={(lyrics ?? []).filter((_, i) =>
							selectedIndices.has(i),
						)}
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
	itemContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingVertical: 12,
	},
	footer: {
		flexDirection: 'row',
		gap: 12,
		padding: 16,
		borderTopWidth: 1,
		borderColor: 'rgba(0,0,0,0.05)',
	},
})
