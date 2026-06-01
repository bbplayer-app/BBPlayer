import { extractSvgaBinFramesAsync } from '@bbplayer/native'
import * as FileSystem from 'expo-file-system'

import type {
	CardAsset,
	GarbSkinSearchResult,
	ThumbupAsset,
	UnifiedAssetManifest,
	UnifiedAssets,
} from '@/lib/api/bilibili/garb'
import { buildGarbAssetManifest } from '@/lib/api/bilibili/garb'
import type {
	InstalledSkin,
	InstalledSkinBootSplashAsset,
	SkinAssetFeatures,
} from '@/lib/theme/skins'

interface InstallSkinPackageOptions {
	item: GarbSkinSearchResult
	onProgress?: (progress: SkinDownloadProgress) => void
}

export interface SkinDownloadProgress {
	progress: number
	completed: number
	total: number
	label: string
}

const SEMANTIC_SKIN_ROOT = 'skins'
const TEMP_SKIN_DOWNLOAD_ROOT = 'skin-download'
export const BILI_ASSET_MANIFEST_FILE = 'bili-assets.json'

const sanitizeSegment = (value: string): string =>
	value
		.trim()
		.replace(/[^A-Za-z0-9._-]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80)

const ensureDirectory = (directory: FileSystem.Directory) => {
	if (directory.exists) return

	try {
		directory.create({ idempotent: true, intermediates: true })
	} catch (error) {
		if (!directory.exists) {
			throw error
		}
	}
}

const ensureCleanDirectory = (directory: FileSystem.Directory) => {
	if (directory.exists) {
		directory.delete()
	}
	ensureDirectory(directory)
}

const extensionFromUrl = (url: string, fallback: string) => {
	try {
		const pathname = new URL(url).pathname
		const extension = pathname.match(/\.[A-Za-z0-9]+$/)?.[0]
		return extension?.toLowerCase() ?? fallback
	} catch {
		return fallback
	}
}

const isRemoteUrl = (value: string | null | undefined): value is string =>
	!!value && /^https?:\/\//.test(value)

const downloadFile = async (
	root: FileSystem.Directory,
	url: string | null | undefined,
	localPath: string,
	onDownloaded?: (label: string) => void,
) => {
	if (!isRemoteUrl(url)) return null

	const file = new FileSystem.File(root, localPath)
	try {
		ensureDirectory(file.parentDirectory)
		await FileSystem.File.downloadFileAsync(url, file, { idempotent: true })
		onDownloaded?.(localPath)
		return localPath
	} catch {
		onDownloaded?.(`跳过 ${localPath}`)
		return null
	}
}

const writeManifest = (
	root: FileSystem.Directory,
	manifest: UnifiedAssetManifest,
) => {
	const file = new FileSystem.File(root, BILI_ASSET_MANIFEST_FILE)
	file.write(JSON.stringify(manifest, null, 2))
	return file.uri
}

const featureMap = (manifest: UnifiedAssetManifest): SkinAssetFeatures => ({
	cards: !!manifest.features?.cards,
	redeems: !!manifest.features?.redeems,
	skin: !!manifest.features?.skin,
	playIcon: !!manifest.features?.play_icon,
	loading: !!manifest.features?.loading,
	emojiPackage: !!manifest.features?.emoji_package,
	thumbup: !!manifest.features?.thumbup,
	spaceBg: !!manifest.features?.space_bg,
	card: !!manifest.features?.card,
	cardBg: !!manifest.features?.card_bg,
})

const createBootSplashAssets = (
	assets: UnifiedAssets,
	localAssets: Partial<UnifiedAssets>,
): InstalledSkinBootSplashAsset[] => {
	if (localAssets.cards?.length) {
		return localAssets.cards
			.map((card, index) => ({
				id: `card-${index}`,
				name: assets.cards?.[index]?.name ?? `卡牌 ${index + 1}`,
				cardPath: card.image_no_watermark ?? card.image_watermark ?? '',
				videoPath:
					card.video_no_watermark[0] ?? card.video_watermark[0] ?? null,
			}))
			.filter((item) => item.cardPath)
	}

	if (localAssets.space_bg?.length) {
		return localAssets.space_bg
			.map((spaceBg, index) => ({
				id: `space-bg-${index}`,
				name: `空间海报 ${index + 1}`,
				cardPath: spaceBg.portrait ?? spaceBg.landscape ?? '',
				videoPath: spaceBg.portrait_video ?? spaceBg.landscape_video ?? null,
			}))
			.filter((item) => item.cardPath)
	}

	return []
}

