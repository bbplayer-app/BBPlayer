import {
	EQ_BAND_COUNT,
	EQ_DEFAULT_SAMPLE_RATE,
	EQ_FREQUENCIES,
	clampEqGain,
	normalizeEqGains,
} from '../equalizerPresets.ts'

const EQ_PEAKING_Q = Math.SQRT2

const EQ_BYPASS_GAIN_DB = 0.01

const EQ_NYQUIST_RATIO = 0.45

const EQ_DEFAULT_POINT_COUNT = 64

const EQ_MIN_FREQUENCY_HZ = 20

const EQ_MAX_FREQUENCY_HZ = 20000

const EQ_MAX_FREQUENCY_POINTS = 4096

function identityCoefficients() {
	return { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 }
}

function isFiniteCoefficient(value) {
	return Number.isFinite(value)
}

function normalizeBiquad(coefficients, a0) {
	if (!Number.isFinite(a0) || a0 === 0) return identityCoefficients()

	const normalized = {
		b0: coefficients.b0 / a0,
		b1: coefficients.b1 / a0,
		b2: coefficients.b2 / a0,
		a1: coefficients.a1 / a0,
		a2: coefficients.a2 / a0,
	}

	const values = [
		normalized.b0,
		normalized.b1,
		normalized.b2,
		normalized.a1,
		normalized.a2,
	]

	if (!values.every(isFiniteCoefficient)) return identityCoefficients()

	return normalized
}

function designPeaking(a, cosW0, sinW0) {
	const alpha = sinW0 / (2 * EQ_PEAKING_Q)

	return normalizeBiquad(
		{
			b0: 1 + alpha * a,
			b1: -2 * cosW0,
			b2: 1 - alpha * a,
			a1: -2 * cosW0,
			a2: 1 - alpha / a,
		},
		1 + alpha / a,
	)
}

function designLowShelf(a, cosW0, sinW0) {
	const alpha = (sinW0 / 2) * Math.SQRT2
	const sqrtA = Math.sqrt(a)
	const shelfAlpha = 2 * sqrtA * alpha

	return normalizeBiquad(
		{
			b0: a * (a + 1 - (a - 1) * cosW0 + shelfAlpha),
			b1: 2 * a * (a - 1 - (a + 1) * cosW0),
			b2: a * (a + 1 - (a - 1) * cosW0 - shelfAlpha),
			a1: -2 * (a - 1 + (a + 1) * cosW0),
			a2: a + 1 + (a - 1) * cosW0 - shelfAlpha,
		},
		a + 1 + (a - 1) * cosW0 + shelfAlpha,
	)
}

function designHighShelf(a, cosW0, sinW0) {
	const alpha = (sinW0 / 2) * Math.SQRT2
	const sqrtA = Math.sqrt(a)
	const shelfAlpha = 2 * sqrtA * alpha

	return normalizeBiquad(
		{
			b0: a * (a + 1 + (a - 1) * cosW0 + shelfAlpha),
			b1: -2 * a * (a - 1 + (a + 1) * cosW0),
			b2: a * (a + 1 + (a - 1) * cosW0 - shelfAlpha),
			a1: 2 * (a - 1 - (a + 1) * cosW0),
			a2: a + 1 - (a - 1) * cosW0 - shelfAlpha,
		},
		a + 1 - (a - 1) * cosW0 + shelfAlpha,
	)
}

export function computeBiquadCoefficients(type, freqHz, gainDb, sampleRate) {
	const gain = Number.isFinite(gainDb) ? gainDb : 0
	const frequency = Number.isFinite(freqHz) ? freqHz : 0
	const rate = Number.isFinite(sampleRate) ? sampleRate : 0

	if (
		rate <= 0 ||
		frequency <= 0 ||
		frequency >= rate * EQ_NYQUIST_RATIO ||
		Math.abs(gain) < EQ_BYPASS_GAIN_DB
	) {
		return identityCoefficients()
	}

	const a = 10 ** (gain / 40)
	const w0 = (2 * Math.PI * frequency) / rate
	const cosW0 = Math.cos(w0)
	const sinW0 = Math.sin(w0)

	if (type === 'lowshelf') return designLowShelf(a, cosW0, sinW0)

	if (type === 'highshelf') return designHighShelf(a, cosW0, sinW0)

	return designPeaking(a, cosW0, sinW0)
}

