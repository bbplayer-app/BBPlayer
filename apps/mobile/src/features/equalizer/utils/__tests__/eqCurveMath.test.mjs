import assert from 'node:assert/strict'
import test from 'node:test'

import {
	computeEqFrequencyResponse,
	generateLogFrequencyPoints,
} from '@bbplayer/orpheus/src/__tests__/eqResponseOracle.mjs'
import {
	BUILTIN_EQ_PRESETS,
	EQ_DEFAULT_SAMPLE_RATE,
	EQ_FREQUENCIES,
	EQ_MAX_GAIN_DB,
	EQ_MIN_GAIN_DB,
} from '@bbplayer/orpheus/src/equalizerPresets.ts'

import {
	EQ_BAND_COUNT,
	EQ_BYPASS_GAIN_DB,
	EQ_CURVE_MAX_FREQUENCY_HZ,
	EQ_CURVE_MIN_FREQUENCY_HZ,
	EQ_CURVE_POINT_COUNT,
	EQ_CURVE_TABLE,
	EQ_DEFAULT_SAMPLE_RATE as LOCAL_SAMPLE_RATE,
	EQ_FREQUENCIES as LOCAL_FREQUENCIES,
	EQ_MAX_GAIN_DB as LOCAL_MAX_GAIN_DB,
	EQ_MIN_GAIN_DB as LOCAL_MIN_GAIN_DB,
	evaluateEqResponseWorklet,
} from '../eqCurveMath.ts'

const MAX_TOLERANCE_DB = 1e-4

const FLAT_GAINS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

const ALTERNATING_EXTREMES = [12, -12, 12, -12, 12, -12, 12, -12, 12, -12]

function maxErrorDb(gainsDb, preampDb) {
	const expected = computeEqFrequencyResponse(
		gainsDb,
		preampDb,
		EQ_DEFAULT_SAMPLE_RATE,
		EQ_CURVE_TABLE.frequencies,
	)

	const actual = evaluateEqResponseWorklet(gainsDb, preampDb, EQ_CURVE_TABLE)

	assert.equal(
		actual.length,
		expected.length,
		`点数不一致：${actual.length} !== ${expected.length}`,
	)

	let maxError = 0

	for (let index = 0; index < expected.length; index += 1) {
		const error = Math.abs(actual[index] - expected[index])

		if (error > maxError) maxError = error
	}

	return maxError
}

function assertMatchesReference(gainsDb, preampDb, label) {
	const maxError = maxErrorDb(gainsDb, preampDb)

	assert.ok(
		maxError < MAX_TOLERANCE_DB,
		`${label} 最大误差 ${maxError} dB 超出 ${MAX_TOLERANCE_DB} dB`,
	)
}

test('内联常量与 orpheus 保持一致', () => {
	assert.deepEqual([...LOCAL_FREQUENCIES], [...EQ_FREQUENCIES])

	assert.equal(LOCAL_SAMPLE_RATE, EQ_DEFAULT_SAMPLE_RATE)

	assert.equal(LOCAL_MIN_GAIN_DB, EQ_MIN_GAIN_DB)

	assert.equal(LOCAL_MAX_GAIN_DB, EQ_MAX_GAIN_DB)

	assert.equal(EQ_CURVE_POINT_COUNT, 128)

	assert.equal(LOCAL_FREQUENCIES.length, EQ_BAND_COUNT)

	assert.equal(EQ_CURVE_MIN_FREQUENCY_HZ, 20)

	assert.equal(EQ_CURVE_MAX_FREQUENCY_HZ, 20000)

	assert.equal(EQ_BYPASS_GAIN_DB, 0.01)

	assert.deepEqual(
		EQ_CURVE_TABLE.frequencies,
		generateLogFrequencyPoints(EQ_CURVE_POINT_COUNT),
	)

	assert.equal(EQ_CURVE_TABLE.xRatios.length, EQ_CURVE_POINT_COUNT)

	assert.equal(EQ_CURVE_TABLE.bandCosW0.length, EQ_BAND_COUNT)
})

test('xRatios 单调递增且覆盖 0..1', () => {
	const ratios = EQ_CURVE_TABLE.xRatios

	assert.ok(ratios[0] >= 0)

	assert.ok(ratios[ratios.length - 1] <= 1)

	for (let index = 1; index < ratios.length; index += 1) {
		assert.ok(ratios[index] > ratios[index - 1], `xRatios 在 ${index} 处不递增`)
	}
})

test('平坦响应与参考实现完全一致', () => {
	assertMatchesReference(FLAT_GAINS, 0, '平坦响应')

	assert.equal(maxErrorDb(FLAT_GAINS, 0), 0)
})

test('全部内置预设逐点误差 < 1e-4 dB', () => {
	for (const preset of BUILTIN_EQ_PRESETS) {
		assertMatchesReference(preset.gainsDb, preset.preampDb, `预设 ${preset.id}`)
	}
})

test('正负 12dB 交替极端值逐点误差 < 1e-4 dB', () => {
	assertMatchesReference(ALTERNATING_EXTREMES, 0, '交替极端值')

	assertMatchesReference(
		ALTERNATING_EXTREMES.map((gain) => -gain),
		0,
		'反向交替极端值',
	)

	assertMatchesReference(
		new Array(EQ_BAND_COUNT).fill(EQ_MAX_GAIN_DB),
		0,
		'全 +12dB',
	)

	assertMatchesReference(
		new Array(EQ_BAND_COUNT).fill(EQ_MIN_GAIN_DB),
		0,
		'全 -12dB',
	)
})

test('非零前置增益逐点误差 < 1e-4 dB', () => {
	for (const preampDb of [12, 9, 3, 0.5, -0.5, -6, -12]) {
		assertMatchesReference(FLAT_GAINS, preampDb, `前置增益 ${preampDb}`)

		assertMatchesReference(
			BUILTIN_EQ_PRESETS[3].gainsDb,
			preampDb,
			`重低音 + 前置 ${preampDb}`,
		)
	}
})

test('NaN 与越界输入被安全兜底', () => {
	assertMatchesReference(
		[Number.NaN, 12.5, -99, 0.5, 0, 1, 2, 3, 4, 5],
		0,
		'越界频段增益',
	)

	assertMatchesReference(
		[
			Number.POSITIVE_INFINITY,
			Number.NEGATIVE_INFINITY,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
		],
		Number.NaN,
		'非有限输入',
	)

	assertMatchesReference(
		[0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
		EQ_MAX_GAIN_DB + 100,
		'前置增益越界',
	)

	const shortGains = evaluateEqResponseWorklet([6], 0, EQ_CURVE_TABLE)

	assert.equal(shortGains.length, EQ_CURVE_POINT_COUNT)

	assert.ok(shortGains.every((value) => Number.isFinite(value)))
})
