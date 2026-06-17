/**
 * 阶段三：皮肤生命周期编排器
 *
 * 职责：
 * - 串联 adapter → downloadManager → transformer 全流程
 * - 安装到 cacheDirectory 临时目录，完成后移动到 skins/ 永久目录
 * - 注册表通过 useSkinStore（Zustand → MMKV）维护
 * - 提供安装、卸载、列表、查询接口
 */

import * as FileSystem from 'expo-file-system'

import useSkinStore from '@/hooks/stores/useSkinStore'
import type { GarbSkinSearchResult } from '@/lib/api/bilibili/garb'

import { fetchGarbSkinAssetDeclaration } from './adapter'
import { downloadManifestAssets } from './downloadManager'
import { convertThumbUpsToGifs } from './thumbUpConverter'
import { transformManifestToInstalledSkin } from './transformer'
import type { InstalledSkin, InstalledSkinMeta } from './types'

// ============================================================
// 路径
// ============================================================

const skinsDir = new FileSystem.Directory(FileSystem.Paths.document, 'skins/')

const ensureSkinsDir = () => {
	if (!skinsDir.exists) {
		skinsDir.create({ idempotent: true, intermediates: true })
	}
}

// ============================================================
// Skin ID 推导
// ============================================================

const deriveSkinId = (item: GarbSkinSearchResult): string => {
	if (
		item.kind === 'collection' &&
		item.actId !== null &&
		item.lotteryId !== null
	) {
		return `collection_${item.actId}_${item.lotteryId}`
	}
	if (item.kind === 'suit') {
		return `suit_${item.itemId ?? 'unknown'}`
	}
	throw new Error(`不支持的皮肤类型: ${item.kind}`)
}

const deriveSkinIdFromSource = (source: InstalledSkin['source']): string => {
	if (source.kind === 'collection')
		return `collection_${source.actId}_${source.lotteryId}`
	return `suit_${source.itemId}`
}

// ============================================================
// 皮肤 JSON 读写（每个 skin 目录内的 skin.json）
// ============================================================

const skinJsonFile = (skinId: string): FileSystem.File =>
	new FileSystem.File(
		new FileSystem.Directory(skinsDir, `${skinId}/`),
		'skin.json',
	)

const readSkinJson = async (skinId: string): Promise<InstalledSkin | null> => {
	const file = skinJsonFile(skinId)
	if (!file.exists) return null
	try {
		const text = await file.text()
		return JSON.parse(text) as InstalledSkin
	} catch {
		return null
	}
}

const writeSkinJson = async (
	skin: InstalledSkin,
	dir: FileSystem.Directory,
): Promise<void> => {
	const file = new FileSystem.File(dir, 'skin.json')
	file.write(JSON.stringify(skin, null, 2))
}

// ============================================================
// 安装
// ============================================================

export interface InstallSkinOptions {
	onProgress?: (progress: {
		completed: number
		label: string
		progress: number
		total: number
	}) => void
	signal?: AbortSignal
}

export const installSkin = async (
	item: GarbSkinSearchResult,
	options: InstallSkinOptions = {},
): Promise<InstalledSkin> => {
	const skinId = deriveSkinId(item)

	const manifest = await fetchGarbSkinAssetDeclaration(item, options.signal)

	const tempDir = new FileSystem.Directory(
		FileSystem.Paths.cache ?? FileSystem.Paths.document,
		`skin-install-${Date.now().toString(36)}/`,
	)
	tempDir.create({ idempotent: true, intermediates: true })

	try {
		const { mapping } = await downloadManifestAssets({
			manifest,
			outputDirectory: tempDir,
			onProgress: options.onProgress
				? (p) => {
						options.onProgress?.({
							completed: p.completed,
							label: p.label,
							progress: p.progress,
							total: p.total,
						})
					}
				: undefined,
			signal: options.signal,
		})

		const thumbUpGifs = await convertThumbUpsToGifs({
			manifest,
			mapping,
			workDir: tempDir,
			onProgress: options.onProgress
				? (label) => {
						options.onProgress?.({
							completed: 0,
							label,
							progress: 0,
							total: 0,
						})
					}
				: undefined,
		})

		const finalDir = new FileSystem.Directory(skinsDir, `${skinId}/`)
		const installedSkin: InstalledSkin = transformManifestToInstalledSkin({
			manifest,
			mapping,
			rootUri: finalDir.uri,
			skinId,
			source:
				item.kind === 'collection'
					? {
							actId: item.actId!,
							kind: 'collection',
							lotteryId: item.lotteryId!,
						}
					: {
							itemId: item.itemId!,
							kind: 'suit',
						},
			thumbUpGifs,
		})

		await writeSkinJson(installedSkin, tempDir)

		ensureSkinsDir()

		if (finalDir.exists) {
			finalDir.delete()
			useSkinStore.getState().removeInstalledSkin(skinId)
		}

		await tempDir.move(finalDir)
		useSkinStore.getState().addInstalledSkin(installedSkin)

		return installedSkin
	} catch (error) {
		if (tempDir.exists) {
			try {
				tempDir.delete()
			} catch {
				// best-effort cleanup
			}
		}
		throw error
	}
}

// ============================================================
// 卸载
// ============================================================

export const uninstallSkin = async (skinId: string): Promise<void> => {
	const store = useSkinStore.getState()
	if (!store.installedSkins.some((e) => e.id === skinId)) return

	const dir = new FileSystem.Directory(skinsDir, `${skinId}/`)
	if (dir.exists) {
		dir.delete()
	}

	store.removeInstalledSkin(skinId)
}

export const uninstallSkinBySource = async (
	source: InstalledSkin['source'],
): Promise<void> => {
	await uninstallSkin(deriveSkinIdFromSource(source))
}

// ============================================================
// 列表
// ============================================================

export const getInstalledSkins = (): InstalledSkinMeta[] => {
	return useSkinStore.getState().installedSkins
}

// ============================================================
// 查询
// ============================================================

export const getInstalledSkin = async (
	skinId: string,
): Promise<InstalledSkin | null> => {
	return readSkinJson(skinId)
}

export const getInstalledSkinBySource = async (
	source: InstalledSkin['source'],
): Promise<InstalledSkin | null> => {
	return readSkinJson(deriveSkinIdFromSource(source))
}

export const getInstalledSkinMeta = (
	skinId: string,
): InstalledSkinMeta | null => {
	return (
		useSkinStore.getState().installedSkins.find((e) => e.id === skinId) ?? null
	)
}

export const isSkinInstalled = (item: GarbSkinSearchResult): boolean => {
	const skinId = deriveSkinId(item)
	return useSkinStore.getState().installedSkins.some((e) => e.id === skinId)
}
