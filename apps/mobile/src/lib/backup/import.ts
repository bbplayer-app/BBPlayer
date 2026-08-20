import { Orpheus } from '@bbplayer/orpheus'
import { Directory, File, Paths } from 'expo-file-system'
import * as SQLite from 'expo-sqlite'
import JSZip from 'jszip'

import { expoDb } from '@/lib/db/db'
import { clearLegacyMigrationKeys } from '@/lib/db/migrations'
import log from '@/utils/log'
import { storage } from '@/utils/mmkv'

import { BACKUP_VERSION } from './types'
import type { BackupManifest } from './types'

const logger = log.extend('backup.import')

/**
 * 从备份文件恢复数据。
 *
 * 恢复完成后需要重启应用才能完全生效（数据库连接需要重新打开）。
 */
export async function restoreBackup(filePath: string): Promise<void> {
	const backupFile = new File(filePath)

	const zipBytes = backupFile.bytesSync()
	const zip = await JSZip.loadAsync(zipBytes)

	const manifestEntry = zip.file('manifest.json')
	if (!manifestEntry) {
		throw new Error('备份文件无效：缺少 manifest.json')
	}
	const manifestJson = await manifestEntry.async('string')
	const manifest: BackupManifest = JSON.parse(manifestJson)

	if (manifest.version !== BACKUP_VERSION) {
		throw new Error(
			`不支持的备份版本：${String(manifest.version)}。旧版本备份无法安全导入，请使用当前版本重新导出备份。`,
		)
	}

	const dbEntry = zip.file('database.db')
	if (!dbEntry) {
		throw new Error('备份文件无效：缺少 database.db')
	}

	const docDir = new Directory(Paths.document)
	const sqliteDir = new Directory(docDir, 'SQLite')
	if (!sqliteDir.exists) {
		sqliteDir.create()
	}
	const dbFile = new File(sqliteDir, 'db.db')

	expoDb.closeSync()
	try {
		const dbBytes = await dbEntry.async('uint8array')
		dbFile.write(dbBytes)

		// 删除旧的 WAL 文件，避免重新打开时读到残留数据
		const walFile = new File(sqliteDir, 'db.db-wal')
		const shmFile = new File(sqliteDir, 'db.db-shm')
		if (walFile.exists) walFile.delete()
		if (shmFile.exists) shmFile.delete()

		const tempDb = SQLite.openDatabaseSync(dbFile.uri)
		try {
			tempDb.execSync('DELETE FROM playlist_sync_queue')
		} finally {
			tempDb.closeSync()
		}

		logger.info('数据库已恢复，需要重启应用以重新打开连接')
	} catch (e) {
		logger.error('数据库恢复失败', e)
		throw e
	}

	// The restored database now owns migration state. Never let this device's
	// legacy MMKV flags seed state for a different database.
	clearLegacyMigrationKeys()

	if (manifest.mmkv['app-storage']) {
		storage.set('app-storage', manifest.mmkv['app-storage'])
	}
	if (manifest.mmkv['shared-playlist-members']) {
		storage.set(
			'shared-playlist-members',
			manifest.mmkv['shared-playlist-members'],
		)
	}
	logger.info('MMKV 数据已恢复')

	Orpheus.importData(manifest.orpheus)
	logger.info('Orpheus 配置已恢复')
}
