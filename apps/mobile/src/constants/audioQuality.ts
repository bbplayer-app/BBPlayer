import type {
	AudioQualityInfo,
	AudioQualityPreference,
	DolbySupportLevel,
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
			'B 站杜比全景声音源，需视频本身支持与大会员，不支持时自动降级。设备支持杜比全景声才有空间效果；直通播放时不参与响度均衡。',
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
 * 设备不能完整播放杜比全景声时给杜比档位的说明。
 * 返回 disabled 时该档位不可选：只能 FFmpeg 软解，听到的是 5.1 下混，原生层会改按 Hi-Res 请求
 */
export function getDolbyOptionNotice(
	level: DolbySupportLevel | null,
): { disabled: boolean; text: string } | null {
	if (level === 'none') {
		return {
			disabled: true,
			text: '此设备不能解码或直通杜比全景声，软解只有普通多声道下混，所以不可选；之前选了杜比的会按 Hi-Res 无损播放。',
		}
	}

	if (level === 'dolby') {
		return {
			disabled: false,
			text: '此设备能解码杜比数字+，但没有全景声解码器，空间效果取决于厂商实现，可能只是普通多声道下混。',
		}
	}

	return null
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

/**
 * @param currentPreference 当前的音质偏好。音质按曲目固定在开始加载时的偏好上，
 * 在设置页改了默认档位后，正在播放的这首仍是旧档位，需要说明一下
 */
export function formatActualAudioQuality(
	info: AudioQualityInfo | null,
	currentPreference?: AudioQualityPreference,
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

	if (
		currentPreference !== undefined &&
		info.preferredQuality !== currentPreference
	) {
		notes.push(
			`这首按之前的「${getAudioQualityOption(info.preferredQuality).label}」加载，「${getAudioQualityOption(currentPreference).label}」从下一首起生效`,
		)
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

export interface AudioQualityReadVersion {
	begin: () => number
	invalidate: () => void
	isCurrent: (token: number) => boolean
}

export function createAudioQualityReadVersion(): AudioQualityReadVersion {
	let version = 0

	return {
		begin: () => {
			version += 1

			return version
		},
		invalidate: () => {
			version += 1
		},
		isCurrent: (token) => token === version,
	}
}

export function shouldSkipAudioQualitySwitch(params: {
	preference: AudioQualityPreference
	next: AudioQualityPreference
	actualQuality: AudioQualityInfo | null
}): boolean {
	const { preference, next, actualQuality } = params
	const actualPreference = resolveActualAudioQualityPreference(actualQuality)

	if (actualPreference !== next) {
		return false
	}

	const isDegraded =
		actualQuality?.isFallback === true || actualPreference !== preference

	return !isDegraded
}

export type AudioQualityEventOutcome = 'awaiting' | 'applied' | 'fallback'

export function resolveAudioQualityEventOutcome(
	info: AudioQualityInfo,
	pending: AudioQualityPreference,
): AudioQualityEventOutcome {
	const actualPreference = resolveActualAudioQualityPreference(info)

	if (actualPreference !== null) {
		return actualPreference === pending ? 'applied' : 'fallback'
	}

	// 还没拿到解析结果（unknown）或者读的是离线文件（local）时继续等；
	// durl、未知音轨 id 之类拿到了结果却对不上任何档位的，按降级处理，不然会一直等到超时
	if (
		info.isFromDownloadCache ||
		info.actualKind === 'unknown' ||
		info.actualKind === 'local'
	) {
		return 'awaiting'
	}

	return 'fallback'
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
