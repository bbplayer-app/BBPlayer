import assert from 'node:assert/strict'
import test from 'node:test'

import {
	getAudioQualityAccessHint,
	getVisibleAudioQualityOptions,
	resolveBilibiliAccountTier,
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
