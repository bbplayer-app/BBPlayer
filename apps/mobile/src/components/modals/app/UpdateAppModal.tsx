import {
	canRequestPackageInstallsAsync,
	downloadAndInstallApkAsync,
	getSupportedAbisAsync,
	openPackageInstallerSettingsAsync,
} from '@bbplayer/native'
import * as Clipboard from 'expo-clipboard'
import * as WebBrowser from 'expo-web-browser'
import { useCallback, useState } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { Dialog, Text, useTheme } from 'react-native-paper'

import Button from '@/components/common/Button'
import { useModalStore } from '@/hooks/stores/useModalStore'
import type { UpdateDownloads } from '@/lib/services/updateService'
import { storage } from '@/utils/mmkv'
import toast from '@/utils/toast'

export interface UpdateModalProps {
	version: string
	notes: string
	listed_notes?: string[]
	forced?: boolean
	url: string
	downloads?: UpdateDownloads
}

export default function UpdateAppModal({
	version,
	notes,
	listed_notes,
	url,
	downloads,
	forced = false,
}: UpdateModalProps) {
	const colors = useTheme().colors
	const _close = useModalStore((state) => state.close)
	const close = useCallback(() => _close('UpdateApp'), [_close])
	const [isUpdating, setIsUpdating] = useState(false)

	const onUpdate = async () => {
		if (isUpdating) return
		if (Platform.OS !== 'android') {
			await openReleaseUrl()
			return
		}

		let toastId: string | number | undefined
		try {
			const canInstall = await canRequestPackageInstallsAsync()
			if (!canInstall) {
				await openPackageInstallerSettingsAsync()
				toast.info('请允许 BBPlayer 安装未知来源应用后再次更新')
				return
			}

			setIsUpdating(true)
			toastId = toast.loading('正在下载更新包', {
				description: '下载完成后会打开系统安装器',
				duration: Infinity,
			})
			const downloadUrl = await resolveAndroidDownloadUrl()
			if (!downloadUrl) {
				toast.dismiss(toastId)
				await openReleaseUrl()
				setIsUpdating(false)
				return
			}
			await downloadAndInstallApkAsync({
				url: downloadUrl,
				fileName: `BBPlayer-${version}-${Date.now()}.apk`,
				title: `BBPlayer ${version}`,
				description: '下载完成后安装更新',
			})
			toast.success('更新包下载完成', { id: toastId })
			close()
		} catch (e) {
			toast.error('更新失败，已将下载链接复制到剪贴板', {
				description: String(e),
				id: toastId,
			})
			void Clipboard.setStringAsync(url)
		}
		setIsUpdating(false)
	}

	const openReleaseUrl = async () => {
		try {
			if (url) await WebBrowser.openBrowserAsync(url)
		} catch (e) {
			void Clipboard.setStringAsync(url)
			toast.error('无法打开浏览器，已将链接复制到剪贴板', {
				description: String(e),
			})
		}
		close()
	}

	const resolveAndroidDownloadUrl = async (): Promise<string | null> => {
		if (!downloads?.android) return isApkUrl(url) ? url : null
		const supportedAbis = await getSupportedAbisAsync()
		for (const abi of supportedAbis) {
			const abiUrl = downloads.android[abi]
			if (abiUrl) return abiUrl
		}
		return downloads.android.universal ?? (isApkUrl(url) ? url : null)
	}

	const onSkip = () => {
		storage.set('skip_version', version)
		close()
	}

	const onCancel = () => {
		close()
	}

	return (
		<>
			<Dialog.Title>发现新版本 {version}</Dialog.Title>
			<Dialog.Content>
				{forced ? (
					<Text style={[styles.forcedText, { color: colors.error }]}>
						此更新为强制更新，必须安装后继续使用。
					</Text>
				) : null}
				{listed_notes && listed_notes.length > 0 ? (
					listed_notes.map((note, index) => (
						<Text
							selectable
							// oxlint-disable-next-line react/no-array-index-key
							key={index}
							style={styles.noteText}
						>
							{`• ${note}`}
						</Text>
					))
				) : (
					<Text selectable>
						{/* 小米对联，偷了！ */}
						{notes?.trim() || '提高软件稳定性，优化软件流畅度'}
					</Text>
				)}
			</Dialog.Content>
			<Dialog.Actions style={styles.actionsContainer}>
				{!forced ? (
					<Button
						onPress={onSkip}
						disabled={isUpdating}
					>
						跳过此版本
					</Button>
				) : (
					<View />
				)}
				<View style={styles.rightActionsContainer}>
					<Button
						onPress={onCancel}
						disabled={forced || isUpdating}
					>
						取消
					</Button>
					<Button
						onPress={onUpdate}
						disabled={isUpdating}
					>
						{isUpdating ? '下载中' : '去更新'}
					</Button>
				</View>
			</Dialog.Actions>
		</>
	)
}

const isApkUrl = (value: string) => value.toLowerCase().includes('.apk')

const styles = StyleSheet.create({
	forcedText: {
		marginBottom: 8,
		fontWeight: 'bold',
	},
	noteText: {
		marginBottom: 4,
	},
	actionsContainer: {
		justifyContent: 'space-between',
	},
	rightActionsContainer: {
		flexDirection: 'row',
	},
})
