import toast from '@/utils/toast'

export interface AudioQualityMessage {
	message: string
	description?: string
}

export const QUALITY_MESSAGES = {
	switched: (label: string): AudioQualityMessage => ({
		message: `已切换至 ${label}`,
	}),
	fallback: (target: string, actual: string | null): AudioQualityMessage => ({
		message: `${target} 本曲暂不支持`,
		description: actual
			? `实际使用 ${actual}`
			: '已自动降级到当前可用的最高档位',
	}),
	unconfirmed: {
		message: '切换结果未确认',
		description: '卡片已标记为未确认，可点「重新检查」重新读取实际音质',
	},
	recheckOk: {
		message: '已重新读取当前音质',
	},
	recheckStillUnknown: {
		message: '仍未能确认实际音质',
	},
	alreadyCurrent: (label: string): AudioQualityMessage => ({
		message: `当前已经是 ${label}`,
	}),
	setDefaultOffline: (label: string): AudioQualityMessage => ({
		message: `已设为默认 ${label}，当前离线缓存不再重新加载`,
		description: '下一首或重新下载后生效',
	}),
	setDefault: (label: string): AudioQualityMessage => ({
		message: `已设为默认 ${label}`,
		description: '当前曲目不是 B 站音源，无法即时重新加载',
	}),
	setDefaultNoTrack: (label: string): AudioQualityMessage => ({
		message: `已设为默认 ${label}，当前没有播放中的曲目`,
		description: '下一首播放时生效',
	}),
	switchFailed: {
		message: '切换音质失败',
		description: '未能重新加载当前曲目',
	},
	preferenceWriteFailed: {
		message: '设置音质偏好失败',
	},
	loadFailed: {
		message: '读取当前音质失败',
	},
} as const

export function showQualityMessage(message: AudioQualityMessage) {
	if (message.description) {
		toast.info(message.message, { description: message.description })

		return
	}

	toast.info(message.message)
}
