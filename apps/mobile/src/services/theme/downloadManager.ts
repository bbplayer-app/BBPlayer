/**
 * 阶段二：下载服务
 *
 * 职责：
 * - 遍历 Unified Asset Manifest，找出所有远程 URL
 * - 平铺下载到指定目录（不建子目录，文件名随意）
 * - 返回 url → 相对路径 的映射表
 *
 * 不关心：
 * - 资产命名规范（由 transformer 决定如何消费映射表）
 * - zip 解压 / SVGA 转换（这些属于后处理，不在此模块）
 * - InstalledSkin 构建
 */
import * as FileSystem from 'expo-file-system'

import log from '@/utils/log'

import type { SkinAssetDeclaration } from './schema'
import type { SkinDownloadProgress } from './types'

// ============================================================
// Constants
// ============================================================

const DOWNLOAD_HEADERS = {
	Referer: 'https://www.bilibili.com/',
	'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
}

// ============================================================
// Helpers
// ============================================================

const isRemoteUrl = (value: string | null | undefined): value is string =>
	typeof value === 'string' && /^https?:\/\//.test(value)

const extensionFromUrl = (url: string): string => {
	try {
		const pathname = new URL(url).pathname
		const match = pathname.match(
			/\.(png|jpe?g|webp|gif|bin|zip|mp4|json|svga)(?=$|[.@])/i,
		)
		return match?.[0].toLowerCase() ?? '.bin'
	} catch {
		return '.bin'
	}
}

const collectRemoteUrls = (manifest: SkinAssetDeclaration): string[] => {
	const urls: (string | null)[] = []

	for (const card of manifest.cards) {
		urls.push(card.img)
		if (card.video_list) urls.push(card.video_list[0])
	}

	for (const item of manifest.avatar_frames) {
		urls.push(item.image)
	}

	for (const item of manifest.card_backgrounds) {
		urls.push(item.image, item.preview)
	}

	for (const item of manifest.space_backgrounds) {
		for (const img of item.images) {
			urls.push(img.landscape, img.portrait)
		}
	}

	for (const item of manifest.thumbups) {
		urls.push(item.ani_file, item.ani_cut, item.preview)
	}

	for (const item of manifest.skins) {
		urls.push(
			item.head_bg,
			item.head_tab_bg,
			item.head_myself_bg,
			item.head_myself_squared_bg,
			item.head_myself_mp4_bg,
			item.side_bg,
			item.side_bg_bottom,
			item.tail_bg,
			item.tail_icon_main,
			item.tail_icon_channel,
			item.tail_icon_dynamic,
			item.tail_icon_shop,
			item.tail_icon_myself,
			item.tail_icon_pub_btn_bg,
			item.tail_icon_ani,
			item.tail_icon_selected_main,
			item.tail_icon_selected_channel,
			item.tail_icon_selected_dynamic,
			item.tail_icon_selected_shop,
			item.tail_icon_selected_myself,
			item.tail_icon_selected_pub_btn_bg,
			item.package_url,
			item.image_cover,
			item.image_preview,
		)
	}

	for (const item of manifest.loadings) {
		urls.push(item.loading_url, item.loading_frame_url, item.preview)
	}

	for (const item of manifest.play_icons) {
		urls.push(
			item.drag_left_png,
			item.drag_right_png,
			item.middle_png,
			item.static_icon_image,
			item.squared_image,
		)
	}

	if (manifest.coverUri) urls.push(manifest.coverUri)

	return [...new Set(urls.filter(isRemoteUrl))]
}

// ============================================================
// 公开 API
// ============================================================

export interface DownloadManifestResult {
	/** url → 相对路径（相对于 outputDirectory） */
	mapping: Record<string, string>
}

/**
 * 下载 Unified Asset Manifest 中所有远程资产到本地目录。
 *
 * - 所有文件平铺在 outputDirectory 下，无子目录
 * - 返回的 mapping 中 key 为原始远程 URL，value 为本地相对路径
 * - 重复 URL 只下载一次
 */
export const downloadManifestAssets = async ({
	manifest,
	outputDirectory,
	onProgress,
	signal,
}: {
	manifest: SkinAssetDeclaration
	outputDirectory: FileSystem.Directory
	onProgress?: (progress: SkinDownloadProgress) => void
	signal?: AbortSignal
}): Promise<DownloadManifestResult> => {
	const urls = collectRemoteUrls(manifest)

	log.debug('[download] collected remote URLs', {
		count: urls.length,
		remoteCount: urls.filter((u) => /^https?:\/\//.test(u)).length,
	})

	const plan = urls.map((url, index) => ({
		localPath: `asset-${String(index).padStart(4, '0')}${extensionFromUrl(url)}`,
		url,
	}))

	const mapping: Record<string, string> = {}
	for (const item of plan) {
		mapping[item.url] = item.localPath
	}

	if (!outputDirectory.exists) {
		outputDirectory.create({ idempotent: true, intermediates: true })
	}

	const total = plan.length
	let completed = 0

	for (const item of plan) {
		const label = item.url.split('/').pop() ?? 'asset'
		const file = new FileSystem.File(outputDirectory, item.localPath)

		onProgress?.({
			completed,
			label: `下载 ${label}`,
			progress: total > 0 ? completed / total : 0,
			total,
		})

		if (file.exists) {
			file.delete()
		}

		await FileSystem.File.downloadFileAsync(item.url, file, {
			headers: DOWNLOAD_HEADERS,
			idempotent: true,
			signal,
		})

		completed += 1

		onProgress?.({
			completed,
			label: `已下载 ${label}`,
			progress: total > 0 ? completed / total : 0,
			total: Math.max(1, total),
		})
	}

	log.debug('[download] all assets downloaded', { count: completed, total })
	return { mapping }
}
