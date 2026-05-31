import { extractSvgaBinFramesAsync, unzipAsync } from '@bbplayer/native'
import * as FileSystem from 'expo-file-system'

import type { GarbSkinSearchResult } from '@/lib/api/bilibili/garb'
import type {
	InstalledSkin,
	InstalledSkinBootSplashAsset,
} from '@/lib/theme/skins'

interface InstallSkinPackageOptions {
	item: GarbSkinSearchResult
	packageUrl: string
	onProgress?: (progress: number) => void
}

const SEMANTIC_SKIN_ROOT = 'skins'
const TEMP_SKIN_DOWNLOAD_ROOT = 'skin-download'

const sanitizeSegment = (value: string): string =>
	value
		.trim()
		.replace(/[^A-Za-z0-9._-]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80)

const ensureCleanDirectory = (directory: FileSystem.Directory) => {
	if (directory.exists) {
		directory.delete()
	}
	directory.create({ idempotent: true, intermediates: true })
}

const ensureDirectory = (directory: FileSystem.Directory) => {
	directory.create({ idempotent: true, intermediates: true })
}

const listDirectory = (directory: FileSystem.Directory) =>
	directory.exists ? directory.list() : []

const isFile = (
	entry: FileSystem.Directory | FileSystem.File,
): entry is FileSystem.File => entry instanceof FileSystem.File

const isDirectory = (
	entry: FileSystem.Directory | FileSystem.File,
): entry is FileSystem.Directory => entry instanceof FileSystem.Directory

const findDirectoryWithChild = (
	root: FileSystem.Directory,
	childName: string,
	depth = 2,
): FileSystem.Directory | null => {
	for (const entry of listDirectory(root)) {
		if (!isDirectory(entry)) continue

		const child = new FileSystem.Directory(entry, childName)
		if (child.exists) return child

		if (depth > 0) {
			const nested = findDirectoryWithChild(entry, childName, depth - 1)
			if (nested) return nested
		}
	}

	return null
}

const lowerName = (file: FileSystem.File) => file.name.toLowerCase()

const findFileByPrefix = (
	directory: FileSystem.Directory | null,
	prefixes: string[],
	extensions: string[],
): FileSystem.File | null => {
	if (!directory?.exists) return null

	return (
		listDirectory(directory).find((entry): entry is FileSystem.File => {
			if (!isFile(entry)) return false
			const name = lowerName(entry)
			return (
				prefixes.some((prefix) => name.startsWith(prefix)) &&
				extensions.some((extension) => name.endsWith(extension))
			)
		}) ?? null
	)
}

const copyFile = async (
	source: FileSystem.File | null,
	targetDirectory: FileSystem.Directory,
	targetName: string,
) => {
	if (!source) return false

	ensureDirectory(targetDirectory)
	await source.copy(new FileSystem.File(targetDirectory, targetName), {
		overwrite: true,
	})
	return true
}

const copyRequiredFile = async (
	source: FileSystem.File | null,
	targetDirectory: FileSystem.Directory,
	targetName: string,
) => {
	const copied = await copyFile(source, targetDirectory, targetName)
	if (!copied) {
		throw new Error(`皮肤资源缺少 ${targetName}`)
	}
}

const collectBootSplashAssets = async (
	rawDirectory: FileSystem.Directory,
	targetRoot: FileSystem.Directory,
): Promise<InstalledSkinBootSplashAsset[]> => {
	const splashItemsDirectory = new FileSystem.Directory(
		targetRoot,
		'splash',
		'items',
	)
	ensureDirectory(splashItemsDirectory)

	const assets: InstalledSkinBootSplashAsset[] = []
	for (const entry of listDirectory(rawDirectory)) {
		if (!isDirectory(entry)) continue

		const card = findFileByPrefix(
			entry,
			['card_img'],
			['.png', '.jpg', '.webp'],
		)
		if (!card) continue

		const itemDirectory = new FileSystem.Directory(
			splashItemsDirectory,
			entry.name,
		)
		ensureDirectory(itemDirectory)
		await copyRequiredFile(card, itemDirectory, 'card.png')

		const video =
			listDirectory(entry).find(
				(child): child is FileSystem.File =>
					isFile(child) && lowerName(child).endsWith('.mp4'),
			) ?? null
		if (video) {
			await copyRequiredFile(video, itemDirectory, 'intro.mp4')
		}

		assets.push({
			id: entry.name,
			name: `启动素材 ${assets.length + 1}`,
			cardPath: `splash/items/${entry.name}/card.png`,
			videoPath: video ? `splash/items/${entry.name}/intro.mp4` : null,
		})
	}

	return assets
}

