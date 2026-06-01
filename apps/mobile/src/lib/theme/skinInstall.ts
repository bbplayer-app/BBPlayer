import { convertSvgaBinToGifAsync, unzipAsync } from '@bbplayer/native'
import * as FileSystem from 'expo-file-system'
import { Platform } from 'react-native'

import type { GarbSkinSearchResult } from '@/lib/api/bilibili/garb'
import { fetchGarbSkinAssetDeclaration } from '@/lib/api/bilibili/garb'
import {
	createSkinAssetFeatures,
	parseSkinAssetDeclaration,
	skinRelativeUri,
	type InstalledSkin,
	type InstalledSkinPackageDirectory,
	type InstalledSkinThumbUpGif,
	type SkinAssetDeclaration,
} from '@/lib/theme/skins'

export interface SkinDownloadProgress {
	completed: number
	label: string
	progress: number
	total: number
}

interface InstallSkinPackageOptions {
	item: GarbSkinSearchResult
	onProgress?: (progress: SkinDownloadProgress) => void
	signal?: AbortSignal
}

interface RemoteAssetDownload {
	path: string
	url: string
}

const SKIN_DIRECTORY_NAME = 'skins'
const TEMP_SUFFIX = '.tmp'
const DOWNLOAD_HEADERS = {
	Referer: 'https://www.bilibili.com/',
	'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null

const isRemoteUrl = (value: unknown): value is string =>
	typeof value === 'string' && /^https?:\/\//.test(value)

const sourceId = (item: GarbSkinSearchResult) => {
	if (item.kind === 'collection' && item.actId && item.lotteryId) {
		return `collection-${item.actId}-${item.lotteryId}`
	}
	if (item.kind === 'suit' && item.itemId) {
		return `suit-${item.itemId}`
	}
	return null
}

const sanitizePathPart = (part: string | number) => {
	const value = String(part)
		.replaceAll(/[^A-Za-z0-9._-]+/g, '_')
		.replaceAll(/^_+|_+$/g, '')
	return value || 'asset'
}

const sanitizeDirectoryName = (value: string) =>
	value.replaceAll(/[^A-Za-z0-9._-]+/g, '_')

const extensionFromUrl = (url: string, fallback = '.bin') => {
	try {
		const pathname = new URL(url).pathname
		const match = pathname.match(
			/\.(png|jpe?g|webp|gif|bin|zip|mp4|json)(?=$|[.@])/i,
		)
		return match?.[0].toLowerCase() ?? fallback
	} catch {
		return fallback
	}
}

const relativePathForRemoteAsset = (
	path: Array<number | string>,
	url: string,
	usedPaths: Set<string>,
) => {
	const extension = extensionFromUrl(url)
	const base = path.map(sanitizePathPart).join('/') || 'asset'
	let candidate = `assets/${base}${extension}`
	let index = 1

	while (usedPaths.has(candidate)) {
		candidate = `assets/${base}-${index}${extension}`
		index += 1
	}

	usedPaths.add(candidate)
	return candidate
}

const localizeRemoteAssets = (
	value: unknown,
	path: Array<number | string> = [],
	downloads: RemoteAssetDownload[] = [],
	urlToPath = new Map<string, string>(),
	usedPaths = new Set<string>(),
): unknown => {
	if (isRemoteUrl(value)) {
		const existingPath = urlToPath.get(value)
		if (existingPath) return existingPath

		const localPath = relativePathForRemoteAsset(path, value, usedPaths)
		urlToPath.set(value, localPath)
		downloads.push({ path: localPath, url: value })
		return localPath
	}

	if (Array.isArray(value)) {
		return value.map((item, index) =>
			localizeRemoteAssets(
				item,
				[...path, index],
				downloads,
				urlToPath,
				usedPaths,
			),
		)
	}

	if (isRecord(value)) {
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [
				key,
				localizeRemoteAssets(
					item,
					[...path, key],
					downloads,
					urlToPath,
					usedPaths,
				),
			]),
		)
	}

	return value
}

const createDownloadPlan = (assets: SkinAssetDeclaration) => {
	const downloads: RemoteAssetDownload[] = []
	const assetsWithFirstCardVideo = {
		...assets,
		cards: assets.cards.map((card) => ({
			...card,
			video_list: card.video_list ? card.video_list.slice(0, 1) : null,
		})),
	}
	const localized = localizeRemoteAssets(
		assetsWithFirstCardVideo,
		[],
		downloads,
	)
	return {
		downloads,
		localAssets: parseSkinAssetDeclaration(localized),
	}
}

const ensureDirectory = (directory: FileSystem.Directory) => {
	if (!directory.exists) {
		directory.create({ idempotent: true, intermediates: true })
	}
}

