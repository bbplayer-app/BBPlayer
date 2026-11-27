import assert from 'node:assert/strict'
import test from 'node:test'

import { persistCustomPresetsWithRollback } from '../customPresetsWrite.ts'

function createPreset(id, name) {
	return {
		id,
		name,
		gainsDb: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
		preampDb: 0,
		isBuiltin: false,
	}
}

test('写入成功时保留乐观更新并等待写入完成', async () => {
	const previous = [createPreset('custom-1', '旧预设')]
	const next = [createPreset('custom-1', '新预设')]
	const applied = []
	let finished = false

	await persistCustomPresetsWithRollback(
		previous,
		next,
		(presets) => applied.push(presets),
		async (presets) => {
			assert.equal(finished, false)
			assert.deepEqual(presets, next)
			finished = true
		},
	)

	assert.equal(finished, true)
	assert.equal(applied.length, 1)
	assert.deepEqual(applied[0], next)
})

test('写入失败时回滚到调用前的预设并向调用方抛出', async () => {
	const previous = [createPreset('custom-1', '旧预设')]
	const next = [createPreset('custom-1', '新预设')]
	const applied = []
	const failure = new Error('storage failed')

	await assert.rejects(
		persistCustomPresetsWithRollback(
			previous,
			next,
			(presets) => applied.push(presets),
			async () => {
				throw failure
			},
		),
		(error) => error === failure,
	)

	assert.equal(applied.length, 2)
	assert.deepEqual(applied[0], next)
	assert.deepEqual(applied[1], previous)
	assert.notEqual(applied[1], previous)
})

test('回滚不会改写传入的预设数组', async () => {
	const previous = [createPreset('custom-1', '旧预设')]
	const next = [createPreset('custom-2', '新预设')]

	await assert.rejects(
		persistCustomPresetsWithRollback(
			previous,
			next,
			() => {},
			async () => {
				throw new Error('nope')
			},
		),
	)

	assert.deepEqual(previous, [createPreset('custom-1', '旧预设')])
	assert.deepEqual(next, [createPreset('custom-2', '新预设')])
})
