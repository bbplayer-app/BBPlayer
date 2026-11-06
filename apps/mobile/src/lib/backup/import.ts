import { Orpheus } from '@bbplayer/orpheus'
import { File, Paths } from 'expo-file-system'
import * as SQLite from 'expo-sqlite'
import JSZip from 'jszip'

import { restorePlaybackContextState } from '@/hooks/stores/playbackContextStore'
import { expoDb } from '@/lib/db/db'
import { clearLegacyMigrationKeys } from '@/lib/db/migrations'
import log from '@/utils/log'
import { storage } from '@/utils/mmkv'
import { getStartupScreen, setStartupScreen } from '@/utils/startup-screen'

import { BACKUP_VERSION } from './types'
import type { BackupManifest } from './types'

const logger = log.extend('backup.import')
let restoreInProgress = false

/**
 * 从备份文件恢复数据。
 *
 * 恢复完成后需要重启应用以刷新内存中的设置。
 */
export async function restoreBackup(filePath: string): Promise<void> {
	if (restoreInProgress) throw new Error('已有备份正在恢复，请等待完成')
	restoreInProgress = true
	try {
		await performRestoreBackup(filePath)
	} finally {
		restoreInProgress = false
	}
}

async function performRestoreBackup(filePath: string): Promise<void> {
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

	await restoreDatabaseBytes(await dbEntry.async('uint8array'), expoDb)

	// The restored database now owns migration state. Never let this device's
	// legacy MMKV flags seed state for a different database.
	clearLegacyMigrationKeys()

	if (manifest.mmkv['app-storage']) {
		storage.set('app-storage', manifest.mmkv['app-storage'])
	}
	if (
		manifest.mmkv.startup_screen === 'home' ||
		manifest.mmkv.startup_screen === 'library'
	) {
		setStartupScreen(manifest.mmkv.startup_screen)
	} else if (manifest.mmkv['app-storage']) {
		// 旧备份的偏好仍在 app-storage 中，不能沿用本机已有的独立 key。
		storage.remove('startup_screen')
		getStartupScreen()
	}
	if (manifest.mmkv['shared-playlist-members']) {
		storage.set(
			'shared-playlist-members',
			manifest.mmkv['shared-playlist-members'],
		)
	}
	restorePlaybackContextState(manifest.mmkv['playback-context-store'])
	logger.info('MMKV 数据已恢复')

	Orpheus.importData(manifest.orpheus)
	logger.info('Orpheus 配置已恢复')
}

/** Validate a staged snapshot and atomically copy it into an open database. */
export async function restoreDatabaseBytes(
	dbBytes: Uint8Array,
	destination: SQLite.SQLiteDatabase,
): Promise<void> {
	// Stage and validate before touching the live database. SQLite's backup API
	// replaces the destination transactionally and keeps the shared connection open.
	const stagedFile = new File(
		Paths.cache,
		`restore-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
	)
	try {
		await stagedFile.write(dbBytes)
		const tempDb = SQLite.openDatabaseSync(stagedFile.uri)
		try {
			const check = tempDb.getFirstSync<{ quick_check: string }>(
				'PRAGMA quick_check',
			)
			if (check?.quick_check !== 'ok') throw new Error('备份数据库损坏')
			tempDb.execSync('DELETE FROM playlist_sync_queue')
			await SQLite.backupDatabaseAsync({
				sourceDatabase: tempDb,
				destDatabase: destination,
			})
		} finally {
			tempDb.closeSync()
		}

		logger.info('数据库已恢复，需要重启应用以刷新设置')
	} catch (e) {
		logger.error('数据库恢复失败', e)
		throw e
	} finally {
		for (const suffix of ['', '-wal', '-shm']) {
			const file = new File(`${stagedFile.uri}${suffix}`)
			try {
				if (file.exists) file.delete()
			} catch (error) {
				logger.warning('清理恢复临时文件失败', error)
			}
		}
	}
}
