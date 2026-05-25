import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

import sharp from 'sharp'

const require = createRequire(import.meta.url)
const { GIFEncoder, applyPalette, quantize } = require('gifenc')

const [inputDir, outputFile, fpsArg = '20'] = process.argv.slice(2)

if (!inputDir || !outputFile) {
	process.stderr.write(
		'Usage: node encode-gif-from-frames.mjs <frames-dir> <output.gif> [fps]\n',
	)
	process.exit(1)
}

const fps = Number(fpsArg)
const delay = Math.max(1, Math.round(100 / (Number.isFinite(fps) ? fps : 20)))
const frameFiles = fs
	.readdirSync(inputDir)
	.filter((file) => file.endsWith('.png'))
	.sort()
	.map((file) => path.join(inputDir, file))

if (frameFiles.length === 0) {
	throw new Error(`No PNG frames found in ${inputDir}`)
}

const firstFrame = await sharp(frameFiles[0]).metadata()
const width = firstFrame.width
const height = firstFrame.height

if (!width || !height) {
	throw new Error(`Unable to read frame size from ${frameFiles[0]}`)
}

const encoder = GIFEncoder()

for (const [index, file] of frameFiles.entries()) {
	const { data, info } = await sharp(file)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true })

	if (info.width !== width || info.height !== height || info.channels !== 4) {
		throw new Error(`Frame size mismatch: ${file}`)
	}

	const palette = [
		[0, 0, 0],
		...quantize(data, 255, {
			clearAlpha: true,
			clearAlphaColor: 0,
			clearAlphaThreshold: 8,
		}),
	]
	const indexed = applyPalette(data, palette)

	for (let pixel = 0; pixel < width * height; pixel += 1) {
		if (data[pixel * 4 + 3] <= 8) {
			indexed[pixel] = 0
		}
	}

	encoder.writeFrame(indexed, width, height, {
		delay,
		dispose: 2,
		palette,
		repeat: 0,
		transparent: true,
		transparentIndex: 0,
	})

	if (index === frameFiles.length - 1) {
		encoder.finish()
	}
}

fs.mkdirSync(path.dirname(outputFile), { recursive: true })
fs.writeFileSync(outputFile, encoder.bytes())
