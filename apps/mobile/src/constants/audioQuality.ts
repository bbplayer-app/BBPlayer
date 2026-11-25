import type {
	AudioQualityInfo,
	AudioQualityPreference,
} from '@bbplayer/orpheus'

export interface AudioQualityOption {
	value: AudioQualityPreference
	label: string
	badge: string
	description: string
}

export interface ActualAudioQualityDescription {
	title: string
	subtitle?: string
}

const AUDIO_QUALITY_BY_PREFERENCE = {
	low: {
		value: 'low',
		label: '省流',
		badge: '64k',
		description: '约 64kbps，最省流量，适合流量紧张时听个响。',
	},
	standard: {
		value: 'standard',
		label: '标准',
		badge: '132k',
		description: '约 132kbps，普通耳机够用，比省流更耐听。',
	},
	high: {
		value: 'high',
		label: '高品',
		badge: '192k',
		description: '约 192kbps，音质与流量均衡（默认）。',
	},
	hires: {
		value: 'hires',
		label: 'Hi-Res 无损',
		badge: '无损',
		description: 'B 站 Hi-Res 无损音源，需登录且有大会员，不支持时自动降级。',
	},
	dolby: {
		value: 'dolby',
		label: '杜比全景声',
		badge: '杜比',
		description:
			'B 站杜比全景声音源，需视频本身支持与大会员，不支持时自动降级。',
	},
} satisfies Record<AudioQualityPreference, AudioQualityOption>

export const AUDIO_QUALITY_OPTIONS = [
	AUDIO_QUALITY_BY_PREFERENCE.low,
	AUDIO_QUALITY_BY_PREFERENCE.standard,
	AUDIO_QUALITY_BY_PREFERENCE.high,
	AUDIO_QUALITY_BY_PREFERENCE.hires,
	AUDIO_QUALITY_BY_PREFERENCE.dolby,
] satisfies readonly AudioQualityOption[]

/**
 * B 站账号权限等级
 */
export type BilibiliAccountTier = 'guest' | 'logged_in' | 'vip'

/**
 * 各权限等级可用的音质档位
 */
const ACCOUNT_TIER_QUALITIES: Record<
	BilibiliAccountTier,
	readonly AudioQualityPreference[]
> = {
	guest: ['low', 'standard'],
	logged_in: ['low', 'standard', 'high'],
	vip: ['low', 'standard', 'high', 'hires', 'dolby'],
}

interface BilibiliNavInfoLike {
	isLogin?: boolean
	vipStatus?: number
	vip?: { status?: number } | null
}

/**
 * 根据登录态与导航信息解析账号权限等级
 */
export function resolveBilibiliAccountTier(params: {
	hasCookie: boolean
	navInfo?: BilibiliNavInfoLike | null
}): BilibiliAccountTier {
	const { hasCookie, navInfo } = params

	if (!hasCookie) {
		return 'guest'
	}

	if (navInfo == null) {
		return 'logged_in'
	}

	if (navInfo.isLogin === false) {
		return 'guest'
	}

	if (navInfo.vipStatus === 1 || navInfo.vip?.status === 1) {
		return 'vip'
	}

	return 'logged_in'
}

/**
 * 过滤出账号权限与当前曲目真实可用音轨都支持的音质档位
 */
export function getVisibleAudioQualityOptions(params: {
	accountTier: BilibiliAccountTier
	availableQualities?: readonly AudioQualityPreference[] | null
	isFromDownloadCache?: boolean
}): readonly AudioQualityOption[] {
	const { accountTier, availableQualities, isFromDownloadCache } = params

	const accountQualities = ACCOUNT_TIER_QUALITIES[accountTier]

	const trackQualities =
		isFromDownloadCache === true ||
		availableQualities == null ||
		availableQualities.length === 0
			? null
			: new Set<AudioQualityPreference>(availableQualities)

	const matchedQualities = trackQualities
		? accountQualities.filter((quality) => trackQualities.has(quality))
		: accountQualities

	const visibleQualities =
		matchedQualities.length > 0 ? matchedQualities : accountQualities

	return AUDIO_QUALITY_OPTIONS.filter((option) =>
		visibleQualities.includes(option.value),
	)
}

/**
 * 获取当前账号权限下关于隐藏档位的简短提示
 */
export function getAudioQualityAccessHint(
	accountTier: BilibiliAccountTier,
): string | null {
	if (accountTier === 'guest') {
		return '未登录仅显示省流与标准音质，登录 B 站账号可解锁高品及以上'
	}

	if (accountTier === 'logged_in') {
		return '当前账号非大会员，已隐藏 Hi-Res 无损与杜比全景声'
	}

	return null
}

