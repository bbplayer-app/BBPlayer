import assert from 'node:assert/strict'
import test from 'node:test'

import {
	formatActualAudioQuality,
	formatAudioQualityLabel,
	getAudioQualityAccessHint,
	getAudioQualityOption,
	getVisibleAudioQualityOptions,
	resolveActualAudioQualityPreference,
	resolveAudioQualitySwitchOutcome,
	resolveBilibiliAccountTier,
	resolveSelectedAudioQualityPreference,
} from '../audioQuality.ts'

const qualityValues = (options) => options.map((option) => option.value)

const ALL_QUALITIES = ['low', 'standard', 'high', 'hires', 'dolby']

test('resolveBilibiliAccountTier 无 cookie 时返回 guest', () => {
	assert.equal(
		resolveBilibiliAccountTier({ hasCookie: false, navInfo: null }),
		'guest',
	)
	assert.equal(resolveBilibiliAccountTier({ hasCookie: false }), 'guest')
})

test('resolveBilibiliAccountTier 有 cookie 但 navInfo 缺失时保守降级为 logged_in', () => {
	assert.equal(resolveBilibiliAccountTier({ hasCookie: true }), 'logged_in')
	assert.equal(
		resolveBilibiliAccountTier({ hasCookie: true, navInfo: null }),
		'logged_in',
	)
})

test('resolveBilibiliAccountTier cookie 失效时返回 guest', () => {
	assert.equal(
		resolveBilibiliAccountTier({
			hasCookie: true,
			navInfo: { isLogin: false, vipStatus: 1 },
		}),
		'guest',
	)
})

test('resolveBilibiliAccountTier 普通登录返回 logged_in', () => {
	assert.equal(
		resolveBilibiliAccountTier({
			hasCookie: true,
			navInfo: { isLogin: true, vipStatus: 0 },
		}),
		'logged_in',
	)
})

test('resolveBilibiliAccountTier 顶层 vipStatus 为 1 时返回 vip', () => {
	assert.equal(
		resolveBilibiliAccountTier({
			hasCookie: true,
			navInfo: { isLogin: true, vipStatus: 1 },
		}),
		'vip',
	)
})

test('resolveBilibiliAccountTier 嵌套 vip.status 为 1 时返回 vip', () => {
	assert.equal(
		resolveBilibiliAccountTier({
			hasCookie: true,
			navInfo: { isLogin: true, vipStatus: 0, vip: { status: 1 } },
		}),
		'vip',
	)
})

test('getVisibleAudioQualityOptions 无曲目信息时按账号等级过滤', () => {
	assert.deepEqual(
		qualityValues(
			getVisibleAudioQualityOptions({
				accountTier: 'guest',
				availableQualities: null,
			}),
		),
		['low', 'standard'],
	)
	assert.deepEqual(
		qualityValues(
			getVisibleAudioQualityOptions({
				accountTier: 'logged_in',
				availableQualities: undefined,
			}),
		),
		['low', 'standard', 'high'],
	)
	assert.deepEqual(
		qualityValues(getVisibleAudioQualityOptions({ accountTier: 'vip' })),
		ALL_QUALITIES,
	)
})

test('getVisibleAudioQualityOptions 大会员遇到只支持 low/standard/high 的曲目时隐藏 hires/dolby', () => {
	assert.deepEqual(
		qualityValues(
			getVisibleAudioQualityOptions({
				accountTier: 'vip',
				availableQualities: ['low', 'standard', 'high'],
			}),
		),
		['low', 'standard', 'high'],
	)
})

test('getVisibleAudioQualityOptions 大会员曲目支持 hires 但不支持 dolby 时仅隐藏 dolby', () => {
	assert.deepEqual(
		qualityValues(
			getVisibleAudioQualityOptions({
				accountTier: 'vip',
				availableQualities: ['low', 'standard', 'high', 'hires'],
			}),
		),
		['low', 'standard', 'high', 'hires'],
	)
})

test('getVisibleAudioQualityOptions 普通登录即使曲目含 hires/dolby 也隐藏', () => {
	assert.deepEqual(
		qualityValues(
			getVisibleAudioQualityOptions({
				accountTier: 'logged_in',
				availableQualities: ALL_QUALITIES,
			}),
		),
		['low', 'standard', 'high'],
	)
})

test('getVisibleAudioQualityOptions 未登录即使曲目含 high 也隐藏', () => {
	assert.deepEqual(
		qualityValues(
			getVisibleAudioQualityOptions({
				accountTier: 'guest',
				availableQualities: ALL_QUALITIES,
			}),
		),
		['low', 'standard'],
	)
})

test('getVisibleAudioQualityOptions 离线缓存忽略曲目可用音轨', () => {
	assert.deepEqual(
		qualityValues(
			getVisibleAudioQualityOptions({
				accountTier: 'vip',
				availableQualities: ['low'],
				isFromDownloadCache: true,
			}),
		),
		ALL_QUALITIES,
	)
})

