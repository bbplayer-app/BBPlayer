export const EQ_BAND_COUNT = 10

export const EQ_FREQUENCIES = [
	31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000,
] as const

export const EQ_DEFAULT_SAMPLE_RATE = 44100

export const EQ_MIN_GAIN_DB = -12

export const EQ_MAX_GAIN_DB = 12

export const EQ_CURVE_MIN_FREQUENCY_HZ = 20

export const EQ_CURVE_MAX_FREQUENCY_HZ = 20000

export const EQ_CURVE_POINT_COUNT = 128

export const EQ_BYPASS_GAIN_DB = 0.01

const EQ_PEAKING_Q = Math.SQRT2

const DECIBEL_PER_LOG_UNIT = 10 / Math.LN10

const NEGLIGIBLE_POWER = Number.EPSILON * Number.EPSILON

export interface EqCurveTable {
	frequencies: number[]
	xRatios: number[]
	cosW: number[]
	sinW: number[]
	cosW2: number[]
	sinW2: number[]
	bandCosW0: number[]
	bandSinW0: number[]
}

function generateLogFrequencies(pointCount: number): number[] {
	const logMin = Math.log(EQ_CURVE_MIN_FREQUENCY_HZ)

	const logMax = Math.log(EQ_CURVE_MAX_FREQUENCY_HZ)

	const step = (logMax - logMin) / (pointCount - 1)

	const frequencies: number[] = []

	for (let point = 0; point < pointCount; point += 1) {
		frequencies.push(Math.exp(logMin + step * point))
	}

	return frequencies
}

export function buildEqCurveTable(
	pointCount: number = EQ_CURVE_POINT_COUNT,
): EqCurveTable {
	const frequencies = generateLogFrequencies(pointCount)

	const frequencyRange = Math.log(
		EQ_CURVE_MAX_FREQUENCY_HZ / EQ_CURVE_MIN_FREQUENCY_HZ,
	)

	const xRatios: number[] = []

	const cosW: number[] = []

	const sinW: number[] = []

	const cosW2: number[] = []

	const sinW2: number[] = []

	for (const frequency of frequencies) {
		const w = (2 * Math.PI * frequency) / EQ_DEFAULT_SAMPLE_RATE

		xRatios.push(
			Math.min(
				Math.max(
					Math.log(frequency / EQ_CURVE_MIN_FREQUENCY_HZ) / frequencyRange,
					0,
				),
				1,
			),
		)

		cosW.push(Math.cos(w))

		sinW.push(Math.sin(w))

		cosW2.push(Math.cos(2 * w))

		sinW2.push(Math.sin(2 * w))
	}

	const bandCosW0: number[] = []

	const bandSinW0: number[] = []

	for (const frequency of EQ_FREQUENCIES) {
		const w0 = (2 * Math.PI * frequency) / EQ_DEFAULT_SAMPLE_RATE

		bandCosW0.push(Math.cos(w0))

		bandSinW0.push(Math.sin(w0))
	}

	return {
		frequencies,
		xRatios,
		cosW,
		sinW,
		cosW2,
		sinW2,
		bandCosW0,
		bandSinW0,
	}
}

export const EQ_CURVE_TABLE: EqCurveTable = buildEqCurveTable()

function clampEqGainWorklet(gainDb: number): number {
	'worklet'

	if (!Number.isFinite(gainDb)) return 0

	return Math.min(EQ_MAX_GAIN_DB, Math.max(EQ_MIN_GAIN_DB, gainDb))
}