const NORMAL_STREAM_PREFERENCES = new Map<number, AudioQualityPreference>([
	[30216, 'low'],
	[30232, 'standard'],
	[30280, 'high'],
])

const FALLBACK_HINT = '该曲不支持所选档位或权限不足，已自动降级'

interface ActualKindDescription {
	title: string
	detail?: string
}

export function getAudioQualityOption(
	preference: AudioQualityPreference | undefined,
): AudioQualityOption {
	const option = preference
		? AUDIO_QUALITY_BY_PREFERENCE[preference]
		: undefined

	return option ?? AUDIO_QUALITY_BY_PREFERENCE.high
}

export function formatAudioQualityLabel(
	preference: AudioQualityPreference,
): string {
	const option = getAudioQualityOption(preference)

	if (option.label.includes(option.badge)) {
		return option.label
	}

	return `${option.label} (${option.badge})`
}

function formatBandwidth(bandwidth: number | null): string | undefined {
	if (bandwidth === null || bandwidth <= 0) {
		return undefined
	}

	const kbps = Math.round(bandwidth / 1000)

	return kbps > 0 ? `约 ${kbps} kbps` : undefined
}

function describeActualKind(info: AudioQualityInfo): ActualKindDescription {
	const bandwidth = formatBandwidth(info.bandwidth)

	if (info.actualKind === 'dolby') {
		return { title: '杜比全景声', detail: bandwidth ?? 'B 站杜比全景声音源' }
	}

	if (info.actualKind === 'hires') {
		return { title: 'Hi-Res 无损', detail: bandwidth ?? 'B 站 Hi-Res 无损音源' }
	}

	if (info.actualKind === 'durl') {
		return { title: '普通整段音轨', detail: '老视频只有整段音轨，无法单独选档' }
	}

	if (info.actualKind === 'unknown') {
		return { title: '识别中', detail: '正在解析音源信息' }
	}

	const preference =
		info.actualStreamId === null
			? undefined
			: NORMAL_STREAM_PREFERENCES.get(info.actualStreamId)

	if (preference) {
		const option = AUDIO_QUALITY_BY_PREFERENCE[preference]

		return { title: `${option.label} ${option.badge}`, detail: bandwidth }
	}

	return { title: 'B 站普通音轨', detail: bandwidth }
}

export function formatActualAudioQuality(
	info: AudioQualityInfo | null,
): ActualAudioQualityDescription | null {
	if (info === null) {
		return null
	}

	if (info.actualKind === 'local' || info.isFromDownloadCache) {
		return {
			title: '离线已下载缓存',
			subtitle: '正在播放本地文件，不受音质偏好影响',
		}
	}

	const detail = describeActualKind(info)
	const notes: string[] = []

	if (detail.detail) {
		notes.push(detail.detail)
	}

	if (info.isFallback) {
		notes.push(FALLBACK_HINT)
	}

	return {
		title: detail.title,
		subtitle: notes.length > 0 ? notes.join(' · ') : undefined,
	}
}

export function resolveActualAudioQualityPreference(
	info: AudioQualityInfo | null,
): AudioQualityPreference | null {
	if (info === null) {
		return null
	}

	if (info.actualKind === 'dolby') {
		return 'dolby'
	}

	if (info.actualKind === 'hires') {
		return 'hires'
	}

	if (info.isFromDownloadCache || info.actualStreamId === null) {
		return null
	}

	if (info.actualKind !== 'normal') {
		return null
	}

	return NORMAL_STREAM_PREFERENCES.get(info.actualStreamId) ?? null
}

export type AudioQualitySwitchOutcome = 'applied' | 'fallback' | 'unknown'

export function resolveAudioQualitySwitchOutcome(
	info: AudioQualityInfo,
	target: AudioQualityPreference,
): AudioQualitySwitchOutcome {
	const actualPreference = resolveActualAudioQualityPreference(info)

	if (actualPreference === null) {
		return 'unknown'
	}

	return actualPreference === target ? 'applied' : 'fallback'
}

export function resolveSelectedAudioQualityPreference(
	preference: AudioQualityPreference,
	options: readonly AudioQualityOption[],
): AudioQualityPreference {
	if (options.length === 0) {
		return preference
	}

	if (options.some((option) => option.value === preference)) {
		return preference
	}

	const targetIndex = AUDIO_QUALITY_OPTIONS.findIndex(
		(option) => option.value === preference,
	)

	let selected = options[0]
	let selectedDistance = Number.POSITIVE_INFINITY

	for (const option of options) {
		const index = AUDIO_QUALITY_OPTIONS.findIndex(
			(item) => item.value === option.value,
		)

		const distance = Math.abs(index - targetIndex)

		if (distance < selectedDistance) {
			selected = option
			selectedDistance = distance
		}
	}

	return selected.value
}