const countRemoteFiles = (value: unknown): number => {
	if (typeof value === 'string') return isRemoteUrl(value) ? 1 : 0
	if (Array.isArray(value)) {
		return value.reduce((sum, item) => sum + countRemoteFiles(item), 0)
	}
	if (typeof value === 'object' && value !== null) {
		return Object.values(value).reduce(
			(sum, item) => sum + countRemoteFiles(item),
			0,
		)
	}
	return 0
}

const countSemanticFiles = (assets: UnifiedAssets): number =>
	[
		assets.skin?.head_bg,
		assets.skin?.head_tab_bg,
		assets.skin?.head_myself_bg,
		assets.skin?.head_myself_squared_bg,
		assets.skin?.head_myself_mp4_bg,
		assets.skin?.side_bg,
		assets.skin?.side_bg_bottom,
		assets.skin?.tail_bg,
		assets.skin?.tail_icon_main,
		assets.skin?.tail_icon_channel,
		assets.skin?.tail_icon_dynamic,
		assets.skin?.tail_icon_shop,
		assets.skin?.tail_icon_myself,
		assets.skin?.tail_icon_pub_btn_bg,
		assets.skin?.tail_icon_selected_main,
		assets.skin?.tail_icon_selected_channel,
		assets.skin?.tail_icon_selected_dynamic,
		assets.skin?.tail_icon_selected_shop,
		assets.skin?.tail_icon_selected_myself,
		assets.play_icon?.drag_left_png,
		assets.play_icon?.drag_right_png,
		assets.play_icon?.middle_png,
		assets.play_icon?.static_icon_image,
		assets.play_icon?.squared_image,
		assets.loading?.loading_url,
		assets.loading?.loading_frame_url,
		assets.loading?.preview,
		assets.thumbup?.ani_file,
		assets.thumbup?.ani_cut,
		assets.thumbup?.preview,
		...(assets.cards ?? []).flatMap((card) => [
			card.image_no_watermark,
			...card.video_no_watermark,
		]),
		...(assets.space_bg ?? []).flatMap((spaceBg) => [
			spaceBg.landscape,
			spaceBg.portrait,
			spaceBg.landscape_video,
			spaceBg.portrait_video,
		]),
	].filter(isRemoteUrl).length

const makeProgress = (
	total: number,
	onProgress?: (progress: SkinDownloadProgress) => void,
) => {
	let completed = 0
	return (label: string) => {
		completed += 1
		onProgress?.({
			progress: total > 0 ? Math.min(1, completed / total) : 0,
			completed,
			total,
			label,
		})
	}
}

const rawAssetPath = (path: string, url: string) =>
	`raw_assets/${path.replace(/[^A-Za-z0-9._/-]+/g, '_')}${extensionFromUrl(url, '.bin')}`

const downloadRawAssets = async (
	root: FileSystem.Directory,
	value: unknown,
	path: string,
	downloadedFiles: Record<string, string>,
	onDownloaded: (label: string) => void,
) => {
	if (typeof value === 'string') {
		if (!isRemoteUrl(value)) return

		const localPath = rawAssetPath(path, value)
		const downloadedPath = await downloadFile(
			root,
			value,
			localPath,
			onDownloaded,
		)
		if (downloadedPath) {
			downloadedFiles[path] = downloadedPath
		}
		return
	}

	if (Array.isArray(value)) {
		for (const [index, item] of value.entries()) {
			await downloadRawAssets(
				root,
				item,
				`${path}/${index}`,
				downloadedFiles,
				onDownloaded,
			)
		}
		return
	}

	if (typeof value === 'object' && value !== null) {
		for (const [key, item] of Object.entries(value)) {
			await downloadRawAssets(
				root,
				item,
				`${path}/${key}`,
				downloadedFiles,
				onDownloaded,
			)
		}
	}
}

