import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Appbar, Icon, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import AnimatedModalOverlay from '@/components/common/AnimatedModalOverlay'
import Button from '@/components/common/Button'
import UniversalSwitch from '@/components/common/UniversalSwitch'
import NowPlayingBar from '@/components/NowPlayingBar'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import useAppStore from '@/hooks/stores/useAppStore'
import useActiveSkin from '@/hooks/theme/useActiveSkin'
import type { SkinBootSplashAsset } from '@/lib/theme/skins'

export default function ThemeSettingsPage() {
	const router = useRouter()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()
	const activeSkin = useActiveSkin()
	const activeSkinId = useAppStore((state) => state.settings.activeSkinId)
	const installedSkins = useAppStore(
		(state) => state.settings.installedSkins ?? [],
	)
	const playFullSkinBootSplashAnimation = useAppStore(
		(state) => state.settings.playFullSkinBootSplashAnimation,
	)
	const selectedSkinBootSplashAssetId = useAppStore(
		(state) => state.settings.selectedSkinBootSplashAssetId,
	)
	const selectedSkinBootSplashMode = useAppStore(
		(state) => state.settings.selectedSkinBootSplashMode,
	)
	const setSettings = useAppStore((state) => state.setSettings)
	const [previewAsset, setPreviewAsset] = useState<SkinBootSplashAsset | null>(
		null,
	)

	const selectedBootSplashAsset =
		activeSkin?.bootSplash.items.find(
			(item) => item.id === selectedSkinBootSplashAssetId,
		) ?? activeSkin?.bootSplash.items[0]
	const selectedMode =
		selectedBootSplashAsset?.video && selectedSkinBootSplashMode === 'video'
			? '动图'
			: '静态海报'

	const selectBootSplashAsset = (
		item: SkinBootSplashAsset,
		mode: 'poster' | 'video',
	) => {
		setSettings({
			selectedSkinBootSplashAssetId: item.id,
			selectedSkinBootSplashMode: item.video ? mode : 'poster',
		})
		setPreviewAsset(null)
	}

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title='主题设置' />
			</Appbar.Header>
			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={[
					styles.scrollContent,
					{ paddingBottom: insets.bottom + (haveTrack ? 70 + 20 : 20) },
				]}
			>
				<View style={styles.settingRow}>
					<View style={styles.settingTextContainer}>
						<Text>动态主题</Text>
						<Text
							variant='bodySmall'
							style={{ color: colors.onSurfaceVariant }}
						>
							{activeSkin
								? activeSkin.name
								: installedSkins.length > 0
									? '开启后使用已选择的皮肤资源包'
									: '下载皮肤资源包后可启用'}
						</Text>
					</View>
					<UniversalSwitch
						value={activeSkinId !== null}
						onValueChange={(value) =>
							setSettings({
								activeSkinId: value ? (installedSkins[0]?.id ?? null) : null,
							})
						}
						disabled={installedSkins.length === 0}
					/>
				</View>

				{activeSkinId && activeSkin ? (
					<View style={styles.section}>
						<View style={styles.sectionHeader}>
							<View style={styles.settingTextContainer}>
								<Text>启动动画素材</Text>
								<Text
									variant='bodySmall'
									style={{ color: colors.onSurfaceVariant }}
								>
									{selectedBootSplashAsset
										? `${selectedBootSplashAsset.name} · ${selectedMode}`
										: '默认素材'}
								</Text>
							</View>
						</View>
						<View style={styles.assetGrid}>
							{activeSkin.bootSplash.items.map((item) => {
								const selected = item.id === selectedBootSplashAsset?.id
								return (
									<Pressable
										key={item.id}
										style={[
											styles.assetCard,
											{
												borderColor: selected
													? colors.primary
													: colors.outlineVariant,
											},
										]}
										onPress={() => setPreviewAsset(item)}
									>
										<Image
											source={item.card}
											style={styles.assetPoster}
											contentFit='cover'
											cachePolicy='memory-disk'
										/>
										{item.video ? (
											<View
												style={[
													styles.videoBadge,
													{ backgroundColor: colors.inverseSurface },
												]}
											>
												<Icon
													source='play'
													size={14}
													color={colors.inverseOnSurface}
												/>
											</View>
										) : null}
										{selected ? (
											<View
												style={[
													styles.selectedBadge,
													{ backgroundColor: colors.primary },
												]}
											>
												<Icon
													source='check'
													size={16}
													color={colors.onPrimary}
												/>
											</View>
										) : null}
									</Pressable>
								)
							})}
						</View>
					</View>
				) : null}

				{activeSkinId ? (
					<View style={styles.settingRow}>
						<View style={styles.settingTextContainer}>
							<Text>完整播放主题启动动画</Text>
							<Text
								variant='bodySmall'
								style={{ color: colors.onSurfaceVariant }}
							>
								关闭时应用加载完成后立即淡出启动动画
							</Text>
						</View>
						<UniversalSwitch
							value={playFullSkinBootSplashAnimation}
							onValueChange={(value) =>
								setSettings({ playFullSkinBootSplashAnimation: value })
							}
						/>
					</View>
				) : null}
			</ScrollView>

			<BootSplashAssetPreview
				asset={previewAsset}
				onDismiss={() => setPreviewAsset(null)}
				onSelect={selectBootSplashAsset}
			/>

			<View style={styles.nowPlayingBarContainer}>
				<NowPlayingBar />
			</View>
		</View>
	)
}

