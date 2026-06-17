import { SegmentedControl } from '@expo/ui/community/segmented-control'
import { Slider } from '@expo/ui/community/slider'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import * as Updates from 'expo-updates'
import { useVideoPlayer, VideoView } from 'expo-video'
import { WavySlider } from 'expo-wavy-slider'
import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Appbar, Dialog, Icon, Text, useTheme } from 'react-native-paper'
import { useSharedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import AnimatedModalOverlay from '@/components/common/AnimatedModalOverlay'
import Button from '@/components/common/Button'
import UniversalSwitch from '@/components/common/UniversalSwitch'
import { alert } from '@/components/modals/AlertModal'
import NowPlayingBar from '@/components/NowPlayingBar'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import useSkinStore from '@/hooks/stores/useSkinStore'
import useActiveSkin from '@/hooks/theme/useActiveSkin'
import { loadSkinAssets } from '@/services/theme/runtime'
import { uninstallSkin } from '@/services/theme/SkinManager'
import type {
	AppSkin,
	InstalledSkinMeta,
	SkinAssetDeclaration,
	SkinAssetFeatures,
	SkinBootSplashAsset,
} from '@/services/theme/types'
import { assetFeaturesFromManifest } from '@/services/theme/types'
import { storage } from '@/utils/mmkv'
import toast from '@/utils/toast'

const SKIN_FEATURE_LABELS: Array<[keyof SkinAssetFeatures, string]> = [
	['cards', '海报'],
	// ['spaceBackgrounds', '海报'],
	['skins', '应用主题'],
	['playIcons', '滑块'],
	['thumbups', '点赞动画'],
	['loadings', '刷新动画'],
	['avatarFrames', '头像框'],
	// ['cardBackgrounds', '卡片背景'],
	// ['emojiPackages', '表情'],
]

const EMPTY_INSTALLED_SKINS: InstalledSkinMeta[] = []

const deleteSkin = (skin: InstalledSkinMeta) => {
	alert(
		'删除装扮',
		`确定删除「${skin.name}」吗？`,
		[
			{ text: '取消' },
			{
				text: '删除',
				onPress: () => {
					void uninstallSkin(skin.id)
				},
			},
		],
		{ cancelable: true },
	)
}

export default function ThemeSettingsPage() {
	const router = useRouter()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()
	const activeSkin = useActiveSkin()
	const activeSkinId = useSkinStore((state) => state.activeSkinId)
	const activeSkinIndex = useSkinStore((state) => state.activeSkinIndex)
	const activePlayIconIndex = useSkinStore((state) => state.activePlayIconIndex)
	const activeThumbUpIndex = useSkinStore((state) => state.activeThumbUpIndex)
	const activeLoadingIndex = useSkinStore((state) => state.activeLoadingIndex)
	const activeAvatarFrameIndex = useSkinStore(
		(state) => state.activeAvatarFrameIndex,
	)
	const installedSkins = useSkinStore(
		(state) => state.installedSkins ?? EMPTY_INSTALLED_SKINS,
	)
	const playFullSkinBootSplashAnimation = useSkinStore(
		(state) => state.playFullSkinBootSplashAnimation,
	)
	const selectedSkinBootSplashAssetId = useSkinStore(
		(state) => state.selectedSkinBootSplashAssetId,
	)
	const selectedSkinBootSplashMode = useSkinStore(
		(state) => state.selectedSkinBootSplashMode,
	)
	const skinSliderThumbSize = useSkinStore(
		(state) => state.skinSliderThumbSize ?? 20,
	)
	const skinSliderThumbOffsetX = useSkinStore(
		(state) => state.skinSliderThumbOffsetX ?? 0,
	)
	const skinSliderThumbOffsetY = useSkinStore(
		(state) => state.skinSliderThumbOffsetY ?? 0,
	)
	const setSkinSettings = useSkinStore((state) => state.setSkinSettings)
	const [previewAsset, setPreviewAsset] = useState<SkinBootSplashAsset | null>(
		null,
	)

	const selectedBootSplashAsset =
		activeSkin?.bootSplash.items?.find(
			(item) => item.id === selectedSkinBootSplashAssetId,
		) ?? activeSkin?.bootSplash.items?.[0]
	const selectedMode =
		selectedBootSplashAsset?.video && selectedSkinBootSplashMode === 'video'
			? '动图'
			: '静态海报'

	const selectBootSplashAsset = (
		item: SkinBootSplashAsset,
		mode: 'poster' | 'video',
	) => {
		setSkinSettings({
			selectedSkinBootSplashAssetId: item.id,
			selectedSkinBootSplashMode: item.video ? mode : 'poster',
		})
		setPreviewAsset(null)

		const resolvedAsset = activeSkin?.bootSplash.items?.find(
			(i) => i.id === item.id,
		)
		const cardPath = resolvedAsset?.card ?? ''
		const videoPath =
			item.video && mode === 'video' ? (resolvedAsset?.video ?? '') : ''
		storage.set('boot_splash_preload', `${videoPath}|${cardPath}`)
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
							setSkinSettings({
								activeAvatarFrameIndex: 0,
								activeLoadingIndex: 0,
								activePlayIconIndex: 0,
								activeSkinId: value ? (installedSkins[0]?.id ?? null) : null,
								activeSkinIndex: 0,
								activeThumbUpIndex: 0,
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
								const coverUri = localAssetUri(skin.rootUri, skin.coverPath)
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
										onPress={() =>
											setSkinSettings({
												activeAvatarFrameIndex: 0,
												activeLoadingIndex: 0,
												activePlayIconIndex: 0,
												activeSkinId: skin.id,
												activeSkinIndex: 0,
												activeThumbUpIndex: 0,
											})
										}
									>
										{coverUri ? (
											<Image
												source={{ uri: coverUri }}
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
										</View>
										{selected ? (
											<Icon
												source='check-circle'
												size={20}
												color={colors.primary}
											/>
										) : null}
										<Pressable
											style={styles.iconAction}
											onPress={(event) => {
												event.stopPropagation()
												deleteSkin(skin)
											}}
											hitSlop={8}
										>
											<Icon
												source='trash-can-outline'
												size={20}
												color={colors.error}
											/>
										</Pressable>
									</Pressable>
								)
							})}
						</View>
					</View>
				) : null}

				{activeSkinId && activeSkin ? (
					<View style={styles.section}>
						{activeInstalledSkin ? (
							<InstalledAssetSections
								activeAvatarFrameIndex={activeAvatarFrameIndex}
								activeLoadingIndex={activeLoadingIndex}
								activePlayIconIndex={activePlayIconIndex}
								activeSkinIndex={activeSkinIndex}
								activeThumbUpIndex={activeThumbUpIndex}
								onSelectAvatarFrame={(index) =>
									setSkinSettings({ activeAvatarFrameIndex: index })
								}
								onSelectLoading={(index) =>
									setSkinSettings({ activeLoadingIndex: index })
								}
								onSelectPlayIcon={(index) =>
									setSkinSettings({ activePlayIconIndex: index })
								}
								onSelectSkin={(index) =>
									setSkinSettings({ activeSkinIndex: index })
								}
								onSelectThumbUp={(index) =>
									setSkinSettings({ activeThumbUpIndex: index })
								}
								onDisableSkin={() => {
									setSkinSettings({ activeSkinIndex: -1 })
									alert('关闭应用主题', '需要重启软件才能应用更改', [
										{ text: '取消' },
										{
											text: '关闭并重启',
											onPress: () => {
												void Updates.reloadAsync()
											},
										},
									])
								}}
								onDisablePlayIcon={() => {
									setSkinSettings({ activePlayIconIndex: -1 })
									toast.success('已关闭显示滑块')
								}}
								onDisableThumbUp={() => {
									setSkinSettings({ activeThumbUpIndex: -1 })
									toast.success('已关闭显示点赞动画')
								}}
								onDisableLoading={() => {
									setSkinSettings({ activeLoadingIndex: -1 })
									toast.success('已关闭显示刷新动画')
								}}
								onDisableAvatarFrame={() => {
									setSkinSettings({ activeAvatarFrameIndex: -1 })
									toast.success('已关闭显示头像框')
								}}
								skin={activeInstalledSkin}
								thumbUpSprites={activeSkin.thumbUpSprites}
							/>
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
							{activeSkin.bootSplash.items
								? activeSkin.bootSplash.items?.map((item) => {
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
												{item.card ? (
													<Image
														source={item.card}
														style={styles.assetPoster}
														contentFit='cover'
														cachePolicy='memory-disk'
													/>
												) : null}
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
									})
								: null}
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
								setSkinSettings({
									playFullSkinBootSplashAnimation: value,
								})
							}
						/>
					</View>
				) : null}

				{activeSkin ? (
					<View style={styles.section}>
						<View
							style={[
								styles.sliderPanel,
								{ backgroundColor: colors.elevation.level1 },
							]}
						>
							<View style={styles.sectionHeader}>
								<View style={styles.settingTextContainer}>
									<Text variant='titleMedium'>播放器滑块</Text>
									<Text
										variant='bodySmall'
										style={{ color: colors.onSurfaceVariant }}
									>
										尺寸 {skinSliderThumbSize} · X {skinSliderThumbOffsetX} · Y{' '}
										{skinSliderThumbOffsetY}
									</Text>
								</View>
							</View>
							<SliderPreview
								thumbUri={activeSkin.sliderThumbs[activePlayIconIndex]?.normal}
								thumbSize={skinSliderThumbSize}
								offsetX={skinSliderThumbOffsetX}
								offsetY={skinSliderThumbOffsetY}
							/>
							<SliderControl
								label='尺寸'
								value={skinSliderThumbSize}
								minimumValue={12}
								maximumValue={36}
								onValueChange={(value) =>
									setSkinSettings({
										skinSliderThumbSize: Math.round(value),
									})
								}
							/>
							<SliderControl
								label='水平'
								value={skinSliderThumbOffsetX}
								minimumValue={-24}
								maximumValue={24}
								onValueChange={(value) =>
									setSkinSettings({
										skinSliderThumbOffsetX: Math.round(value),
									})
								}
							/>
							<SliderControl
								label='垂直'
								value={skinSliderThumbOffsetY}
								minimumValue={-24}
								maximumValue={24}
								onValueChange={(value) =>
									setSkinSettings({
										skinSliderThumbOffsetY: Math.round(value),
									})
								}
							/>
						</View>
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
	thumbUri?: string | null
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
				thumbImageUri={thumbUri ?? undefined}
				thumbImageSize={thumbUri ? thumbSize : undefined}
				thumbImageOffsetX={thumbUri ? offsetX : undefined}
				thumbImageOffsetY={thumbUri ? offsetY : undefined}
				incremental={false}
				onValueChange={(value) => {
					'worklet'
					progress.set(value)
				}}
			/>
		</View>
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

function localAssetUri(rootUri: string, path: string | null | undefined) {
	if (!path) return null
	if (/^(file|https?):\/\//.test(path)) return path
	return `${rootUri.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

type ThumbUpSpritePreview = NonNullable<AppSkin['thumbUpSprites']>[number]

function InstalledAssetSections({
	activeAvatarFrameIndex,
	activeLoadingIndex,
	activePlayIconIndex,
	activeSkinIndex,
	activeThumbUpIndex,
	onSelectAvatarFrame,
	onSelectLoading,
	onSelectPlayIcon,
	onSelectSkin,
	onSelectThumbUp,
	onDisableSkin,
	onDisablePlayIcon,
	onDisableThumbUp,
	onDisableLoading,
	onDisableAvatarFrame,
	skin,
	thumbUpSprites,
}: {
	activeAvatarFrameIndex: number
	activeLoadingIndex: number
	activePlayIconIndex: number
	activeSkinIndex: number
	activeThumbUpIndex: number
	onSelectAvatarFrame: (index: number) => void
	onSelectLoading: (index: number) => void
	onSelectPlayIcon: (index: number) => void
	onSelectSkin: (index: number) => void
	onSelectThumbUp: (index: number) => void
	onDisableSkin?: () => void
	onDisablePlayIcon?: () => void
	onDisableThumbUp?: () => void
	onDisableLoading?: () => void
	onDisableAvatarFrame?: () => void
	skin: InstalledSkinMeta
	thumbUpSprites: AppSkin['thumbUpSprites']
}) {
	const [assets, setAssets] = useState<SkinAssetDeclaration | null>(null)
	const { id, rootUri } = skin
	const skinRef = useRef(skin)
	skinRef.current = skin

	useEffect(() => {
		let cancelled = false
		void loadSkinAssets(skinRef.current).then((a) => {
			if (!cancelled) setAssets(a)
		})
		return () => {
			cancelled = true
		}
	}, [id, rootUri])

	if (!assets) return null

	const features = assetFeaturesFromManifest(assets)

	return (
		<View style={styles.installedAssets}>
			<AssetFeaturePanel features={features} />
			<AssetStrip
				title='应用主题'
				onDisable={onDisableSkin}
				disableActive={activeSkinIndex === -1}
				items={(assets?.skins ?? []).map((item, index) => ({
					id: `skin-${item.id}-${index}`,
					name: item.name ?? `主题 ${index + 1}`,
					onPress: () => onSelectSkin(index),
					selected: index === activeSkinIndex,
					uri: localAssetUri(rootUri, item.head_bg ?? item.tail_bg),
				}))}
			/>
			<AssetStrip
				title='滑块'
				onDisable={onDisablePlayIcon}
				disableActive={activePlayIconIndex === -1}
				items={(assets?.play_icons ?? []).map((item, index) => ({
					id: `play-icon-${item.id}-${index}`,
					name: item.name ?? `滑块 ${index + 1}`,
					onPress: () => onSelectPlayIcon(index),
					selected: index === activePlayIconIndex,
					uri: localAssetUri(
						rootUri,
						item.static_icon_image ?? item.middle_png,
					),
				}))}
				compact
			/>
			<AssetStrip
				title='点赞动画'
				onDisable={onDisableThumbUp}
				disableActive={activeThumbUpIndex === -1}
				items={(assets?.thumbups ?? []).map((item, index) => ({
					id: `thumbup-${item.id}-${index}`,
					name: item.name ?? `点赞动画 ${index + 1}`,
					onPress: () => onSelectThumbUp(index),
					selected: index === activeThumbUpIndex,
					sprite: normalizeThumbUpSprite(rootUri, thumbUpSprites?.[index]),
					uri: null,
				}))}
				compact
			/>
			<AssetStrip
				title='刷新动画'
				onDisable={onDisableLoading}
				disableActive={activeLoadingIndex === -1}
				items={(assets?.loadings ?? []).map((item, index) => ({
					id: `loading-${item.id}-${index}`,
					name: item.name ?? `刷新动画 ${index + 1}`,
					onPress: () => onSelectLoading(index),
					selected: index === activeLoadingIndex,
					uri: localAssetUri(rootUri, item.loading_frame_url),
				}))}
				compact
			/>
			<AssetStrip
				title='头像框'
				onDisable={onDisableAvatarFrame}
				disableActive={activeAvatarFrameIndex === -1}
				items={(assets?.avatar_frames ?? []).map((item, index) => ({
					id: `avatar-${item.id}-${index}`,
					name: item.name ?? `头像框 ${index + 1}`,
					onPress: () => onSelectAvatarFrame(index),
					selected: index === activeAvatarFrameIndex,
					uri: localAssetUri(rootUri, item.image),
				}))}
				compact
			/>
		</View>
	)
}

function AssetStrip({
	compact,
	disableActive,
	items,
	onDisable,
	title,
}: {
	compact?: boolean
	disableActive?: boolean
	items: Array<{
		id: string
		name: string
		onPress?: () => void
		selected?: boolean
		sprite?: ThumbUpSpritePreview | null
		uri: string | null
	}>
	onDisable?: () => void
	title: string
}) {
	const colors = useTheme().colors
	if (items.length === 0) return null

	return (
		<View style={styles.assetStrip}>
			<View style={styles.assetStripHeader}>
				<Text variant='titleSmall'>{title}</Text>
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
					<Text
						variant='bodySmall'
						style={{ color: colors.onSurfaceVariant }}
					>
						{items.length}
					</Text>
					{onDisable ? (
						<Pressable
							onPress={onDisable}
							disabled={disableActive}
							hitSlop={8}
						>
							<Icon
								source='trash-can-outline'
								size={18}
								color={disableActive ? colors.onSurfaceVariant : colors.error}
							/>
						</Pressable>
					) : null}
				</View>
			</View>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.assetStripContent}
			>
				{items.map((item) => (
					<Pressable
						key={item.id}
						style={compact ? styles.assetTileCompact : styles.assetTile}
						onPress={item.onPress}
					>
						<View
							style={[
								styles.assetTileImage,
								compact && styles.assetTileImageCompact,
								{
									backgroundColor: colors.surfaceVariant,
									borderColor: item.selected
										? colors.primary
										: colors.outlineVariant,
								},
							]}
						>
							{item.sprite ? (
								<ThumbUpSpriteFirstFrame sprite={item.sprite} />
							) : item.uri ? (
								<Image
									source={{ uri: item.uri }}
									style={StyleSheet.absoluteFill}
									contentFit='cover'
									cachePolicy='memory-disk'
								/>
							) : null}
							{item.selected ? (
								<View
									style={[
										styles.assetTileSelectedBadge,
										{ backgroundColor: colors.primary },
									]}
								>
									<Icon
										source='check'
										size={14}
										color={colors.onPrimary}
									/>
								</View>
							) : null}
						</View>
						<Text
							variant='bodySmall'
							numberOfLines={1}
							style={item.selected ? { color: colors.primary } : undefined}
						>
							{item.name}
						</Text>
					</Pressable>
				))}
			</ScrollView>
		</View>
	)
}

const THUMB_UP_PREVIEW_SIZE = 76

function normalizeThumbUpSprite(
	rootUri: string,
	sprite: ThumbUpSpritePreview | null | undefined,
): ThumbUpSpritePreview | null {
	if (!sprite) return null

	const spriteSheetUri =
		localAssetUri(rootUri, sprite.spriteSheetUri) ?? sprite.spriteSheetUri

	return {
		...sprite,
		spriteSheetUri,
	}
}

function ThumbUpSpriteFirstFrame({ sprite }: { sprite: ThumbUpSpritePreview }) {
	const frameCount = Math.floor(sprite.frameCount)
	const frameWidth = Math.floor(sprite.frameWidth)
	const frameHeight = Math.floor(sprite.frameHeight)
	const previewFrame = Math.floor(frameCount / 2) // 这个动画可能前几帧是空白的，咱们直接截取中间一个
	if (
		!sprite.spriteSheetUri ||
		frameCount <= 0 ||
		frameWidth <= 0 ||
		frameHeight <= 0
	) {
		return null
	}

	const aspectRatio = frameWidth / frameHeight
	const viewportWidth =
		aspectRatio >= 1
			? THUMB_UP_PREVIEW_SIZE
			: THUMB_UP_PREVIEW_SIZE * aspectRatio
	const viewportHeight =
		aspectRatio >= 1
			? THUMB_UP_PREVIEW_SIZE / aspectRatio
			: THUMB_UP_PREVIEW_SIZE

	return (
		<View style={styles.thumbUpSpritePreview}>
			<View
				style={[
					styles.thumbUpSpriteFrame,
					{
						height: viewportHeight,
						width: viewportWidth,
					},
				]}
			>
				<Image
					source={sprite.spriteSheetUri}
					style={{
						height: viewportHeight * frameCount,
						width: viewportWidth,
						transform: [{ translateY: -viewportHeight * previewFrame }],
					}}
					contentFit='fill'
					cachePolicy='memory-disk'
					recyclingKey={sprite.spriteSheetUri}
				/>
			</View>
		</View>
	)
}

function SliderControl({
	label,
	maximumValue,
	minimumValue,
	onValueChange,
	value,
}: {
	label: string
	maximumValue: number
	minimumValue: number
	onValueChange: (value: number) => void
	value: number
}) {
	const colors = useTheme().colors

	return (
		<View style={styles.sliderControlRow}>
			<View style={styles.sliderControlLabel}>
				<Text variant='bodyMedium'>{label}</Text>
				<Text
					variant='bodySmall'
					style={{ color: colors.onSurfaceVariant }}
				>
					{value}
				</Text>
			</View>
			<Slider
				style={styles.controlSlider}
				minimumValue={minimumValue}
				maximumValue={maximumValue}
				step={1}
				value={value}
				onValueChange={onValueChange}
			/>
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
	const [selectedMode, setSelectedMode] = useState<{
		assetId: string
		mode: 'poster' | 'video'
	} | null>(null)
	const player = useVideoPlayer(asset?.video ?? null, (video) => {
		video.loop = true
		video.muted = true
	})
	const mode =
		asset && selectedMode?.assetId === asset.id
			? selectedMode.mode
			: asset?.video
				? 'video'
				: 'poster'

	useEffect(() => {
		if (asset?.video) {
			player.replay()
		}
	}, [asset, player])

	return (
		<AnimatedModalOverlay
			visible={asset !== null}
			onDismiss={onDismiss}
		>
			{asset ? (
				<>
					<Dialog.Title>{asset.name}</Dialog.Title>
					<Dialog.Content>
						{asset.video ? (
							<View style={styles.segmentedControlContainer}>
								<SegmentedControl
									selectedIndex={mode === 'poster' ? 0 : 1}
									onChange={(event) => {
										const selectedIndex = event.nativeEvent.selectedSegmentIndex
										setSelectedMode({
											assetId: asset.id,
											mode: selectedIndex === 0 ? 'poster' : 'video',
										})
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
								asset.card ? (
									<Image
										source={asset.card}
										style={styles.previewMedia}
										contentFit='contain'
										cachePolicy='memory-disk'
									/>
								) : null
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
					</Dialog.Content>
					<Dialog.Actions>
						<Button
							mode='outlined'
							onPress={onDismiss}
						>
							取消
						</Button>
						<Button onPress={() => onSelect(asset, mode)}>
							使用该{mode === 'poster' ? '海报' : '视频'}
						</Button>
					</Dialog.Actions>
				</>
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
	iconAction: {
		width: 34,
		height: 34,
		alignItems: 'center',
		justifyContent: 'center',
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
	installedAssets: {
		gap: 14,
		marginBottom: 18,
	},
	assetStrip: {
		gap: 8,
	},
	assetStripHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	assetStripContent: {
		gap: 10,
		paddingRight: 8,
	},
	assetTile: {
		width: 92,
		gap: 6,
	},
	assetTileCompact: {
		width: 76,
		gap: 6,
	},
	assetTileImage: {
		width: '100%',
		aspectRatio: 522 / 696,
		borderWidth: 2,
		borderRadius: 8,
		overflow: 'hidden',
	},
	assetTileImageCompact: {
		aspectRatio: 1,
	},
	thumbUpSpritePreview: {
		...StyleSheet.absoluteFill,
		alignItems: 'center',
		justifyContent: 'center',
	},
	thumbUpSpriteFrame: {
		overflow: 'hidden',
	},
	assetTileSelectedBadge: {
		position: 'absolute',
		right: 5,
		top: 5,
		width: 20,
		height: 20,
		borderRadius: 10,
		alignItems: 'center',
		justifyContent: 'center',
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
	sliderPanel: {
		borderRadius: 8,
		padding: 14,
	},
	sliderControlRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		marginTop: 10,
	},
	sliderControlLabel: {
		width: 46,
	},
	controlSlider: {
		flex: 1,
	},
	sliderPreview: {
		height: 54,
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