const normalizeSkinPackage = async (
	rawDirectory: FileSystem.Directory,
	targetRoot: FileSystem.Directory,
) => {
	const skinDirectory = findDirectoryWithChild(rawDirectory, 'skin')
	const playIconDirectory = findDirectoryWithChild(rawDirectory, 'play_icon')
	const thumbUpDirectory = findDirectoryWithChild(rawDirectory, 'thumbup')
	const loadingDirectory = findDirectoryWithChild(rawDirectory, 'loading')

	const targetSkinDirectory = new FileSystem.Directory(targetRoot, 'skin')
	const targetPlayIconDirectory = new FileSystem.Directory(
		targetRoot,
		'play_icon',
	)
	const targetThumbUpDirectory = new FileSystem.Directory(targetRoot, 'thumbup')
	const targetLoadingDirectory = new FileSystem.Directory(targetRoot, 'loading')

	await copyRequiredFile(
		findFileByPrefix(skinDirectory, ['tail_bg'], ['.png', '.jpg', '.webp']),
		targetSkinDirectory,
		'tail_bg.png',
	)
	await copyRequiredFile(
		findFileByPrefix(skinDirectory, ['head_bg'], ['.jpg', '.png', '.webp']),
		targetSkinDirectory,
		'head_bg.jpg',
	)
	await copyRequiredFile(
		findFileByPrefix(skinDirectory, ['head_tab_bg'], ['.png', '.jpg', '.webp']),
		targetSkinDirectory,
		'head_tab_bg.png',
	)

	for (const name of [
		'tail_icon_main',
		'tail_icon_selected_main',
		'tail_icon_channel',
		'tail_icon_selected_channel',
		'tail_icon_myself',
		'tail_icon_selected_myself',
	]) {
		await copyRequiredFile(
			findFileByPrefix(skinDirectory, [name], ['.png', '.jpg', '.webp']),
			targetSkinDirectory,
			`${name}.png`,
		)
	}

	for (const [sourceName, targetName] of [
		['middle', 'middle.png'],
		['drag_left', 'drag_left.png'],
		['drag_right', 'drag_right.png'],
		['static_icon_image', 'static_icon_image.png'],
	] as const) {
		await copyRequiredFile(
			findFileByPrefix(
				playIconDirectory,
				[sourceName],
				['.png', '.jpg', '.webp'],
			),
			targetPlayIconDirectory,
			targetName,
		)
	}

	await copyFile(
		findFileByPrefix(loadingDirectory, ['loading_frame'], ['.png', '.jpg']),
		targetLoadingDirectory,
		'loading_frame.png',
	)
	await copyFile(
		findFileByPrefix(loadingDirectory, ['loading'], ['.png', '.jpg', '.webp']),
		targetLoadingDirectory,
		'loading.png',
	)

	await copyRequiredFile(
		findFileByPrefix(
			thumbUpDirectory,
			['image_preview'],
			['.png', '.jpg', '.webp'],
		),
		targetThumbUpDirectory,
		'image_preview.png',
	)

	const svgaBin =
		findFileByPrefix(thumbUpDirectory, ['image_ani'], ['.bin']) ??
		findFileByPrefix(thumbUpDirectory, ['image_ani_cut'], ['.bin'])
	await copyRequiredFile(svgaBin, targetThumbUpDirectory, 'image_ani.bin')

	const framesDirectory = new FileSystem.Directory(
		targetThumbUpDirectory,
		'frames',
	)
	const frames = await extractSvgaBinFramesAsync({
		inputUri: new FileSystem.File(targetThumbUpDirectory, 'image_ani.bin').uri,
		outputDirectoryUri: framesDirectory.uri,
	})
	const bootSplashAssets = await collectBootSplashAssets(
		rawDirectory,
		targetRoot,
	)

	return {
		bootSplashAssets,
		thumbUpFrameCount: frames.frames,
		thumbUpFrameFps: frames.fps,
		thumbUpFrameSize: frames.width,
	}
}

export async function installSkinPackage({
	item,
	onProgress,
	packageUrl,
}: InstallSkinPackageOptions): Promise<InstalledSkin> {
	const skinId = `garb-${item.itemId}-${sanitizeSegment(item.name) || 'skin'}`
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

	const packageFile = new FileSystem.File(tempDirectory, 'package.zip')
	await FileSystem.File.downloadFileAsync(packageUrl, packageFile, {
		idempotent: true,
		onProgress: (progress) => {
			if (progress.totalBytes <= 0) {
				onProgress?.(0)
				return
			}
			onProgress?.(progress.bytesWritten / progress.totalBytes)
		},
	})

	const rawDirectory = new FileSystem.Directory(tempDirectory, 'raw')
	await unzipAsync({
		inputUri: packageFile.uri,
		outputUri: rawDirectory.uri,
	})
	const normalized = await normalizeSkinPackage(rawDirectory, installDirectory)

	return {
		id: skinId,
		name: item.name,
		rootUri: installDirectory.uri,
		coverUri: item.coverUri,
		downloadedAt: Date.now(),
		bootSplashAssets: normalized.bootSplashAssets,
		thumbUpFrameCount: normalized.thumbUpFrameCount,
		thumbUpFrameFps: normalized.thumbUpFrameFps,
		thumbUpFrameSize: normalized.thumbUpFrameSize,
	}
}
