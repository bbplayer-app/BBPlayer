import { Orpheus, type DolbySupportInfo } from '@bbplayer/orpheus'
import { useEffect, useState } from 'react'
import { Platform } from 'react-native'

import { reportErrorToSentry } from '@/utils/log'

/**
 * 读取设备播放杜比全景声的能力。直通能力跟随当前输出设备，所以每次挂载都重新查询。
 * 非 Android 或查询失败时返回 null，调用方不做限制
 */
export default function useDolbySupport(): DolbySupportInfo | null {
	const [support, setSupport] = useState<DolbySupportInfo | null>(null)

	useEffect(() => {
		if (Platform.OS !== 'android') return

		let cancelled = false

		void (async () => {
			try {
				const info = await Orpheus.getDolbySupport()

				if (!cancelled) setSupport(info)
			} catch (error) {
				reportErrorToSentry(error, '查询杜比支持失败', 'Player')
			}
		})()

		return () => {
			cancelled = true
		}
	}, [])

	return support
}
