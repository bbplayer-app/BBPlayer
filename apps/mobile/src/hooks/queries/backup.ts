import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import {
	createMobileWebDavClient,
	normalizeDirectory,
} from '@/lib/backup/webdav'

const BACKUP_FILE_PATTERN = /^backup-.+\.bbplayer$/

export interface WebDavBackupConfig {
	baseUrl: string
	username: string
	directory: string
}

export const webDavBackupQueryKeys = {
	all: ['webDavBackups'] as const,
	entries: (config: WebDavBackupConfig) =>
		[...webDavBackupQueryKeys.all, config] as const,
}

export function normalizeWebDavBackupConfig(
	config: WebDavBackupConfig,
): WebDavBackupConfig {
	return {
		baseUrl: config.baseUrl.trim(),
		username: config.username.trim(),
		directory: normalizeDirectory(config.directory),
	}
}

async function fetchWebDavBackups(
	config: WebDavBackupConfig,
	password: string,
) {
	const client = await createMobileWebDavClient(config, password)
	const entries = await client.listDirectory(config.directory)
	return entries
		.filter(
			(entry) => entry.type === 'file' && BACKUP_FILE_PATTERN.test(entry.name),
		)
		.sort(
			(a, b) =>
				(b.lastModified?.getTime() ?? 0) - (a.lastModified?.getTime() ?? 0),
		)
}

export function useWebDavBackups(config: WebDavBackupConfig, password: string) {
	const passwordRef = useRef(password)

	useEffect(() => {
		passwordRef.current = password
	}, [password])

	// oxlint-disable @tanstack/query/exhaustive-deps -- Passwords must not be cached.
	const query = useQuery({
		// Passwords must not be included in the React Query cache key.
		queryKey: webDavBackupQueryKeys.entries(config),
		queryFn: () => fetchWebDavBackups(config, passwordRef.current),
		enabled: false,
		retry: false,
		placeholderData: (previousData) => previousData,
	})
	// oxlint-enable @tanstack/query/exhaustive-deps

	return query
}
