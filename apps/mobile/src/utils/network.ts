import { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo'

/**
 * 判断当前是否处于真正的离线状态。
 *
 * 针对 NetInfo 的 isConnected 在连接 VPN 时可能出现假阳性（isConnected 为 true 但无互联网）的问题，
 * 采用以下策略：
 * 1. 如果 isConnected 为 false，则判定为离线。
 * 2. 如果 isConnected 为 true：
 *    - 如果是 wifi 或 cellular 类型，判定为在线（忽略 isInternetReachable 的假阴性）。
 *    - 如果是其他类型（如 vpn, ethernet 等），检查 isInternetReachable。
 *      如果 isInternetReachable 为 false，则判定为离线。
 */
export const isActuallyOffline = (state: NetInfoState): boolean => {
	if (state.isConnected === false) {
		return true
	}

	if (
		state.type === NetInfoStateType.wifi ||
		state.type === NetInfoStateType.cellular
	) {
		return false
	}

	// 对于 VPN 等其他类型，使用 isInternetReachable 判断
	// 如果 isInternetReachable 为 null，说明还在检测中，暂不判定为离线
	return state.isInternetReachable === false
}
