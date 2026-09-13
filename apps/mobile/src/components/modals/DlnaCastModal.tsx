import { discoverDlnaDevices, type DlnaDevice } from '@bbplayer/dlna'
import { TrueSheet } from '@lodev09/react-native-true-sheet'
import { useCallback, useState } from 'react'
import { Platform, View } from 'react-native'
import { ActivityIndicator, List, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import IconButton from '@/components/common/IconButton'
import {
	disconnectDlnaCast,
	playSourceOnDevice,
} from '@/features/player/dlna/castCurrentTrack'
import { resolveCastSource } from '@/features/player/dlna/resolveCastSource'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { useDlnaCastSheetStore } from '@/hooks/stores/useDlnaCastSheetStore'
import { useDlnaCastStore } from '@/hooks/stores/useDlnaCastStore'
import { toastAndLogError } from '@/utils/error-handling'
import * as Haptics from '@/utils/haptics'
import toast from '@/utils/toast'

export default function DlnaCastModal() {
	const theme = useTheme()
	const insets = useSafeAreaInsets()
	const currentTrack = useCurrentTrack()
	const castingDevice = useDlnaCastStore((s) => s.castingDevice)
	const castingTitle = useDlnaCastStore((s) => s.castingTitle)
	const [devices, setDevices] = useState<DlnaDevice[]>([])
	const [discovering, setDiscovering] = useState(false)
	const [casting, setCasting] = useState(false)

	const refresh = useCallback(async () => {
		if (Platform.OS !== 'android') {
			toast.info('DLNA 投屏目前只支持 Android')
			return
		}
		setDiscovering(true)
		try {
			const found = await discoverDlnaDevices(3500)
			setDevices(found)
			if (found.length === 0) {
				toast.info('没有发现 DLNA 设备', {
					description: '确认音箱和手机在同一 Wi-Fi',
				})
			}
		} catch (e) {
			toastAndLogError('搜索 DLNA 设备失败', e, 'UI.Player.Dlna')
		} finally {
			setDiscovering(false)
		}
	}, [])

	const handleCast = useCallback(
		async (device: DlnaDevice) => {
			if (!currentTrack) {
				toast.error('当前没有在播的歌曲')
				return
			}
			setCasting(true)
			try {
				const source = await resolveCastSource(currentTrack)
				await playSourceOnDevice(device, source, true)
				void Haptics.performHaptics(Haptics.AndroidHaptics.Confirm)
				toast.success(`已投屏到 ${device.name}`)
				void useDlnaCastSheetStore.getState().close()
			} catch (e) {
				toastAndLogError('投屏失败', e, 'UI.Player.Dlna')
			} finally {
				setCasting(false)
			}
		},
		[currentTrack],
	)

	const handleStop = useCallback(async () => {
		setCasting(true)
		try {
			await disconnectDlnaCast()
			void Haptics.performHaptics(Haptics.AndroidHaptics.Confirm)
			toast.success('已停止投屏')
			void useDlnaCastSheetStore.getState().close()
		} catch (e) {
			toastAndLogError('停止投屏失败', e, 'UI.Player.Dlna')
		} finally {
			setCasting(false)
		}
	}, [])

	const visibleDevices =
		castingDevice &&
		!devices.some((d) => d.controlURL === castingDevice.controlURL)
			? [castingDevice, ...devices]
			: devices

	return (
		<TrueSheet
			name='dlnaCastModal'
			detents={['auto']}
			cornerRadius={24}
			backgroundColor={theme.colors.elevation.level1}
			onDidPresent={() => {
				useDlnaCastSheetStore.getState().setOpen(true)
				void refresh()
			}}
			onDidDismiss={() => {
				useDlnaCastSheetStore.getState().setOpen(false)
			}}
		>
			<View
				style={{
					paddingTop: 16,
					paddingBottom: insets.bottom + 20,
				}}
			>
				<View
					style={{
						flexDirection: 'row',
						alignItems: 'center',
						justifyContent: 'space-between',
						paddingHorizontal: 20,
						marginBottom: 8,
					}}
				>
					<Text variant='titleMedium'>投屏到音箱</Text>
					<IconButton
						icon='refresh'
						size={22}
						disabled={discovering || casting}
						onPress={() => void refresh()}
					/>
				</View>
				{discovering && visibleDevices.length === 0 ? (
					<View style={{ paddingVertical: 24, alignItems: 'center' }}>
						<ActivityIndicator />
						<Text
							variant='bodySmall'
							style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}
						>
							正在搜索局域网设备…
						</Text>
					</View>
				) : (
					visibleDevices.map((device) => {
						const connected = castingDevice?.controlURL === device.controlURL
						return (
							<List.Item
								key={device.udn ?? device.controlURL}
								title={device.name}
								description={
									connected
										? `点击断开${castingTitle ? ` · ${castingTitle}` : ''}`
										: [device.manufacturer, device.model]
												.filter(Boolean)
												.join(' · ')
								}
								disabled={casting}
								left={(props) => (
									<List.Icon
										{...props}
										icon={connected ? 'cast-connected' : 'cast'}
									/>
								)}
								onPress={() => {
									if (connected) {
										void handleStop()
										return
									}
									void handleCast(device)
								}}
							/>
						)
					})
				)}
			</View>
		</TrueSheet>
	)
}