test('getVisibleAudioQualityOptions 曲目可用音轨为空时按账号等级过滤', () => {
	assert.deepEqual(
		qualityValues(
			getVisibleAudioQualityOptions({
				accountTier: 'vip',
				availableQualities: [],
			}),
		),
		ALL_QUALITIES,
	)
})

test('getVisibleAudioQualityOptions 大会员曲目仅支持 hires 时只显示 hires', () => {
	assert.deepEqual(
		qualityValues(
			getVisibleAudioQualityOptions({
				accountTier: 'vip',
				availableQualities: ['hires'],
			}),
		),
		['hires'],
	)
})

test('getVisibleAudioQualityOptions 账号与曲目交集为空时回退到账号允许集合', () => {
	assert.deepEqual(
		qualityValues(
			getVisibleAudioQualityOptions({
				accountTier: 'logged_in',
				availableQualities: ['dolby'],
			}),
		),
		['low', 'standard', 'high'],
	)
	assert.deepEqual(
		qualityValues(
			getVisibleAudioQualityOptions({
				accountTier: 'guest',
				availableQualities: ['hires', 'dolby'],
			}),
		),
		['low', 'standard'],
	)
})

test('getAudioQualityAccessHint 按账号等级返回简要提示', () => {
	assert.match(getAudioQualityAccessHint('guest') ?? '', /登录/)
	assert.match(getAudioQualityAccessHint('logged_in') ?? '', /大会员/)
	assert.equal(getAudioQualityAccessHint('vip'), null)
})

const createQualityInfo = (overrides = {}) => ({
	preferredQuality: 'high',
	actualKind: 'normal',
	actualStreamId: 30280,
	codecs: 'mp4a.40.2',
	bandwidth: 192000,
	isFallback: false,
	isFromDownloadCache: false,
	availableQualities: [],
	...overrides,
})

test('formatActualAudioQuality 无播放中曲目时返回 null', () => {
	assert.equal(formatActualAudioQuality(null), null)
})

test('formatActualAudioQuality 输出杜比与 Hi-Res 标题与带宽', () => {
	const dolby = formatActualAudioQuality(
		createQualityInfo({ actualKind: 'dolby', actualStreamId: 30250 }),
	)

	const hires = formatActualAudioQuality(
		createQualityInfo({ actualKind: 'hires', actualStreamId: 30251 }),
	)

	assert.equal(dolby?.title, '杜比全景声')
	assert.match(dolby?.subtitle ?? '', /192 kbps/)
	assert.equal(hires?.title, 'Hi-Res 无损')
	assert.match(hires?.subtitle ?? '', /192 kbps/)
})

test('formatActualAudioQuality 把普通音轨的 streamId 映射到具体档位', () => {
	assert.equal(
		formatActualAudioQuality(
			createQualityInfo({ actualStreamId: 30216, bandwidth: 64000 }),
		)?.title,
		'省流 64k',
	)
	assert.equal(
		formatActualAudioQuality(
			createQualityInfo({ actualStreamId: 30232, bandwidth: 132000 }),
		)?.title,
		'标准 132k',
	)
	assert.equal(
		formatActualAudioQuality(
			createQualityInfo({ actualStreamId: 30280, bandwidth: 192000 }),
		)?.title,
		'高品 192k',
	)
	assert.equal(
		formatActualAudioQuality(
			createQualityInfo({ actualStreamId: null, bandwidth: null }),
		)?.title,
		'B 站普通音轨',
	)
})

test('formatActualAudioQuality 对离线缓存与 durl 给出专门说明', () => {
	const local = formatActualAudioQuality(
		createQualityInfo({ actualKind: 'local' }),
	)

	const downloaded = formatActualAudioQuality(
		createQualityInfo({ isFromDownloadCache: true }),
	)

	assert.equal(local?.title, '离线已下载缓存')
	assert.equal(downloaded?.title, '离线已下载缓存')
	assert.match(downloaded?.subtitle ?? '', /不受音质偏好影响/)

	const durl = formatActualAudioQuality(
		createQualityInfo({ actualKind: 'durl', actualStreamId: null }),
	)

	assert.equal(durl?.title, '普通整段音轨')
})

test('formatActualAudioQuality 在降级时追加降级提示', () => {
	const degraded = formatActualAudioQuality(
		createQualityInfo({ preferredQuality: 'hires', isFallback: true }),
	)

	assert.match(degraded?.subtitle ?? '', /已自动降级/)

	const applied = formatActualAudioQuality(
		createQualityInfo({ preferredQuality: 'high', isFallback: false }),
	)

	assert.doesNotMatch(applied?.subtitle ?? '', /已自动降级/)
})