function BootSplashAssetPreview({
	asset,
	onDismiss,
	onSelect,
}: {
	asset: SkinBootSplashAsset | null
	onDismiss: () => void
	onSelect: (asset: SkinBootSplashAsset, mode: 'poster' | 'video') => void
}) {
	const colors = useTheme().colors
	const player = useVideoPlayer(asset?.video?.uri ?? null, (video) => {
		video.loop = true
		video.muted = true
	})

	useEffect(() => {
		if (!asset?.video) return

		player.replay()
	}, [asset, player])

	return (
		<AnimatedModalOverlay
			visible={asset !== null}
			onDismiss={onDismiss}
		>
			{asset ? (
				<View style={styles.previewContent}>
					<Text
						variant='titleMedium'
						style={styles.previewTitle}
					>
						{asset.name}
					</Text>
					<View
						style={[
							styles.previewFrame,
							{ backgroundColor: colors.elevation.level2 },
						]}
					>
						<Image
							source={asset.card}
							style={styles.previewMedia}
							contentFit='contain'
							cachePolicy='memory-disk'
						/>
						{asset.video ? (
							<VideoView
								player={player}
								style={styles.previewMedia}
								contentFit='contain'
								nativeControls={false}
								surfaceType='textureView'
							/>
						) : null}
					</View>
					<View style={styles.previewActions}>
						<Button
							mode='outlined'
							onPress={() => onSelect(asset, 'poster')}
						>
							使用静态海报
						</Button>
						{asset.video ? (
							<Button onPress={() => onSelect(asset, 'video')}>使用动图</Button>
						) : null}
					</View>
				</View>
			) : null}
		</AnimatedModalOverlay>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		paddingHorizontal: 25,
	},
	settingRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginTop: 16,
	},
	settingTextContainer: {
		flex: 1,
		marginRight: 16,
	},
	section: {
		marginTop: 22,
	},
	sectionHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 12,
	},
	assetGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 12,
	},
	assetCard: {
		width: '31%',
		aspectRatio: 522 / 696,
		borderWidth: 2,
		borderRadius: 8,
		overflow: 'hidden',
	},
	assetPoster: {
		width: '100%',
		height: '100%',
	},
	videoBadge: {
		position: 'absolute',
		left: 6,
		top: 6,
		width: 24,
		height: 24,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
	},
	selectedBadge: {
		position: 'absolute',
		right: 6,
		top: 6,
		width: 24,
		height: 24,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
	},
	previewContent: {
		paddingHorizontal: 18,
		paddingBottom: 18,
	},
	previewTitle: {
		marginBottom: 12,
		textAlign: 'center',
	},
	previewFrame: {
		width: '100%',
		aspectRatio: 522 / 696,
		borderRadius: 8,
		overflow: 'hidden',
	},
	previewMedia: {
		...StyleSheet.absoluteFill,
	},
	previewActions: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		gap: 10,
		marginTop: 16,
	},
	nowPlayingBarContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
	},
})
