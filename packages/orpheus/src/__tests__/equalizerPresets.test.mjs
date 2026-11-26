import assert from 'node:assert/strict'
import test from 'node:test'

import {
	BUILTIN_EQ_PRESETS,
	EQ_BAND_COUNT,
	EQ_BAND_LABELS,
	EQ_FREQUENCIES,
	EQ_MAX_GAIN_DB,
	EQ_MIN_GAIN_DB,
	clampEqGain,
	computeBiquadCoefficients,
	computeEqFrequencyResponse,
	generateLogFrequencyPoints,
	normalizeEqGains,
} from '../equalizerPresets.ts'

const FLAT_GAINS = Array.from({ length: EQ_BAND_COUNT }, () => 0)

const REQUIRED_PRESET_IDS = [
	'flat',
	'pop',
	'rock',
	'bass_boost',
	'vocal',
	'electronic',
	'classical',
	'soft_night',
]

function gainsWith(band, gainDb) {
	const gains = [...FLAT_GAINS]

	gains[band] = gainDb

	return gains
}

function assertClose(actual, expected, tolerance, message) {
	assert.ok(
		Math.abs(actual - expected) <= tolerance,
		`${message}: expected ${expected} ± ${tolerance}, got ${actual}`,
	)
}

test('内置预设恰好 8 套且参数在合法区间', () => {
	assert.equal(BUILTIN_EQ_PRESETS.length, 8)

	const ids = BUILTIN_EQ_PRESETS.map((preset) => preset.id)

	assert.equal(new Set(ids).size, ids.length)

	for (const id of REQUIRED_PRESET_IDS) {
		assert.ok(ids.includes(id), `缺少预设 ${id}`)
	}

	for (const preset of BUILTIN_EQ_PRESETS) {
		assert.equal(preset.isBuiltin, true, preset.id)
		assert.equal(preset.gainsDb.length, EQ_BAND_COUNT, preset.id)
		assert.ok(
			preset.preampDb >= EQ_MIN_GAIN_DB && preset.preampDb <= EQ_MAX_GAIN_DB,
			preset.id,
		)

		for (const gain of preset.gainsDb) {
			assert.ok(Number.isFinite(gain), preset.id)
			assert.ok(gain >= EQ_MIN_GAIN_DB && gain <= EQ_MAX_GAIN_DB, preset.id)
		}
	}
})

test('频段常量与前端标签一一对应', () => {
	assert.equal(EQ_FREQUENCIES.length, EQ_BAND_COUNT)
	assert.equal(EQ_BAND_LABELS.length, EQ_BAND_COUNT)
	assert.equal(EQ_FREQUENCIES[0], 31)
	assert.equal(EQ_FREQUENCIES[EQ_BAND_COUNT - 1], 16000)
	assert.deepEqual([...EQ_BAND_LABELS].slice(5, 7), ['1k', '2k'])
})

test('平坦预设全频段严格 0 dB', () => {
	const points = generateLogFrequencyPoints(128, 20, 20000)
	const response = computeEqFrequencyResponse(FLAT_GAINS, 0, 44100, points)

	assert.equal(response.length, points.length)

	for (const [index, value] of response.entries()) {
		assert.ok(
			Math.abs(value) < 1e-6,
			`${points[index]} Hz 应为 0 dB，实际 ${value}`,
		)
	}
})

test('1kHz +6 dB 单段提升在中心精确、远端收敛', () => {
	const [low, center, high] = computeEqFrequencyResponse(
		gainsWith(5, 6),
		0,
		44100,
		[31, 1000, 16000],
	)

	assertClose(center, 6, 0.05, '1kHz 中心增益')
	assertClose(low, 0, 0.25, '31Hz 远端点')
	assertClose(high, 0, 0.25, '16kHz 远端点')
})

test('31Hz 低架 +6 dB 只在低频抬升', () => {
	const [low, mid] = computeEqFrequencyResponse(
		gainsWith(0, 6),
		0,
		44100,
		[20, 4000],
	)

	assert.ok(low > 4, `20Hz 应显著提升，实际 ${low} dB`)
	assertClose(mid, 0, 0.25, '4kHz 远端点')
})

test('16kHz 高架 +6 dB 只在高频抬升', () => {
	const [low, high] = computeEqFrequencyResponse(
		gainsWith(9, 6),
		0,
		44100,
		[250, 18000],
	)

	assert.ok(high > 2, `18kHz 应明显提升，实际 ${high} dB`)
	assertClose(low, 0, 0.25, '250Hz 远端点')
})

test('Preamp -3 dB 精确平移全频段', () => {
	const points = generateLogFrequencyPoints(64, 20, 20000)
	const response = computeEqFrequencyResponse(FLAT_GAINS, -3, 44100, points)

	for (const value of response) {
		assertClose(value, -3, 1e-9, 'Preamp 平移')
	}
})

test('非法增益输入被归一化到 10 段合法区间', () => {
	const normalized = normalizeEqGains([
		99,
		-99,
		Number.NaN,
		Number.POSITIVE_INFINITY,
		6,
	])

	assert.equal(normalized.length, EQ_BAND_COUNT)
	assert.deepEqual(normalized.slice(0, 5), [12, -12, 0, 0, 6])
	assert.ok(normalized.every((gain) => Number.isFinite(gain)))
	assert.equal(normalizeEqGains(Array.from({ length: 15 }, () => 1)).length, 10)
	assert.deepEqual(normalizeEqGains([]), FLAT_GAINS)
	assert.equal(clampEqGain(Number.NaN), 0)
	assert.equal(clampEqGain(20), EQ_MAX_GAIN_DB)
	assert.equal(clampEqGain(-20), EQ_MIN_GAIN_DB)
})

test('低采样率下超奈奎斯特频段自动退化为直通且无 NaN', () => {
	const response = computeEqFrequencyResponse(
		gainsWith(9, 6),
		0,
		22050,
		[20, 1000, 8000, 16000, 20000],
	)

	for (const value of response) {
		assert.ok(Number.isFinite(value), `非有限值 ${value}`)
		assertClose(value, 0, 1e-9, '低采样率直通')
	}

	assert.deepEqual(computeBiquadCoefficients('highshelf', 16000, 6, 22050), {
		b0: 1,
		b1: 0,
		b2: 0,
		a1: 0,
		a2: 0,
	})
	assert.deepEqual(computeBiquadCoefficients('peaking', 1000, 0, 44100), {
		b0: 1,
		b1: 0,
		b2: 0,
		a1: 0,
		a2: 0,
	})
})