export function evaluateEqResponseWorklet(
	gainsDb: readonly number[],
	preampDb: number,
	table: EqCurveTable,
): number[] {
	'worklet'

	const pointCount = table.cosW.length

	const preamp = clampEqGainWorklet(preampDb)

	const powerRatios = new Array<number>(pointCount)

	for (let point = 0; point < pointCount; point += 1) {
		powerRatios[point] = 1
	}

	const bandCount = table.bandCosW0.length

	for (let band = 0; band < bandCount; band += 1) {
		const gainDb = clampEqGainWorklet(gainsDb[band])

		if (Math.abs(gainDb) < EQ_BYPASS_GAIN_DB) continue

		const amplitude = Math.pow(10, gainDb / 40)

		const sqrtAmplitude = Math.pow(10, gainDb / 80)

		const cosW0 = table.bandCosW0[band]

		const sinW0 = table.bandSinW0[band]

		let b0 = 1

		let b1 = 0

		let b2 = 0

		let a1 = 0

		let a2 = 0

		let a0 = 1

		if (band === 0) {
			const alpha = (sinW0 / 2) * Math.SQRT2

			const shelfAlpha = 2 * sqrtAmplitude * alpha

			b0 = amplitude * (amplitude + 1 - (amplitude - 1) * cosW0 + shelfAlpha)

			b1 = 2 * amplitude * (amplitude - 1 - (amplitude + 1) * cosW0)

			b2 = amplitude * (amplitude + 1 - (amplitude - 1) * cosW0 - shelfAlpha)

			a1 = -2 * (amplitude - 1 + (amplitude + 1) * cosW0)

			a2 = amplitude + 1 + (amplitude - 1) * cosW0 - shelfAlpha

			a0 = amplitude + 1 + (amplitude - 1) * cosW0 + shelfAlpha
		} else if (band === bandCount - 1) {
			const alpha = (sinW0 / 2) * Math.SQRT2

			const shelfAlpha = 2 * sqrtAmplitude * alpha

			b0 = amplitude * (amplitude + 1 + (amplitude - 1) * cosW0 + shelfAlpha)

			b1 = -2 * amplitude * (amplitude - 1 + (amplitude + 1) * cosW0)

			b2 = amplitude * (amplitude + 1 + (amplitude - 1) * cosW0 - shelfAlpha)

			a1 = 2 * (amplitude - 1 - (amplitude + 1) * cosW0)

			a2 = amplitude + 1 - (amplitude - 1) * cosW0 - shelfAlpha

			a0 = amplitude + 1 - (amplitude - 1) * cosW0 + shelfAlpha
		} else {
			const alpha = sinW0 / (2 * EQ_PEAKING_Q)

			b0 = 1 + alpha * amplitude

			b1 = -2 * cosW0

			b2 = 1 - alpha * amplitude

			a1 = -2 * cosW0

			a2 = 1 - alpha / amplitude

			a0 = 1 + alpha / amplitude
		}

		const n0 = b0 / a0

		const n1 = b1 / a0

		const n2 = b2 / a0

		const d1 = a1 / a0

		const d2 = a2 / a0

		for (let point = 0; point < pointCount; point += 1) {
			const cosW = table.cosW[point]

			const sinW = table.sinW[point]

			const cosW2 = table.cosW2[point]

			const sinW2 = table.sinW2[point]

			const numeratorReal = n0 + n1 * cosW + n2 * cosW2

			const numeratorImaginary = -(n1 * sinW + n2 * sinW2)

			const denominatorReal = 1 + d1 * cosW + d2 * cosW2

			const denominatorImaginary = -(d1 * sinW + d2 * sinW2)

			const numeratorPower =
				numeratorReal * numeratorReal + numeratorImaginary * numeratorImaginary

			const denominatorPower =
				denominatorReal * denominatorReal +
				denominatorImaginary * denominatorImaginary

			if (
				!Number.isFinite(numeratorPower) ||
				!Number.isFinite(denominatorPower) ||
				numeratorPower <= NEGLIGIBLE_POWER ||
				denominatorPower <= NEGLIGIBLE_POWER
			) {
				continue
			}

			powerRatios[point] =
				powerRatios[point] * (numeratorPower / denominatorPower)
		}
	}

	const response = new Array<number>(pointCount)

	for (let point = 0; point < pointCount; point += 1) {
		const value = preamp + DECIBEL_PER_LOG_UNIT * Math.log(powerRatios[point])

		response[point] = Number.isFinite(value) ? value : preamp
	}

	return response
}
