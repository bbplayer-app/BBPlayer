import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const PAGE_FILE = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'../../../../app/settings/equalizer.tsx',
)

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

test('页面守卫：applyPreset 读取最新设置并只替换预设字段', () => {
	const applyPreset = extractCallbackCall(
		PAGE_SOURCE,
		'const applyPreset = useCallback',
	)

	assert.match(applyPreset, /settingsRef\.current/)
	assert.doesNotMatch(applyPreset, /currentSettings/)
	assert.match(applyPreset, /\.\.\.settingsRef\.current/)
	assert.match(applyPreset, /activePresetId: preset\.id/)
	assert.match(applyPreset, /gainsDb: \[\.\.\.preset\.gainsDb\]/)
	assert.match(applyPreset, /preampDb: preset\.preampDb/)
	assert.match(PAGE_SOURCE, /applyPreset\(preset\)/)
	assert.doesNotMatch(PAGE_SOURCE, /applyPreset\(preset, settings\)/)
})

test('页面守卫：commitSettings 先更新 ref 再更新 state', () => {
	const commitSettings = extractCallbackCall(
		PAGE_SOURCE,
		'const commitSettings = useCallback',
	)

	const readIndex = commitSettings.indexOf('update(settingsRef.current)')

	const refIndex = commitSettings.indexOf('settingsRef.current = next')

	const stateIndex = commitSettings.indexOf('setSettings(next)')

	assert.notEqual(readIndex, -1, '必须基于 ref 中的最新设置计算')
	assert.ok(refIndex > readIndex, '必须先写回 ref')
	assert.ok(stateIndex > refIndex, 'ref 必须早于 state 更新')
})

test('页面守卫：删除预设按最新 activePresetId 判定', () => {
	const deletePreset = extractCallbackCall(
		PAGE_SOURCE,
		'const handleDeletePreset = useCallback',
	)

	assert.match(deletePreset, /settingsRef\.current\.activePresetId !== id/)
	assert.doesNotMatch(deletePreset, /settings\.activePresetId/)
})

test('页面守卫：开关切换先同步提交设置，再调用原生，失败回滚到点击前快照', () => {
	for (const anchor of [
		'const handleToggleEnabled = useCallback',
		'const handleToggleLimiter = useCallback',
	]) {
		const block = extractCallbackCall(PAGE_SOURCE, anchor)

		assert.match(block, /settingsRef\.current/, `${anchor} 未读取最新设置`)
		assert.match(block, /commitSettings\(/, `${anchor} 未同步提交设置`)
		assert.doesNotMatch(block, /\bsettings\./, `${anchor} 仍在读闭包中的设置`)

		const previousIndex = block.indexOf('const previous = settingsRef.current')

		const commitIndex = block.indexOf('commitSettings(')

		const nativeIndex = block.indexOf('runEqualizerAction(')

		assert.ok(
			previousIndex !== -1 && previousIndex < commitIndex,
			`${anchor} 必须在乐观提交前捕获回滚快照`,
		)

		assert.ok(nativeIndex > commitIndex, `${anchor} 必须先提交设置再调用原生`)

		const rollbackIndex = block.indexOf('() => commitSettings(() => previous)')

		assert.ok(
			rollbackIndex > nativeIndex,
			`${anchor} 必须把回滚作为 runEqualizerAction 的失败回调`,
		)
	}
})

test('页面守卫：另存与覆盖预设的增益取自最新设置', () => {
	for (const anchor of [
		'const handleSavePresetAs = useCallback',
		'const handleOverwritePreset = useCallback',
	]) {
		const block = extractCallbackCall(PAGE_SOURCE, anchor)

		assert.match(block, /settingsRef\.current\.gainsDb/)
		assert.match(block, /settingsRef\.current\.preampDb/)
		assert.doesNotMatch(block, /\bsettings\.(gainsDb|preampDb)/)
	}
})
