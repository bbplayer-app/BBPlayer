import assert from 'node:assert/strict'
import test from 'node:test'

import {
	BUILTIN_EQ_PRESETS,
	EQ_BAND_COUNT,
	EQ_MAX_GAIN_DB,
	EQ_MIN_GAIN_DB,
} from '@bbplayer/orpheus/src/equalizerPresets.ts'

import {
	BUILTIN_EQ_PRESET_IDS,
	deleteCustomPreset,
	findPresetDisplayName,
	parseCustomPresetsJson,
	renameCustomPreset,
	serializeCustomPresets,
	upsertCustomPreset,
} from '../customPresets.ts'

const FLAT_GAINS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

const BUILTIN_PRESETS = [
	{
		id: 'flat',
		name: '平坦',
		gainsDb: FLAT_GAINS,
		preampDb: 0,
		isBuiltin: true,
	},
	{
		id: 'pop',
		name: '流行',
		gainsDb: [-1.5, -0.5, 1.5, 3, 2, -1, -1, 0, 1.5, 1],
		preampDb: -2,
		isBuiltin: true,
	},
]

function createCustomPreset(overrides = {}) {
	return {
		id: 'custom-1',
		name: '我的预设',
		gainsDb: [1, 2, 3, 4, 5, 6, 5, 4, 3, 2],
		preampDb: -1,
		isBuiltin: false,
		...overrides,
	}
}

test('parseCustomPresetsJson 解析合法 JSON 并强制自定义标记', () => {
	const parsed = parseCustomPresetsJson(
		JSON.stringify([
			createCustomPreset(),
			createCustomPreset({
				id: 'custom-2',
				name: '  第二个  ',
				gainsDb: [1, 2, 3],
				isBuiltin: true,
			}),
		]),
	)

	assert.equal(parsed.length, 2)

	assert.deepEqual(parsed[0].gainsDb, createCustomPreset().gainsDb)

	assert.equal(parsed[1].name, '第二个')

	assert.equal(parsed[1].isBuiltin, false)

	assert.equal(parsed[1].gainsDb.length, 10)

	assert.deepEqual(parsed[1].gainsDb.slice(3), [0, 0, 0, 0, 0, 0, 0])

	assert.equal(parsed[0].preampDb, -1)
})

test('parseCustomPresetsJson 对损坏或非法 JSON 安全降级', () => {
	assert.deepEqual(parseCustomPresetsJson(''), [])

	assert.deepEqual(parseCustomPresetsJson('not json'), [])

	assert.deepEqual(parseCustomPresetsJson('null'), [])

	assert.deepEqual(parseCustomPresetsJson('{"id":"x"}'), [])

	assert.deepEqual(
		parseCustomPresetsJson(JSON.stringify([null, 42, 'text', [], {}])),
		[],
	)

	const filtered = parseCustomPresetsJson(
		JSON.stringify([
			createCustomPreset({ id: '' }),
			createCustomPreset({ name: '   ' }),
			createCustomPreset({ id: 'custom-broken', gainsDb: 'nope' }),
			createCustomPreset({
				id: 'custom-partial',
				name: '缺字段',
				gainsDb: undefined,
				preampDb: undefined,
			}),
			createCustomPreset(),
			createCustomPreset({ name: '重复 ID 应被丢弃' }),
		]),
	)

	assert.equal(filtered.length, 2)

	assert.equal(filtered[0].id, 'custom-partial')

	assert.deepEqual(filtered[0].gainsDb, FLAT_GAINS)

	assert.equal(filtered[0].preampDb, 0)

	assert.equal(filtered[1].name, '我的预设')
})

test('parseCustomPresetsJson 归一化越界增益与前置增益', () => {
	const [preset] = parseCustomPresetsJson(
		JSON.stringify([
			createCustomPreset({
				gainsDb: [99, -99, 0.5, 5.5, 7, 8, 9, 10, 11, 12, 13],
				preampDb: 40,
			}),
		]),
	)

	assert.deepEqual(preset.gainsDb, [12, -12, 0.5, 5.5, 7, 8, 9, 10, 11, 12])

	assert.equal(preset.preampDb, 12)

	const [negative] = parseCustomPresetsJson(
		JSON.stringify([createCustomPreset({ preampDb: -30 })]),
	)

	assert.equal(negative.preampDb, -12)
})

test('parseCustomPresetsJson 丢弃占用内置预设 ID 的条目', () => {
	const parsed = parseCustomPresetsJson(
		JSON.stringify([
			createCustomPreset({ id: 'flat', name: '伪平坦' }),
			createCustomPreset({ id: 'bass_boost', name: '伪低音增强' }),
			createCustomPreset({ id: 'custom-keep', name: '保留的自定义预设' }),
		]),
	)

	assert.equal(parsed.length, 1)

	assert.equal(parsed[0].id, 'custom-keep')

	const allBuiltin = parseCustomPresetsJson(
		JSON.stringify(
			BUILTIN_EQ_PRESET_IDS.map((id) =>
				createCustomPreset({ id, name: `伪${id}` }),
			),
		),
	)

	assert.deepEqual(allBuiltin, [])
})

