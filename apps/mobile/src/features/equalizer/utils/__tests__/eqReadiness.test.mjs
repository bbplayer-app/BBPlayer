import assert from 'node:assert/strict'
import test from 'node:test'

import {
	canWriteCustomPresets,
	canWriteSettings,
	createEqReadiness,
	isEqDataLoading,
	isPresetsFailed,
	isSettingsFailed,
	resolveEditingCustomPresetId,
} from '../eqReadiness.ts'

test('createEqReadiness 在不支持的平台直接视为就绪', () => {
	const readiness = createEqReadiness(false)

	assert.equal(readiness.settings, 'ready')
	assert.equal(readiness.presets, 'ready')
	assert.equal(isEqDataLoading(readiness), false)
	assert.equal(canWriteSettings(readiness), true)
	assert.equal(canWriteCustomPresets(readiness), true)
})

test('createEqReadiness 在支持的平台先进入加载中且禁止写入', () => {
	const readiness = createEqReadiness(true)

	assert.equal(readiness.settings, 'loading')
	assert.equal(readiness.presets, 'loading')
	assert.equal(isEqDataLoading(readiness), true)
	assert.equal(canWriteSettings(readiness), false)
	assert.equal(canWriteCustomPresets(readiness), false)
})

test('两类数据各自就绪：设置失败不影响预设写入门禁', () => {
	const readiness = {
		settings: 'error',
		presets: 'ready',
	}

	assert.equal(isSettingsFailed(readiness), true)
	assert.equal(isPresetsFailed(readiness), false)
	assert.equal(canWriteSettings(readiness), false)
	assert.equal(canWriteCustomPresets(readiness), true)
	assert.equal(isEqDataLoading(readiness), false)
})

test('两类数据各自就绪：预设失败不影响设置写入门禁', () => {
	const readiness = {
		settings: 'ready',
		presets: 'error',
	}

	assert.equal(isSettingsFailed(readiness), false)
	assert.equal(isPresetsFailed(readiness), true)
	assert.equal(canWriteSettings(readiness), true)
	assert.equal(canWriteCustomPresets(readiness), false)
})

test('resolveEditingCustomPresetId 只认自定义预设', () => {
	const presets = [
		{
			id: 'custom-1',
			name: '自定义一',
			gainsDb: [],
			preampDb: 0,
			isBuiltin: false,
		},
	]

	assert.equal(resolveEditingCustomPresetId('custom-1', presets), 'custom-1')
	assert.equal(resolveEditingCustomPresetId('flat', presets), null)
	assert.equal(resolveEditingCustomPresetId(null, presets), null)
})
