import { convertSvgaBinToSpriteSheetAsync } from '@bbplayer/native'
import * as FileSystem from 'expo-file-system'
import { Platform } from 'react-native'

import log from '@/utils/log'

import type { SkinAssetDeclaration } from './schema'

export interface ThumbUpSpriteResult {
	spriteSheetUri: string
	frameCount: number
	fps: number
	frameWidth: number
	frameHeight: number
}

/**
 * 将 manifest 中每个 thumbup 的 SVGA 动画转换为纵向雪碧图 PNG。
 *
 * - Android 专有（其他平台返回空数组）
 * - 输入文件从 workDir 中按 mapping 查找
 * - 输出到 workDir/thumbups/NN/sprite.png
 */
export const convertThumbUpsToSpriteSheets = async ({
	manifest,
	mapping,
	workDir,
	onProgress,
}: {
	manifest: SkinAssetDeclaration
	mapping: Record<string, string>
	workDir: FileSystem.Directory
	onProgress?: (label: string) => void
}): Promise<ThumbUpSpriteResult[]> => {
	if (Platform.OS !== 'android') {
		log.debug(
			'[thumbUp] skipping SVGA→sprite conversion on non-Android platform',
			{
				count: manifest.thumbups.length,
				platform: Platform.OS,
			},
		)
		return []
	}

	const results: ThumbUpSpriteResult[] = []

	for (let index = 0; index < manifest.thumbups.length; index++) {
		const thumbup = manifest.thumbups[index]
		const aniFileUrl = thumbup.ani_file
		if (!aniFileUrl) continue

		const localPath = mapping[aniFileUrl]
		if (!localPath) continue

		const inputUri = `${workDir.uri.replace(/\/+$/, '')}/${localPath.replace(/^\/+/, '')}`
		const spriteDir = `thumbups/${String(index).padStart(2, '0')}`
		const spriteRelativeUri = `${spriteDir}/sprite.png`

		const spriteDirectory = new FileSystem.Directory(workDir, spriteDir)
		spriteDirectory.create({ idempotent: true, intermediates: true })

		const outputFile = new FileSystem.File(spriteDirectory, 'sprite.png')
		if (outputFile.exists) {
			outputFile.delete()
		}

		onProgress?.(`转换 ${thumbup.name ?? '点赞动画'}`)

		const result = await convertSvgaBinToSpriteSheetAsync({
			inputUri,
			outputUri: outputFile.uri,
		})

		results.push({
			spriteSheetUri: spriteRelativeUri,
			frameCount: result.frameCount,
			fps: result.fps,
			frameWidth: result.frameWidth,
			frameHeight: result.frameHeight,
		})
	}

	log.debug('[thumbUp] SVGA→sprite sheet conversion complete', {
		count: results.length,
	})
	return results
}