test('upsertCustomPreset 支持新建、覆盖与名称截断', () => {
	const created = upsertCustomPreset([], {
		name: '  新的预设  ',
		gainsDb: [1, 2, 3, 4, 5, 6, 7, 8, 9, 20],
		preampDb: -20,
	})

	assert.equal(created.preset.name, '新的预设')

	assert.equal(created.presets.length, 1)

	assert.equal(created.preset.id, 'custom-1')

	assert.equal(created.preset.gainsDb[9], 12)

	assert.equal(created.preset.preampDb, -12)

	assert.equal(created.preset.isBuiltin, false)

	const overwritten = upsertCustomPreset(created.presets, {
		id: created.preset.id,
		name: '覆盖后',
		gainsDb: FLAT_GAINS,
		preampDb: 2,
	})

	assert.equal(overwritten.presets.length, 1)

	assert.equal(overwritten.preset.name, '覆盖后')

	assert.equal(overwritten.preset.preampDb, 2)

	const second = upsertCustomPreset(overwritten.presets, {
		name: '第二个',
		gainsDb: FLAT_GAINS,
		preampDb: 0,
	})

	assert.equal(second.presets.length, 2)

	assert.notEqual(second.preset.id, overwritten.preset.id)

	const longName = upsertCustomPreset([], {
		name: '一'.repeat(60),
		gainsDb: FLAT_GAINS,
		preampDb: 0,
	})

	assert.equal(longName.preset.name.length, 24)

	const empty = upsertCustomPreset(created.presets, {
		name: '   ',
		gainsDb: FLAT_GAINS,
		preampDb: 0,
	})

	assert.equal(empty.preset, null)

	assert.equal(empty.presets.length, 1)
})

test('renameCustomPreset 重命名并拦截空名', () => {
	const presets = [createCustomPreset(), createCustomPreset({ id: 'custom-2' })]

	const renamed = renameCustomPreset(presets, 'custom-1', '  新名字  ')

	assert.equal(renamed[0].name, '新名字')

	assert.equal(renamed[1].name, '我的预设')

	assert.equal(renamed[0].isBuiltin, false)

	const blank = renameCustomPreset(presets, 'custom-1', '   ')

	assert.equal(blank[0].name, '我的预设')

	assert.notEqual(blank, presets)

	const trimmed = renameCustomPreset(presets, 'custom-2', '一'.repeat(40))

	assert.equal(trimmed[1].name.length, 24)

	const emoji = renameCustomPreset(presets, 'custom-1', '🎵'.repeat(30))

	assert.equal(Array.from(emoji[0].name).length, 24)

	assert.equal(emoji[0].name, '🎵'.repeat(24))
})

test('deleteCustomPreset 与 findPresetDisplayName 行为符合预期', () => {
	const presets = [createCustomPreset(), createCustomPreset({ id: 'custom-2' })]

	const remaining = deleteCustomPreset(presets, 'custom-1')

	assert.equal(remaining.length, 1)

	assert.equal(remaining[0].id, 'custom-2')

	assert.equal(deleteCustomPreset(presets, 'missing').length, 2)

	assert.equal(findPresetDisplayName('pop', BUILTIN_PRESETS, presets), '流行')

	assert.equal(
		findPresetDisplayName('custom-2', BUILTIN_PRESETS, presets),
		'我的预设',
	)

	assert.equal(findPresetDisplayName(null, BUILTIN_PRESETS, presets), '自定义')

	assert.equal(
		findPresetDisplayName('unknown', BUILTIN_PRESETS, presets),
		'自定义',
	)

	assert.equal(findPresetDisplayName('flat', BUILTIN_PRESETS, []), '平坦')
})

test('内置预设 ID 不得被自定义预设占用', () => {
	const builtinIds = BUILTIN_EQ_PRESETS.map((preset) => preset.id).sort()

	assert.deepEqual([...BUILTIN_EQ_PRESET_IDS].sort(), builtinIds)

	for (const id of builtinIds) {
		const result = upsertCustomPreset([], {
			id,
			name: `占用 ${id}`,
			gainsDb: FLAT_GAINS,
			preampDb: 0,
		})

		assert.notEqual(result.preset.id, id)

		assert.equal(result.preset.isBuiltin, false)
	}
})

test('与 orpheus 常量防漂移：段数、增益边界与 ID 集合', () => {
	assert.equal(FLAT_GAINS.length, EQ_BAND_COUNT)

	const created = upsertCustomPreset([], {
		name: '边界',
		gainsDb: [EQ_MAX_GAIN_DB + 6, EQ_MIN_GAIN_DB - 6],
		preampDb: EQ_MAX_GAIN_DB + 3,
	})

	assert.equal(created.preset.gainsDb.length, EQ_BAND_COUNT)

	assert.equal(created.preset.gainsDb[0], EQ_MAX_GAIN_DB)

	assert.equal(created.preset.gainsDb[1], EQ_MIN_GAIN_DB)

	assert.equal(created.preset.preampDb, EQ_MAX_GAIN_DB)

	const kept = upsertCustomPreset([], {
		id: 'my-custom',
		name: '自定义 ID',
		gainsDb: FLAT_GAINS,
		preampDb: 0,
	})

	assert.equal(kept.preset.id, 'my-custom')
})

test('serializeCustomPresets 与 parseCustomPresetsJson 可往返', () => {
	const presets = [createCustomPreset(), createCustomPreset({ id: 'custom-2' })]

	const json = serializeCustomPresets(presets)

	assert.ok(json.startsWith('['))

	assert.deepEqual(parseCustomPresetsJson(json), presets)

	assert.deepEqual(parseCustomPresetsJson(serializeCustomPresets([])), [])
})
