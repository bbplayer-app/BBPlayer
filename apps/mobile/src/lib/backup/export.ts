import { Orpheus } from '@bbplayer/orpheus'
import { Directory, File, Paths } from 'expo-file-system'
import JSZip from 'jszip'

import { expoDb } from '@/lib/db/db'
import log from '@/utils/log'
import { storage } from '@/utils/mmkv'

import { BACKUP_VERSION } from './types'
import type { BackupManifest } from './types'

const logger = log.extend('backup.export')

/**
 * 创建完整备份文件，返回备份文件的 URI。
 *
 * 备份是 ZIP 格式，包含：
 * - `database.db`   — VACUUM INTO 生成的 SQLite 快照
 * - `manifest.json` — 所有 MMKV 和 Orpheus 配置数据
 */
export async function createBackup(): Promise<string> {
	const cacheDir = new Directory(Paths.cache)
	const dbBackupFile = new File(cacheDir, 'backup-db.db')

	try {
		// 1. SQLite 快照：VACUUM INTO 保证一致性，无需关闭连接
		const dbBackupPath = dbBackupFile.uri.replace('file://', '')
		expoDb.execSync(`VACUUM INTO '${dbBackupPath}'`)
		logger.debug('数据库快照已创建')

		const dbBase64 = dbBackupFile.base64Sync()

		const manifest: BackupManifest = {
			version: BACKUP_VERSION,
			exportedAt: new Date().toISOString(),
			mmkv: {
				'app-storage': storage.getString('app-storage') ?? '',
				'shared-playlist-members':
					storage.getString('shared-playlist-members') ?? '',
			},
			orpheus: Orpheus.exportData(),
		}

		const zip = new JSZip()
		zip.file('database.db', dbBase64, { base64: true })
		zip.file('manifest.json', JSON.stringify(manifest, null, 2))

		const zipData = await zip.generateAsync({ type: 'uint8array' })
		const zipFile = new File(cacheDir, 'bbplayer-backup.bbplayer')
		zipFile.write(zipData)

		logger.info('备份创建完成', { uri: zipFile.uri })
		return zipFile.uri
	} finally {
		if (dbBackupFile.exists) {
			dbBackupFile.delete()
		}
	}
}