const downloadSkinAssets = async (
	root: FileSystem.Directory,
	assets: UnifiedAssets,
	localAssets: Partial<UnifiedAssets>,
	onDownloaded: (label: string) => void,
) => {
	if (!assets.skin) return

	localAssets.skin = {
		...assets.skin,
		head_bg: await downloadFile(
			root,
			assets.skin.head_bg,
			'skin/head_bg.jpg',
			onDownloaded,
		),
		head_tab_bg: await downloadFile(
			root,
			assets.skin.head_tab_bg,
			'skin/head_tab_bg.png',
			onDownloaded,
		),
		head_myself_bg: await downloadFile(
			root,
			assets.skin.head_myself_bg,
			'skin/head_myself_bg.jpg',
			onDownloaded,
		),
		head_myself_squared_bg: await downloadFile(
			root,
			assets.skin.head_myself_squared_bg,
			'skin/head_myself_squared_bg.jpg',
			onDownloaded,
		),
		head_myself_mp4_bg: await downloadFile(
			root,
			assets.skin.head_myself_mp4_bg,
			'skin/head_myself_mp4_bg.mp4',
			onDownloaded,
		),
		side_bg: await downloadFile(
			root,
			assets.skin.side_bg,
			'skin/side_bg.png',
			onDownloaded,
		),
		side_bg_bottom: await downloadFile(
			root,
			assets.skin.side_bg_bottom,
			'skin/side_bg_bottom.png',
			onDownloaded,
		),
		tail_bg: await downloadFile(
			root,
			assets.skin.tail_bg,
			'skin/tail_bg.png',
			onDownloaded,
		),
		tail_icon_main: await downloadFile(
			root,
			assets.skin.tail_icon_main,
			'skin/tail_icon_main.png',
			onDownloaded,
		),
		tail_icon_channel: await downloadFile(
			root,
			assets.skin.tail_icon_channel,
			'skin/tail_icon_channel.png',
			onDownloaded,
		),
		tail_icon_dynamic: await downloadFile(
			root,
			assets.skin.tail_icon_dynamic,
			'skin/tail_icon_dynamic.png',
			onDownloaded,
		),
		tail_icon_shop: await downloadFile(
			root,
			assets.skin.tail_icon_shop,
			'skin/tail_icon_shop.png',
			onDownloaded,
		),
		tail_icon_myself: await downloadFile(
			root,
			assets.skin.tail_icon_myself,
			'skin/tail_icon_myself.png',
			onDownloaded,
		),
		tail_icon_pub_btn_bg: await downloadFile(
			root,
			assets.skin.tail_icon_pub_btn_bg,
			'skin/tail_icon_pub_btn_bg.png',
			onDownloaded,
		),
		tail_icon_selected_main: await downloadFile(
			root,
			assets.skin.tail_icon_selected_main,
			'skin/tail_icon_selected_main.png',
			onDownloaded,
		),
		tail_icon_selected_channel: await downloadFile(
			root,
			assets.skin.tail_icon_selected_channel,
			'skin/tail_icon_selected_channel.png',
			onDownloaded,
		),
		tail_icon_selected_dynamic: await downloadFile(
			root,
			assets.skin.tail_icon_selected_dynamic,
			'skin/tail_icon_selected_dynamic.png',
			onDownloaded,
		),
		tail_icon_selected_shop: await downloadFile(
			root,
			assets.skin.tail_icon_selected_shop,
			'skin/tail_icon_selected_shop.png',
			onDownloaded,
		),
		tail_icon_selected_myself: await downloadFile(
			root,
			assets.skin.tail_icon_selected_myself,
			'skin/tail_icon_selected_myself.png',
			onDownloaded,
		),
	}
}