test('resolveActualAudioQualityPreference 把实际音轨映射为档位', () => {
	assert.equal(
		resolveActualAudioQualityPreference(
			createQualityInfo({ actualKind: 'dolby' }),
		),
		'dolby',
	)
	assert.equal(
		resolveActualAudioQualityPreference(
			createQualityInfo({ actualKind: 'hires' }),
		),
		'hires',
	)
	assert.equal(
		resolveActualAudioQualityPreference(
			createQualityInfo({ actualKind: 'normal', actualStreamId: 30216 }),
		),
		'low',
	)
	assert.equal(
		resolveActualAudioQualityPreference(
			createQualityInfo({ actualKind: 'normal', actualStreamId: 30232 }),
		),
		'standard',
	)
	assert.equal(
		resolveActualAudioQualityPreference(
			createQualityInfo({ actualKind: 'normal', actualStreamId: 30280 }),
		),
		'high',
	)
	assert.equal(
		resolveActualAudioQualityPreference(
			createQualityInfo({ actualKind: 'normal', actualStreamId: 30251 }),
		),
		null,
	)
	assert.equal(
		resolveActualAudioQualityPreference(
			createQualityInfo({ actualKind: 'durl', actualStreamId: null }),
		),
		null,
	)
	assert.equal(
		resolveActualAudioQualityPreference(
			createQualityInfo({ isFromDownloadCache: true }),
		),
		null,
	)
	assert.equal(resolveActualAudioQualityPreference(null), null)
})

test('resolveAudioQualitySwitchOutcome 判定成功、降级与未知', () => {
	assert.equal(
		resolveAudioQualitySwitchOutcome(
			createQualityInfo({ preferredQuality: 'hires', actualKind: 'hires' }),
			'hires',
		),
		'applied',
	)
	assert.equal(
		resolveAudioQualitySwitchOutcome(
			createQualityInfo({ preferredQuality: 'high', actualStreamId: 30280 }),
			'high',
		),
		'applied',
	)
	assert.equal(
		resolveAudioQualitySwitchOutcome(
			createQualityInfo({
				preferredQuality: 'hires',
				actualKind: 'normal',
				actualStreamId: 30280,
				isFallback: true,
			}),
			'hires',
		),
		'fallback',
	)
	assert.equal(
		resolveAudioQualitySwitchOutcome(
			createQualityInfo({
				preferredQuality: 'low',
				actualStreamId: 30232,
				isFallback: true,
			}),
			'low',
		),
		'fallback',
	)
	assert.equal(
		resolveAudioQualitySwitchOutcome(
			createQualityInfo({ actualKind: 'durl', actualStreamId: null }),
			'high',
		),
		'unknown',
	)
	assert.equal(
		resolveAudioQualitySwitchOutcome(
			createQualityInfo({ isFromDownloadCache: true }),
			'high',
		),
		'unknown',
	)
})

test('resolveSelectedAudioQualityPreference 回退到最近的可见档位', () => {
	const visible = getVisibleAudioQualityOptions({ accountTier: 'logged_in' })

	assert.equal(resolveSelectedAudioQualityPreference('high', visible), 'high')
	assert.equal(resolveSelectedAudioQualityPreference('hires', visible), 'high')
	assert.equal(
		resolveSelectedAudioQualityPreference(
			'dolby',
			getVisibleAudioQualityOptions({ accountTier: 'guest' }),
		),
		'standard',
	)
	assert.equal(
		resolveSelectedAudioQualityPreference('low', [
			{ value: 'high', label: '高品', badge: '192k', description: '' },
			{ value: 'hires', label: 'Hi-Res 无损', badge: '无损', description: '' },
		]),
		'high',
	)
	assert.equal(resolveSelectedAudioQualityPreference('dolby', []), 'dolby')
})

test('formatAudioQualityLabel 与 getAudioQualityOption 处理未知档位', () => {
	assert.equal(formatAudioQualityLabel('high'), '高品 (192k)')
	assert.equal(formatAudioQualityLabel('dolby'), '杜比全景声')
	assert.equal(getAudioQualityOption(undefined).value, 'high')
	assert.equal(getAudioQualityOption('low').value, 'low')
})

test('resolveAudioQualitySwitchOutcome 对 unknown 实际格式返回 unknown', () => {
	assert.equal(
		resolveAudioQualitySwitchOutcome(
			createQualityInfo({ actualKind: 'unknown', actualStreamId: null }),
			'high',
		),
		'unknown',
	)
	assert.equal(
		formatActualAudioQuality(createQualityInfo({ actualKind: 'unknown' }))
			?.title,
		'识别中',
	)
	assert.equal(
		formatActualAudioQuality(createQualityInfo({ actualKind: 'unknown' }))
			?.subtitle,
		'正在解析音源信息',
	)
})
