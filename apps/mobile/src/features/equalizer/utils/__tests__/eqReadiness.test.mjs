import assert from 'node:assert/strict'
import test from 'node:test'

import {
	resolveEditingCustomPresetId,
	resolvePresetsStatus,
} from '../eqReadiness.ts'

test('自定义预设返回空串时视为读取失败', () => {
	assert.equal(
		resolvePresetsStatus({ status: 'fulfilled', value: '' }),
		'error',
	)
})

test('自定义预设读取被拒时视为失败', () => {
	assert.equal(
		resolvePresetsStatus({ status: 'rejected', reason: new Error('io') }),
		'error',
	)
})

test('明确的空列表才是就绪状态', () => {
	assert.equal(
		resolvePresetsStatus({ status: 'fulfilled', value: '[]' }),
		'ready',
	)
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