const fileForRelativePath = (
	rootDirectory: FileSystem.Directory,
	relativePath: string,
) => {
	const parts = relativePath.split('/').filter(Boolean)
	const fileName = parts.at(-1)
	if (!fileName) throw new Error(`无效的装扮资产路径：${relativePath}`)

	const parentDirectory =
		parts.length > 1
			? new FileSystem.Directory(rootDirectory, ...parts.slice(0, -1))
			: rootDirectory
	ensureDirectory(parentDirectory)
	return new FileSystem.File(parentDirectory, fileName)
}

const downloadRemoteAsset = async (
	rootDirectory: FileSystem.Directory,
	asset: RemoteAssetDownload,
	signal?: AbortSignal,
) => {
	const file = fileForRelativePath(rootDirectory, asset.path)
	if (file.exists) {
		file.delete()
	}

	await FileSystem.File.downloadFileAsync(asset.url, file, {
		headers: DOWNLOAD_HEADERS,
		idempotent: true,
		signal,
	})
}

const packageTasksFor = (assets: SkinAssetDeclaration) =>
	assets.skins.flatMap((skin, index) => {
		if (!skin.package_url) return []
		return {
			index,
			localPath: skin.package_url,
			skinId: skin.id,
		}
	})

const unzipSkinPackages = async ({
	assets,
	emitProgress,
	onTaskCompleted,
	rootDirectory,
}: {
	assets: SkinAssetDeclaration
	emitProgress: (label: string) => void
	onTaskCompleted: () => void
	rootDirectory: FileSystem.Directory
}) => {
	if (Platform.OS !== 'android') return []

	const directories: InstalledSkinPackageDirectory[] = []
	for (const task of packageTasksFor(assets)) {
		const inputUri = `${rootDirectory.uri.replace(/\/+$/, '')}/${task.localPath.replace(/^\/+/, '')}`
		const directoryPath = `packages/skin-${String(task.index).padStart(2, '0')}`
		const outputDirectory = new FileSystem.Directory(
			rootDirectory,
			directoryPath,
		)
		emitProgress(`解压 ${assets.skins[task.index]?.name ?? '皮肤包'}`)
		const result = await unzipAsync({
			inputUri,
			outputUri: outputDirectory.uri,
		})
		directories.push({
			directoryPath,
			fileCount: result.fileCount,
			skinId: task.skinId,
		})
		onTaskCompleted()
	}

	return directories
}

const thumbUpTasksFor = (assets: SkinAssetDeclaration) =>
	assets.thumbups.flatMap((thumbUp, index) => {
		if (!thumbUp.ani_file) return []
		return {
			index,
			inputPath: thumbUp.ani_file,
			name: thumbUp.name,
		}
	})

const convertThumbUpsToGifs = async ({
	assets,
	emitProgress,
	onTaskCompleted,
	rootDirectory,
}: {
	assets: SkinAssetDeclaration
	emitProgress: (label: string) => void
	onTaskCompleted: () => void
	rootDirectory: FileSystem.Directory
}) => {
	if (Platform.OS !== 'android') return []

	const gifs: Array<InstalledSkinThumbUpGif | null> = Array.from(
		{ length: assets.thumbups.length },
		() => null,
	)
	for (const task of thumbUpTasksFor(assets)) {
		const inputUri = `${rootDirectory.uri.replace(/\/+$/, '')}/${task.inputPath.replace(/^\/+/, '')}`
		const gifPath = `thumbups/${String(task.index).padStart(2, '0')}/thumbup.gif`
		const outputFile = fileForRelativePath(rootDirectory, gifPath)
		if (outputFile.exists) {
			outputFile.delete()
		}
		emitProgress(`转换 ${task.name ?? '点赞动画'}`)
		const result = await convertSvgaBinToGifAsync({
			height: 96,
			inputUri,
			outputUri: outputFile.uri,
			width: 96,
		})
		gifs[task.index] = {
			durationMs: Math.round((result.frames / Math.max(1, result.fps)) * 1000),
			path: gifPath,
		}
		onTaskCompleted()
	}

	return gifs
}

const firstCoverPath = (assets: SkinAssetDeclaration) =>
	assets.skins[0]?.image_cover ??
	assets.skins[0]?.image_preview ??
	assets.cards[0]?.img ??
	assets.space_backgrounds[0]?.images[0]?.portrait ??
	assets.space_backgrounds[0]?.images[0]?.landscape ??
	assets.skins[0]?.head_bg ??
	null

