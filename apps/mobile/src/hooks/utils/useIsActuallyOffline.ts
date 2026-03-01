import { useNetInfo } from '@react-native-community/netinfo'
import { useMemo } from 'react'

import { isActuallyOffline } from '@/utils/network'

/**
 * 一个增强版的网络离线状态 Hook。
 * 解决了 NetInfo 在 VPN 连接下 isConnected 判定不准确的问题。
 */
export const useIsActuallyOffline = () => {
	const state = useNetInfo()

	return useMemo(() => isActuallyOffline(state), [state])
}
