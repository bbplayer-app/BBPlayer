/**
 * v2 backups require database-owned JS migration records and cannot be
 * safely reconstructed from legacy MMKV flags.
 */
export const BACKUP_VERSION = 2

/** 备份清单，嵌入 ZIP 文件的 manifest.json。 */
export interface BackupManifest {
	version: typeof BACKUP_VERSION
	exportedAt: string
	mmkv: {
		'app-storage': string
		'shared-playlist-members': string
	}
	orpheus: OrpheusBackupData
}

/** Orpheus 原生端 exportData() 返回的数据结构。 */
export interface OrpheusBackupData {
	playerQueue: Record<string, boolean | string | number>
	loudness: Record<string, number>
}