const createInstalledSkin = ({
	assets,
	item,
	packageDirectories,
	rootUri,
	thumbUpGifs,
}: {
	assets: SkinAssetDeclaration
	item: GarbSkinSearchResult
	packageDirectories: InstalledSkinPackageDirectory[]
	rootUri: string
	thumbUpGifs: Array<InstalledSkinThumbUpGif | null>
}): InstalledSkin => {
	const id = sourceId(item)
	if (!id) throw new Error('装扮安装源缺少有效 ID')

	const installed: InstalledSkin = {
		assetFeatures: createSkinAssetFeatures(assets),
		coverUri: null,
		id,
		installedAt: Date.now(),
		localAssets: assets,
		name: assets.name,
		packageDirectories,
		rootUri,
		source:
			item.kind === 'collection'
				? {
						actId: item.actId ?? 0,
						kind: 'collection',
						lotteryId: item.lotteryId ?? 0,
					}
				: {
						itemId: item.itemId ?? 0,
						kind: 'suit',
					},
		thumbUpGifs,
	}

	installed.coverUri = skinRelativeUri(installed, firstCoverPath(assets))
	return installed
}

const writeJsonFile = (
	rootDirectory: FileSystem.Directory,
	name: string,
	value: unknown,
) => {
	const file = new FileSystem.File(rootDirectory, name)
	if (file.exists) {
		file.delete()
	}
	file.write(`${JSON.stringify(value, null, 2)}\n`)
}

export const installSkinPackage = async ({
	item,
	onProgress,
	signal,
}: InstallSkinPackageOptions): Promise<InstalledSkin> => {
	const id = sourceId(item)
	if (!id) throw new Error('当前搜索结果无法安装为装扮')

	onProgress?.({
		completed: 0,
		label: '正在获取资产清单',
		progress: 0,
		total: 0,
	})

	const remoteAssets = await fetchGarbSkinAssetDeclaration(item, signal)
	const { downloads, localAssets } = createDownloadPlan(remoteAssets)
	const packageTaskCount =
		Platform.OS === 'android' ? packageTasksFor(localAssets).length : 0
	const thumbUpTaskCount =
		Platform.OS === 'android' ? thumbUpTasksFor(localAssets).length : 0
	const total = downloads.length + packageTaskCount + thumbUpTaskCount
	let completed = 0

	const emitProgress = (label: string) => {
		onProgress?.({
			completed,
			label,
			progress: total > 0 ? completed / total : 0,
			total,
		})
	}

	const rootDirectory = new FileSystem.Directory(
		FileSystem.Paths.document,
		SKIN_DIRECTORY_NAME,
	)
	ensureDirectory(rootDirectory)

	const installDirectoryName = sanitizeDirectoryName(id)
	const tempDirectory = new FileSystem.Directory(
		rootDirectory,
		`${installDirectoryName}${TEMP_SUFFIX}`,
	)
	const finalDirectory = new FileSystem.Directory(
		rootDirectory,
		installDirectoryName,
	)

	if (tempDirectory.exists) {
		tempDirectory.delete()
	}
	tempDirectory.create({ intermediates: true })

	try {
		for (const download of downloads) {
			emitProgress(`下载 ${download.path.split('/').at(-1) ?? '资产'}`)
			await downloadRemoteAsset(tempDirectory, download, signal)
			completed += 1
			emitProgress(`已下载 ${download.path.split('/').at(-1) ?? '资产'}`)
		}

		const packageDirectories = await unzipSkinPackages({
			assets: localAssets,
			emitProgress,
			onTaskCompleted: () => {
				completed += 1
				emitProgress('已解压皮肤包')
			},
			rootDirectory: tempDirectory,
		})
		const thumbUpGifs = await convertThumbUpsToGifs({
			assets: localAssets,
			emitProgress,
			onTaskCompleted: () => {
				completed += 1
				emitProgress('已转换点赞动画')
			},
			rootDirectory: tempDirectory,
		})

		const installedSkin = createInstalledSkin({
			assets: localAssets,
			item,
			packageDirectories,
			rootUri: finalDirectory.uri,
			thumbUpGifs,
		})

		writeJsonFile(tempDirectory, 'installed-skin.json', installedSkin)

		if (finalDirectory.exists) {
			finalDirectory.delete()
		}
		await tempDirectory.move(finalDirectory)

		onProgress?.({
			completed: total,
			label: '下载完成',
			progress: 1,
			total: Math.max(1, total),
		})

		return installedSkin
	} catch (error) {
		if (tempDirectory.exists) {
			tempDirectory.delete()
		}
		throw error
	}
}

export const deleteInstalledSkinPackage = (skin: { rootUri: string }) => {
	const directory = new FileSystem.Directory(skin.rootUri)
	if (directory.exists) {
		directory.delete()
	}
}
