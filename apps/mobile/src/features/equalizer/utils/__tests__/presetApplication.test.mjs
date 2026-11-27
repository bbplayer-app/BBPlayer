import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { buildPresetSettings } from '../presetSettings.ts'

const PAGE_FILE = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'../../../../app/settings/equalizer.tsx',
)

const FLAT_GAINS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

const PRESET_GAINS = [1, 2, 3, 4, 5, 6, 5, 4, 3, 2]

function createSettings(overrides = {}) {
	return {
		enabled: false,
		preampDb: 0,
		limiterEnabled: true,
		gainsDb: [...FLAT_GAINS],
		activePresetId: 'flat',
		...overrides,
	}
}

function createPreset(overrides = {}) {
	return {
		id: 'custom-1',
		name: '我的预设',
		gainsDb: [...PRESET_GAINS],
		preampDb: -2,
		isBuiltin: false,
		...overrides,
	}
}

function extractCallbackCall(source, anchor) {
	const start = source.indexOf(anchor)

	assert.notEqual(start, -1, `未找到 ${anchor}`)

	const open = source.indexOf('(', start + anchor.length)

	let depth = 0

	for (let index = open; index < source.length; index += 1) {
		const char = source[index]

		if (char === '(') depth += 1

		if (char === ')') {
			depth -= 1

			if (depth === 0) return source.slice(start, index + 1)
		}
	}

	throw new Error(`${anchor} 未闭合`)
}

const PAGE_SOURCE = fs.readFileSync(PAGE_FILE, 'utf8')

test('等待持久化期间修改 enabled，完成后不会被旧快照回滚', async () => {
	let latest = createSettings({ enabled: false, limiterEnabled: true })

	const applyPreset = (preset) => buildPresetSettings(preset, latest)

	const pending = Promise.resolve().then(() => {
		latest = createSettings({ enabled: true, limiterEnabled: false })

		return applyPreset(createPreset())
	})

	const next = await pending

	assert.equal(next.enabled, true)
	assert.equal(next.limiterEnabled, false)
	assert.equal(next.activePresetId, 'custom-1')
	assert.equal(next.preampDb, -2)
	assert.deepEqual(next.gainsDb, PRESET_GAINS)
})

test('应用预设只替换预设字段，其余字段保持最新设置', () => {
	const latest = createSettings({
		enabled: true,
		limiterEnabled: false,
		gainsDb: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
		preampDb: 3,
		activePresetId: null,
	})

	assert.deepEqual(buildPresetSettings(createPreset(), latest), {
		enabled: true,
		preampDb: -2,
		limiterEnabled: false,
		gainsDb: PRESET_GAINS,
		activePresetId: 'custom-1',
	})
})

test('应用预设不修改传入的设置对象与预设增益数组', () => {
	const latest = createSettings()

	const preset = createPreset()

	const next = buildPresetSettings(preset, latest)

	assert.deepEqual(latest.gainsDb, FLAT_GAINS)
	assert.deepEqual(preset.gainsDb, PRESET_GAINS)
	assert.notEqual(next.gainsDb, preset.gainsDb)
})

test('页面守卫：applyPreset 调用时读取最新设置，调用方不再传快照', () => {
	const applyPreset = extractCallbackCall(
		PAGE_SOURCE,
		'const applyPreset = useCallback',
	)

	assert.match(applyPreset, /settingsRef\.current/)
	assert.doesNotMatch(applyPreset, /currentSettings/)
	assert.match(PAGE_SOURCE, /applyPreset\(preset\)/)
	assert.doesNotMatch(PAGE_SOURCE, /applyPreset\(preset, settings\)/)
})

test('页面守卫：删除预设按最新 activePresetId 判定', () => {
	const deletePreset = extractCallbackCall(
		PAGE_SOURCE,
		'const handleDeletePreset = useCallback',
	)

	assert.match(deletePreset, /settingsRef\.current\.activePresetId !== id/)
	assert.doesNotMatch(deletePreset, /settings\.activePresetId/)
})
