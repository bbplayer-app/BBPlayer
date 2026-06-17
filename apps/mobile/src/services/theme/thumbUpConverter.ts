import { convertSvgaBinToGifAsync } from '@bbplayer/native'
import * as FileSystem from 'expo-file-system'
import { Platform } from 'react-native'

import type { SkinAssetDeclaration } from './schema'

export interface ThumbUpGifResult {
	durationMs: number
	relativeUri: string
}

/**
 * 将 manifest 中每个 thumbup 的 SVGA 动画转换为 GIF。
 *
 * - Android 专有（其他平台返回空数组）
 * - 输入文件从 workDir 中按 mapping 查找
 * - 输出到 workDir/thumbups/NN/thumbup.gif
 */
export const convertThumbUpsToGifs = async ({
	manifest,
	mapping,
	workDir,
	onProgress,
}: {
	manifest: SkinAssetDeclaration
	mapping: Record<string, string>
	workDir: FileSystem.Directory
	onProgress?: (label: string) => void
}): Promise<ThumbUpGifResult[]> => {
	if (Platform.OS !== 'android') return []

	const results: ThumbUpGifResult[] = []

	for (let index = 0; index < manifest.thumbups.length; index++) {
		const thumbup = manifest.thumbups[index]
		const aniFileUrl = thumbup.ani_file
		if (!aniFileUrl) continue

		const localPath = mapping[aniFileUrl]
		if (!localPath) continue

		const inputUri = `${workDir.uri.replace(/\/+$/, '')}/${localPath.replace(/^\/+/, '')}`
		const gifDir = `thumbups/${String(index).padStart(2, '0')}`
		const gifRelativeUri = `${gifDir}/thumbup.gif`

		const gifDirectory = new FileSystem.Directory(workDir, gifDir)
		gifDirectory.create({ idempotent: true, intermediates: true })

		const outputFile = new FileSystem.File(gifDirectory, 'thumbup.gif')
		if (outputFile.exists) {
			outputFile.delete()
		}

		onProgress?.(`转换 ${thumbup.name ?? '点赞动画'}`)

		const result = await convertSvgaBinToGifAsync({
			height: 96,
			inputUri,
			outputUri: outputFile.uri,
			width: 96,
		})

		results.push({
			durationMs: Math.round((result.frames / Math.max(1, result.fps)) * 1000),
			relativeUri: gifRelativeUri,
		})
	}

	return results
}