const downloadPlayIconAssets = async (
	root: FileSystem.Directory,
	assets: UnifiedAssets,
	localAssets: Partial<UnifiedAssets>,
	onDownloaded: (label: string) => void,
) => {
	if (!assets.play_icon) return

	localAssets.play_icon = {
		...assets.play_icon,
		drag_left_png: await downloadFile(
			root,
			assets.play_icon.drag_left_png,
			'play_icon/drag_left.png',
			onDownloaded,
		),
		drag_right_png: await downloadFile(
			root,
			assets.play_icon.drag_right_png,
			'play_icon/drag_right.png',
			onDownloaded,
		),
		middle_png: await downloadFile(
			root,
			assets.play_icon.middle_png,
			'play_icon/middle.png',
			onDownloaded,
		),
		static_icon_image: await downloadFile(
			root,
			assets.play_icon.static_icon_image,
			'play_icon/static_icon_image.png',
			onDownloaded,
		),
		squared_image: await downloadFile(
			root,
			assets.play_icon.squared_image,
			'play_icon/squared_image.png',
			onDownloaded,
		),
	}
}

const downloadLoadingAssets = async (
	root: FileSystem.Directory,
	assets: UnifiedAssets,
	localAssets: Partial<UnifiedAssets>,
	onDownloaded: (label: string) => void,
) => {
	if (!assets.loading) return

	localAssets.loading = {
		loading_url: await downloadFile(
			root,
			assets.loading.loading_url,
			'loading/loading.png',
			onDownloaded,
		),
		loading_frame_url: await downloadFile(
			root,
			assets.loading.loading_frame_url,
			'loading/loading_frame.png',
			onDownloaded,
		),
		preview: await downloadFile(
			root,
			assets.loading.preview,
			'loading/preview.png',
			onDownloaded,
		),
	}
}

const downloadThumbupAssets = async (
	root: FileSystem.Directory,
	assets: UnifiedAssets,
	localAssets: Partial<UnifiedAssets>,
	onDownloaded: (label: string) => void,
) => {
	if (!assets.thumbup) return null

	const localThumbup: ThumbupAsset = {
		ani_file: await downloadFile(
			root,
			assets.thumbup.ani_file,
			'thumbup/image_ani.bin',
			onDownloaded,
		),
		ani_cut: await downloadFile(
			root,
			assets.thumbup.ani_cut,
			'thumbup/image_ani_cut.bin',
			onDownloaded,
		),
		preview: await downloadFile(
			root,
			assets.thumbup.preview,
			'thumbup/image_preview.png',
			onDownloaded,
		),
	}
	localAssets.thumbup = localThumbup

	if (!localThumbup.ani_file) return null

	return extractSvgaBinFramesAsync({
		inputUri: new FileSystem.File(root, localThumbup.ani_file).uri,
		outputDirectoryUri: new FileSystem.Directory(root, 'thumbup', 'frames').uri,
	})
}

const downloadCards = async (
	root: FileSystem.Directory,
	cards: CardAsset[] | null,
	onDownloaded: (label: string) => void,
) => {
	if (!cards?.length) return null

	const localCards: CardAsset[] = []
	for (const [index, card] of cards.entries()) {
		const prefix = `cards/${String(index).padStart(2, '0')}`
		const videoNoWatermark: string[] = []
		for (const [videoIndex, video] of card.video_no_watermark.entries()) {
			const path = await downloadFile(
				root,
				video,
				`${prefix}/video_no_watermark_${videoIndex}.mp4`,
				onDownloaded,
			)
			if (path) videoNoWatermark.push(path)
		}

		localCards.push({
			...card,
			image_no_watermark: await downloadFile(
				root,
				card.image_no_watermark,
				`${prefix}/image_no_watermark${extensionFromUrl(card.image_no_watermark ?? '', '.png')}`,
				onDownloaded,
			),
			image_watermark: null,
			video_no_watermark: videoNoWatermark,
			video_watermark: [],
		})
	}

	return localCards
}

