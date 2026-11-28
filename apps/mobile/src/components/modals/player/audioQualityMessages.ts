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
		message: `这首没有 ${target}`,
		description: actual ? `已改用 ${actual}` : '已改用能用的最高档',
	}),
	unconfirmed: {
		message: '还没确认切换结果',
		description: '可以在面板里点「重新检查」',
	},
	recheckOk: {
		message: '已刷新当前音质',
	},
	recheckStillUnknown: {
		message: '还是没能确认当前音质',
	},
	alreadyCurrent: (label: string): AudioQualityMessage => ({
		message: `当前已经是 ${label}`,
	}),
	setDefaultOffline: (label: string): AudioQualityMessage => ({
		message: `默认音质已改为 ${label}`,
		description: '这首是下载好的文件，不受影响',
	}),
	setDefault: (label: string): AudioQualityMessage => ({
		message: `已设为默认 ${label}`,
		description: '这首不是 B 站的音源，不受影响',
	}),
	setDefaultNoTrack: (label: string): AudioQualityMessage => ({
		message: `默认音质已改为 ${label}`,
		description: '下一首开始生效',
	}),
	setDefaultSpectrum: (label: string): AudioQualityMessage => ({
		message: `默认音质已改为 ${label}`,
		description: '开着频谱时只能放普通音质，关掉频谱后下一首起生效',
	}),
	switchFailed: {
		message: '切换失败',
		description: '这首没能重新加载，可以再试一次',
	},
	preferenceWriteFailed: {
		message: '保存默认音质失败',
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
