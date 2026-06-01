import type { GarbSkinSearchResult } from '@/lib/api/bilibili/garb'
import {
	fetchGarbSkinAssetDeclaration,
	searchGarbSkins,
} from '@/lib/api/bilibili/garb'
import {
	deleteInstalledSkinPackage,
	installSkinPackage,
	type SkinDownloadProgress,
} from '@/lib/theme/skinInstall'
import type { InstalledSkin, SkinAssetDeclaration } from '@/lib/theme/skins'

export interface SkinInstallOptions {
	item: GarbSkinSearchResult
	onProgress?: (progress: SkinDownloadProgress) => void
	signal?: AbortSignal
}

// ============================================================
// 搜索 + 构建资产声明
// ============================================================

/**
 * 搜索装扮并构建统一资产声明表
 * 如果不需要分页，使用此方法即可；需要分页的场景请在 UI 层用 useInfiniteQuery
 */
export const searchAndBuildSkinMetadata = async (
	keyword: string,
	signal?: AbortSignal,
): Promise<{
	assetDeclaration: SkinAssetDeclaration
	searchResult: GarbSkinSearchResult
}> => {
	const results = await searchGarbSkins(keyword, signal)
	if (results.length === 0) {
		throw new Error('未搜索到任何装扮')
	}

	const first = results[0]
	const assetDeclaration = await fetchGarbSkinAssetDeclaration(first, signal)

	return {
		assetDeclaration,
		searchResult: first,
	}
}

// ============================================================
// 安装皮肤
// ============================================================

/**
 * 安装皮肤（搜索 + 下载 + 解压）
 */
export const installSkin = async ({
	item,
	onProgress,
	signal,
}: SkinInstallOptions): Promise<InstalledSkin> => {
	return installSkinPackage({ item, onProgress, signal })
}

// ============================================================
// 卸载皮肤
// ============================================================

/**
 * 卸载皮肤（从磁盘删除）
 */
export const uninstallSkin = (skin: { rootUri: string }) => {
	deleteInstalledSkinPackage(skin)
}
