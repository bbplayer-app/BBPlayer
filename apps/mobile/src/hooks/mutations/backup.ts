import { useMutation } from '@tanstack/react-query'
import { File, Paths } from 'expo-file-system'

import {
	webDavBackupQueryKeys,
	type WebDavBackupConfig,
} from '@/hooks/queries/backup'
import { createBackup } from '@/lib/backup/export'
import { restoreBackup } from '@/lib/backup/import'
import {
	createMobileWebDavClient,
	joinWebDavPath,
	saveWebDavConfig,
} from '@/lib/backup/webdav'
import type { WebDavEntry } from '@/lib/backup/webdav-client'
import { queryClient } from '@/lib/config/queryClient'
import { toastAndLogError } from '@/utils/error-handling'
import toast from '@/utils/toast'

interface WebDavCredentials {
	config: WebDavBackupConfig
	password: string
}

export function useTestWebDavConnectionMutation() {
	return useMutation({
		mutationKey: ['webDavBackups', 'testConnection'],
		mutationFn: async ({ config, password }: WebDavCredentials) => {
			const client = await createMobileWebDavClient(config, password)
			await client.checkConnection('/')
			await client.ensureDirectory(config.directory)
			await client.checkConnection(config.directory)
		},
		onSuccess: () => toast.success('WebDAV 连接成功'),
		onError: (error) =>
			toastAndLogError('WebDAV 连接失败', error, 'UI.Settings.Backup'),
	})
}

export function useCloudBackupMutation() {
	return useMutation({
		mutationKey: ['webDavBackups', 'upload'],
		mutationFn: async ({ config, password }: WebDavCredentials) => {
			const client = await createMobileWebDavClient(config, password)
			await client.ensureDirectory(config.directory)
			const uri = await createBackup()
			const backupFile = new File(uri)

			try {
				const bytes = backupFile.bytesSync()

				const timestamp = new Date()
					.toISOString()
					.replaceAll(':', '-')
					.replace('.', '-')

				await client.uploadFile(
					joinWebDavPath(config.directory, `backup-${timestamp}.bbplayer`),
					Uint8Array.from(bytes).buffer,
				)
				await saveWebDavConfig(config, password || undefined)
			} finally {
				if (backupFile.exists) backupFile.delete()
			}
		},
		onSuccess: async () => {
			toast.success('云端备份完成')
			await queryClient.invalidateQueries({
				queryKey: webDavBackupQueryKeys.all,
			})
		},
		onError: (error) =>
			toastAndLogError('云端备份失败', error, 'UI.Settings.Backup'),
	})
}

export function useCloudRestoreMutation(onSuccess: () => void) {
	return useMutation({
		mutationKey: ['webDavBackups', 'restore'],
		mutationFn: async ({
			config,
			password,
			entry,
		}: WebDavCredentials & { entry: WebDavEntry }) => {
			const client = await createMobileWebDavClient(config, password)
			const data = await client.downloadFile(entry.path)

			const cacheFile = new File(
				Paths.cache,
				`bbplayer-webdav-restore-${Date.now()}-${Math.random().toString(36).slice(2)}.bbplayer`,
			)

			try {
				await cacheFile.write(new Uint8Array(data))
				await restoreBackup(cacheFile.uri)
			} finally {
				if (cacheFile.exists) cacheFile.delete()
			}
		},
		onSuccess,
		onError: (error) =>
			toastAndLogError('恢复云端备份失败', error, 'UI.Settings.Backup'),
	})
}
