import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const MOBILE_DIR = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'../../../../..',
)

const BABEL_CONFIG = path.join(MOBILE_DIR, 'babel.config.js')

const requireFromMobile = createRequire(path.join(MOBILE_DIR, 'index.js'))

const babel = requireFromMobile('@babel/core')

const WORKLET_FACTORY_PATTERN =
	/([A-Za-z_$][\w$]*)\s*=\s*require\("react-native-worklets\/\.worklets\/\d+\.js"\)\.default\b/g

const FUNCTION_DECLARATION_PATTERN =
	/(?:^|[;}{\n])\s*function\s+([A-Za-z_$][\w$]*)\s*\(/g

const ARROW_FUNCTION_PATTERN =
	/(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g

const WORKLET_CLOSURE_PATTERN =
	/require\("react-native-worklets\/\.worklets\/\d+\.js"\)\.default\(\[([^\]]*)\]\)/g

const CORE_EQUALIZER_FILES = [
	'src/features/equalizer/components/EqResponseCurve.tsx',
	'src/features/equalizer/components/EqBandSliders.tsx',
	'src/app/settings/equalizer.tsx',
]

const CURVE_COMPONENT_FILE =
	'src/features/equalizer/components/EqResponseCurve.tsx'

const HOST_OBJECTS = ['Skia']

const COUNTER_EXAMPLE_SOURCE = `import { View } from 'react-native'
import { useDerivedValue, type SharedValue } from 'react-native-reanimated'

export function WorkletClosureProbe({
	items,
}: {
	items: readonly SharedValue<number>[]
}) {
	const value = useDerivedValue(
		() => items.map((item) => item.get()),
		[items],
	)

	return <View>{value.value}</View>
}
`

function transformProjectFile(relativeFile) {
	return babel.transformFileSync(path.join(MOBILE_DIR, relativeFile), {
		configFile: BABEL_CONFIG,
		cwd: MOBILE_DIR,
	}).code
}

function transformCounterExample() {
	const probeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bbplayer-worklet-'))

	try {
		const probeFile = path.join(probeDir, 'WorkletClosureProbe.tsx')

		fs.writeFileSync(probeFile, COUNTER_EXAMPLE_SOURCE, 'utf8')

		return babel.transformFileSync(probeFile, {
			configFile: BABEL_CONFIG,
			cwd: MOBILE_DIR,
		}).code
	} finally {
		fs.rmSync(probeDir, { force: true, recursive: true })
	}
}

function collectNames(pattern, code) {
	const names = new Set()

	pattern.lastIndex = 0

	let match = pattern.exec(code)

	while (match) {
		names.add(match[1])

		match = pattern.exec(code)
	}

	pattern.lastIndex = 0

	return names
}

function collectWorkletClosures(code) {
	const closures = []

	WORKLET_CLOSURE_PATTERN.lastIndex = 0

	let match = WORKLET_CLOSURE_PATTERN.exec(code)

	while (match) {
		closures.push(
			match[1]
				.split(',')
				.map((entry) => entry.trim())
				.filter(Boolean),
		)

		match = WORKLET_CLOSURE_PATTERN.exec(code)
	}

	WORKLET_CLOSURE_PATTERN.lastIndex = 0

	return closures
}

function findRemoteFunctionCaptures(code) {
	const workletFactories = collectNames(WORKLET_FACTORY_PATTERN, code)

	const plainFunctions = new Set([
		...collectNames(FUNCTION_DECLARATION_PATTERN, code),
		...collectNames(ARROW_FUNCTION_PATTERN, code),
	])

	const captures = []

	for (const closures of collectWorkletClosures(code)) {
		for (const entry of closures) {
			const identifier = entry.split('.').pop()

			if (plainFunctions.has(identifier) && !workletFactories.has(identifier)) {
				captures.push(entry)
			}
		}
	}

	return captures
}

function findHostObjectCaptures(code, hostObjects) {
	const captures = []

	for (const closures of collectWorkletClosures(code)) {
		for (const entry of closures) {
			const identifier = entry.split('.').pop()

			if (hostObjects.includes(identifier)) captures.push(entry)
		}
	}

	return captures
}

test('均衡器核心文件的 worklet 闭包不捕获非 worklet 普通函数', () => {
	for (const relativeFile of CORE_EQUALIZER_FILES) {
		const captures = findRemoteFunctionCaptures(
			transformProjectFile(relativeFile),
		)

		assert.deepEqual(
			captures,
			[],
			`${relativeFile} 的 worklet 闭包捕获了非 worklet 普通函数，运行时会在 UI 线程触发 Remote Function 异常`,
		)
	}
})

test('EqResponseCurve 的 worklet 闭包不捕获 Skia 宿主对象', () => {
	const code = transformProjectFile(CURVE_COMPONENT_FILE)

	assert.ok(
		collectWorkletClosures(code).length >= 3,
		'EqResponseCurve.tsx 未产出预期的 worklet 闭包，守卫已失效',
	)

	assert.deepEqual(
		findHostObjectCaptures(code, HOST_OBJECTS),
		[],
		'EqResponseCurve.tsx 的 worklet 闭包捕获了 Skia 宿主对象，Builder 必须在 JS 线程创建后经 SharedValue 复用',
	)
})

test('守卫自检：非 worklet 普通函数捕获必须被检出', () => {
	const captures = findRemoteFunctionCaptures(transformCounterExample())

	assert.notDeepEqual(
		captures,
		[],
		'守卫未能检出反例代码中的 Remote Function 捕获，检查逻辑已失效',
	)
})
