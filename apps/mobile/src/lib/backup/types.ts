/** 备份清单，嵌入 ZIP 文件的 manifest.json。 */
export interface BackupManifest {
	version: 1
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
