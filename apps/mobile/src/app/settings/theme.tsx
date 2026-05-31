import { SegmentedControl } from '@expo/ui/community/segmented-control'
import { Slider } from '@expo/ui/community/slider'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useVideoPlayer, VideoView } from 'expo-video'
import { WavySlider } from 'expo-wavy-slider'
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Appbar, Icon, Text, useTheme } from 'react-native-paper'
import { useSharedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import AnimatedModalOverlay from '@/components/common/AnimatedModalOverlay'
import Button from '@/components/common/Button'
import UniversalSwitch from '@/components/common/UniversalSwitch'
import NowPlayingBar from '@/components/NowPlayingBar'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import useAppStore from '@/hooks/stores/useAppStore'
import useActiveSkin from '@/hooks/theme/useActiveSkin'
import type { SkinAssetFeatures, SkinBootSplashAsset } from '@/lib/theme/skins'

const SKIN_FEATURE_LABELS: Array<[keyof SkinAssetFeatures, string]> = [
	['skin', '主题'],
	['playIcon', '滑块'],
	['thumbup', '点赞'],
	['loading', '刷新'],
	['cards', '卡牌'],
	['spaceBg', '海报'],
	['emojiPackage', '表情'],
	['card', '头像框'],
	['cardBg', '卡片背景'],
	['redeems', '兑换'],
]

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
	const skinSliderThumbSize = useAppStore(
		(state) => state.settings.skinSliderThumbSize ?? 20,
	)
	const skinSliderThumbOffsetX = useAppStore(
		(state) => state.settings.skinSliderThumbOffsetX ?? 0,
	)
	const skinSliderThumbOffsetY = useAppStore(
		(state) => state.settings.skinSliderThumbOffsetY ?? 0,
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

	const activeInstalledSkin = installedSkins.find(
		(skin) => skin.id === activeSkinId,
	)

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

				<View style={styles.section}>
					<Button
						mode='outlined'
						onPress={() => router.push('/settings/theme/search')}
					>
						添加主题
					</Button>
				</View>

				{installedSkins.length > 0 ? (
					<View style={styles.section}>
						<Text variant='titleMedium'>已安装主题</Text>
						<View style={styles.skinList}>
							{installedSkins.map((skin) => {
								const selected = skin.id === activeSkinId
								return (
									<Pressable
										key={skin.id}
										style={[
											styles.skinRow,
											{
												borderColor: selected
													? colors.primary
													: colors.outlineVariant,
											},
										]}
										onPress={() => setSettings({ activeSkinId: skin.id })}
									>
										{skin.coverUri ? (
											<Image
												source={{ uri: skin.coverUri }}
												style={styles.skinCover}
												contentFit='cover'
											/>
										) : (
											<View
												style={[
													styles.skinCover,
													{ backgroundColor: colors.surfaceVariant },
												]}
											/>
										)}
										<View style={styles.skinText}>
											<Text numberOfLines={1}>{skin.name}</Text>
											<Text
												variant='bodySmall'
												style={{ color: colors.onSurfaceVariant }}
											>
												{selected ? '正在使用' : '点击切换'}
											</Text>
											<AssetFeatureSummary features={skin.assetFeatures} />
										</View>
										{selected ? (
											<Icon
												source='check-circle'
												size={20}
												color={colors.primary}
											/>
										) : null}
									</Pressable>
								)
							})}
						</View>
					</View>
				) : null}

				{activeSkinId && activeSkin ? (
					<View style={styles.section}>
						{activeInstalledSkin?.assetFeatures ? (
							<AssetFeaturePanel features={activeInstalledSkin.assetFeatures} />
						) : null}
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

				{activeSkin ? (
					<View style={styles.section}>
						<Text variant='titleMedium'>播放器滑块</Text>
						<Text
							variant='bodySmall'
							style={{ color: colors.onSurfaceVariant }}
						>
							尺寸 {skinSliderThumbSize} · X {skinSliderThumbOffsetX} · Y{' '}
							{skinSliderThumbOffsetY}
						</Text>
						<Slider
							style={styles.controlSlider}
							minimumValue={12}
							maximumValue={36}
							step={1}
							value={skinSliderThumbSize}
							onValueChange={(value) =>
								setSettings({ skinSliderThumbSize: Math.round(value) })
							}
						/>
						<Slider
							style={styles.controlSlider}
							minimumValue={-24}
							maximumValue={24}
							step={1}
							value={skinSliderThumbOffsetX}
							onValueChange={(value) =>
								setSettings({ skinSliderThumbOffsetX: Math.round(value) })
							}
						/>
						<Slider
							style={styles.controlSlider}
							minimumValue={-24}
							maximumValue={24}
							step={1}
							value={skinSliderThumbOffsetY}
							onValueChange={(value) =>
								setSettings({ skinSliderThumbOffsetY: Math.round(value) })
							}
						/>
						<SliderPreview
							thumbUri={activeSkin.player.sliderThumb.normal.uri}
							thumbSize={skinSliderThumbSize}
							offsetX={skinSliderThumbOffsetX}
							offsetY={skinSliderThumbOffsetY}
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

function SliderPreview({
	offsetX,
	offsetY,
	thumbSize,
	thumbUri,
}: {
	offsetX: number
	offsetY: number
	thumbSize: number
	thumbUri: string
}) {
	const colors = useTheme().colors
	const progress = useSharedValue(0.45)
	const waveHeight = useSharedValue(0)
	const waveVelocity = useSharedValue(0)
	const thickness = useSharedValue(3)

	return (
		<View style={styles.sliderPreview}>
			<WavySlider
				style={styles.previewSlider}
				progress={progress}
				colors={{
					activeTrackColor: colors.primary,
					bufferedTrackColor: colors.primary,
					inactiveTrackColor: colors.surfaceVariant,
					thumbColor: colors.primary,
				}}
				waveLength={30}
				waveVelocity={waveVelocity}
				waveDirection='head'
				waveHeight={waveHeight}
				waveThickness={thickness}
				trackThickness={thickness}
				thumbImageUri={thumbUri}
				thumbImageSize={thumbSize}
				thumbImageOffsetX={offsetX}
				thumbImageOffsetY={offsetY}
				incremental={false}
				onValueChange={(value) => {
					'worklet'
					progress.set(value)
				}}
			/>
		</View>
	)
}

function AssetFeatureSummary({ features }: { features?: SkinAssetFeatures }) {
	const colors = useTheme().colors
	if (!features) return null

	const availableCount = SKIN_FEATURE_LABELS.filter(
		([key]) => features[key],
	).length
	return (
		<Text
			variant='bodySmall'
			style={{ color: colors.onSurfaceVariant }}
		>
			已包含 {availableCount}/{SKIN_FEATURE_LABELS.length} 类资产
		</Text>
	)
}

function AssetFeaturePanel({ features }: { features: SkinAssetFeatures }) {
	const colors = useTheme().colors

	return (
		<View style={styles.featurePanel}>
			<Text variant='titleMedium'>资产覆盖</Text>
			<View style={styles.featureGrid}>
				{SKIN_FEATURE_LABELS.map(([key, label]) => {
					const available = features[key]
					return (
						<View
							key={key}
							style={[
								styles.featurePill,
								{
									backgroundColor: available
										? colors.primaryContainer
										: colors.surfaceVariant,
								},
							]}
						>
							<Icon
								source={available ? 'check' : 'close'}
								size={14}
								color={
									available
										? colors.onPrimaryContainer
										: colors.onSurfaceVariant
								}
							/>
							<Text
								variant='bodySmall'
								style={{
									color: available
										? colors.onPrimaryContainer
										: colors.onSurfaceVariant,
								}}
							>
								{label}
							</Text>
						</View>
					)
				})}
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
	const [mode, setMode] = useState<'poster' | 'video'>('poster')
	const player = useVideoPlayer(asset?.video?.uri ?? null, (video) => {
		video.loop = true
		video.muted = true
	})

	useEffect(() => {
		if (!asset) return

		const nextMode = asset.video ? 'video' : 'poster'
		setMode(nextMode)
		if (asset.video) {
			player.replay()
		}
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
					{asset.video ? (
						<View style={styles.segmentedControlContainer}>
							<SegmentedControl
								selectedIndex={mode === 'poster' ? 0 : 1}
								onChange={(event) => {
									const selectedIndex = event.nativeEvent.selectedSegmentIndex
									setMode(selectedIndex === 0 ? 'poster' : 'video')
									if (selectedIndex === 1) {
										player.replay()
									}
								}}
								values={['静态海报', '动图']}
							/>
						</View>
					) : null}
					<View
						style={[
							styles.previewFrame,
							{ backgroundColor: colors.elevation.level2 },
						]}
					>
						{mode === 'poster' || !asset.video ? (
							<Image
								source={asset.card}
								style={styles.previewMedia}
								contentFit='contain'
								cachePolicy='memory-disk'
							/>
						) : (
							<VideoView
								player={player}
								style={styles.previewMedia}
								contentFit='contain'
								nativeControls={false}
								surfaceType='textureView'
							/>
						)}
					</View>
					<View style={styles.previewActions}>
						<Button
							mode='outlined'
							onPress={onDismiss}
						>
							取消
						</Button>
						<Button onPress={() => onSelect(asset, mode)}>
							使用该{mode === 'poster' ? '海报' : '视频'}
						</Button>
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
	skinList: {
		gap: 10,
		marginTop: 12,
	},
	skinRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		borderWidth: 1,
		borderRadius: 8,
		padding: 10,
	},
	skinCover: {
		width: 48,
		height: 48,
		borderRadius: 6,
	},
	skinText: {
		flex: 1,
	},
	featurePanel: {
		gap: 10,
		marginBottom: 18,
	},
	featureGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	featurePill: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		borderRadius: 8,
		paddingHorizontal: 8,
		paddingVertical: 5,
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
	segmentedControlContainer: {
		marginBottom: 12,
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
	controlSlider: {
		width: '100%',
		marginTop: 8,
	},
	sliderPreview: {
		marginTop: 12,
		height: 48,
		justifyContent: 'center',
	},
	previewSlider: {
		width: '100%',
		height: 32,
	},
	nowPlayingBarContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
	},
})