function bandFilterType(band) {
	if (band === 0) return 'lowshelf'

	if (band === EQ_BAND_COUNT - 1) return 'highshelf'

	return 'peaking'
}

function bandFrequency(band) {
	return EQ_FREQUENCIES[band] ?? 0
}

function biquadMagnitudeDb(coefficients, frequency, sampleRate) {
	if (
		!Number.isFinite(frequency) ||
		frequency <= 0 ||
		frequency >= sampleRate / 2
	) {
		return 0
	}

	const w = (2 * Math.PI * frequency) / sampleRate
	const cosW = Math.cos(w)
	const sinW = Math.sin(w)
	const cosW2 = Math.cos(2 * w)
	const sinW2 = Math.sin(2 * w)

	const numeratorReal =
		coefficients.b0 + coefficients.b1 * cosW + coefficients.b2 * cosW2

	const numeratorImaginary = -(coefficients.b1 * sinW + coefficients.b2 * sinW2)

	const denominatorReal = 1 + coefficients.a1 * cosW + coefficients.a2 * cosW2

	const denominatorImaginary = -(
		coefficients.a1 * sinW +
		coefficients.a2 * sinW2
	)

	const numerator = Math.hypot(numeratorReal, numeratorImaginary)
	const denominator = Math.hypot(denominatorReal, denominatorImaginary)

	if (
		!Number.isFinite(numerator) ||
		!Number.isFinite(denominator) ||
		numerator <= Number.EPSILON ||
		denominator <= Number.EPSILON
	) {
		return 0
	}

	return 20 * Math.log10(numerator / denominator)
}

export function generateLogFrequencyPoints(
	count = EQ_DEFAULT_POINT_COUNT,
	minHz = EQ_MIN_FREQUENCY_HZ,
	maxHz = EQ_MAX_FREQUENCY_HZ,
) {
	const safeCount = Number.isFinite(count)
		? Math.min(EQ_MAX_FREQUENCY_POINTS, Math.max(2, Math.floor(count)))
		: EQ_DEFAULT_POINT_COUNT

	const min = Number.isFinite(minHz) && minHz > 0 ? minHz : EQ_MIN_FREQUENCY_HZ

	const max =
		Number.isFinite(maxHz) && maxHz > min ? maxHz : EQ_MAX_FREQUENCY_HZ

	const logMin = Math.log(min)

	const logMax = Math.log(max)

	const step = (logMax - logMin) / (safeCount - 1)

	const points = []

	for (let index = 0; index < safeCount; index += 1) {
		points.push(Math.exp(logMin + step * index))
	}

	return points
}

export function computeEqFrequencyResponse(
	gainsDb,
	preampDb = 0,
	sampleRate = EQ_DEFAULT_SAMPLE_RATE,
	freqPoints = generateLogFrequencyPoints(),
) {
	const rate =
		Number.isFinite(sampleRate) && sampleRate > 0
			? sampleRate
			: EQ_DEFAULT_SAMPLE_RATE

	const gains = normalizeEqGains(gainsDb)

	const preamp = clampEqGain(Number.isFinite(preampDb) ? preampDb : 0)

	const points =
		freqPoints.length > 0 ? freqPoints : generateLogFrequencyPoints()

	const bands = gains.map((gain, band) =>
		computeBiquadCoefficients(
			bandFilterType(band),
			bandFrequency(band),
			gain,
			rate,
		),
	)

	return points.map((frequency) => {
		let total = preamp

		for (const coefficients of bands) {
			total += biquadMagnitudeDb(coefficients, frequency, rate)
		}

		return Number.isFinite(total) ? total : preamp
	})
}