const downloadOtherAssetGroups = async (
	root: FileSystem.Directory,
	assets: UnifiedAssets,
	localAssets: Partial<UnifiedAssets>,
	onDownloaded: (label: string) => void,
) => {
	localAssets.cards = await downloadCards(root, assets.cards, onDownloaded)

	if (assets.space_bg?.length) {
		localAssets.space_bg = []
		for (const [index, spaceBg] of assets.space_bg.entries()) {
			localAssets.space_bg.push({
				landscape: await downloadFile(
					root,
					spaceBg.landscape,
					`space_bg/${index}/landscape.jpg`,
					onDownloaded,
				),
				portrait: await downloadFile(
					root,
					spaceBg.portrait,
					`space_bg/${index}/portrait.jpg`,
					onDownloaded,
				),
				landscape_video: await downloadFile(
					root,
					spaceBg.landscape_video,
					`space_bg/${index}/landscape.mp4`,
					onDownloaded,
				),
				portrait_video: await downloadFile(
					root,
					spaceBg.portrait_video,
					`space_bg/${index}/portrait.mp4`,
					onDownloaded,
				),
			})
		}
	}
}

const downloadManifestAssets = async (
	root: FileSystem.Directory,
	manifest: UnifiedAssetManifest,
	onProgress?: (progress: SkinDownloadProgress) => void,
) => {
	const totalRemoteFiles =
		countRemoteFiles(manifest.assets) + countSemanticFiles(manifest.assets)
	const onDownloaded = makeProgress(totalRemoteFiles, onProgress)
	const localAssets: Partial<UnifiedAssets> = {}
	const downloadedFiles: Record<string, string> = {}

	await downloadRawAssets(
		root,
		manifest.assets,
		'assets',
		downloadedFiles,
		onDownloaded,
	)
	await downloadSkinAssets(root, manifest.assets, localAssets, onDownloaded)
	await downloadPlayIconAssets(root, manifest.assets, localAssets, onDownloaded)
	await downloadLoadingAssets(root, manifest.assets, localAssets, onDownloaded)
	const frames = await downloadThumbupAssets(
		root,
		manifest.assets,
		localAssets,
		onDownloaded,
	)
	await downloadOtherAssetGroups(
		root,
		manifest.assets,
		localAssets,
		onDownloaded,
	)

	return {
		downloadedFiles,
		localAssets,
		frames,
	}
}

export async function installSkinPackage({
	item,
	onProgress,
}: InstallSkinPackageOptions): Promise<InstalledSkin> {
	const skinId = `garb-${item.kind ?? 'unknown'}-${
		item.kind === 'collection' ? item.actId : item.itemId
	}-${sanitizeSegment(item.name) || 'skin'}`
	const tempDirectory = new FileSystem.Directory(
		FileSystem.Paths.cache,
		TEMP_SKIN_DOWNLOAD_ROOT,
		skinId,
	)
	const installDirectory = new FileSystem.Directory(
		FileSystem.Paths.document,
		SEMANTIC_SKIN_ROOT,
		skinId,
	)

	ensureCleanDirectory(tempDirectory)
	ensureCleanDirectory(installDirectory)

	onProgress?.({
		progress: 0,
		completed: 0,
		total: 0,
		label: '读取 B 站资产清单',
	})
	const manifest = await buildGarbAssetManifest(item)
	const { downloadedFiles, frames, localAssets } = await downloadManifestAssets(
		installDirectory,
		manifest,
		onProgress,
	)
	const completedManifest: UnifiedAssetManifest = {
		...manifest,
		downloadedFiles,
		localAssets,
	}
	const assetManifestPath = writeManifest(installDirectory, completedManifest)
	onProgress?.({
		progress: 1,
		completed: 1,
		total: 1,
		label: '写入资产声明文件',
	})
	const bootSplashAssets = createBootSplashAssets(manifest.assets, localAssets)

	return {
		id: skinId,
		name: item.name,
		rootUri: installDirectory.uri,
		coverUri: item.coverUri,
		downloadedAt: Date.now(),
		assetManifestPath,
		assetFeatures: featureMap(manifest),
		bootSplashAssets,
		thumbUpFrameCount: frames?.frames ?? 0,
		thumbUpFrameFps: frames?.fps,
		thumbUpFrameSize: frames?.width,
	}
}
