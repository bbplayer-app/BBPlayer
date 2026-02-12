import * as fs from 'fs'
import * as path from 'path'

import { parseYrc, formatSplTime } from './netease'

describe('网易云 YRC 转换器', () => {
	it('应该正确格式化时间', () => {
		expect(formatSplTime(0)).toBe('00:00.000')
		expect(formatSplTime(1000)).toBe('00:01.000')
		expect(formatSplTime(60000)).toBe('01:00.000')
		expect(formatSplTime(61234)).toBe('01:01.234')
	})

	it('应该解析 JSON 格式的元数据行', () => {
		const input = `{"t":0,"c":[{"tx":"制作人: "},{"tx":"ZUN"}]}\n{"t":1000,"c":[{"tx":"作词: "},{"tx":"Haruka"}]}`
		const output = parseYrc(input)
		expect(output).toBe('[00:00.000]制作人: ZUN\n[00:01.000]作词: Haruka')
	})

	it('应该解析简单的 YRC 行', () => {
		// [57500,3500](57500,520,0)流(58020,180,0)れ...
		const input = `[57500,3500](57500,520,0)流(58020,180,0)れ`
		const output = parseYrc(input)
		// 57500 = 57.500
		// 58020 = 58.020
		// Word 2 End: 58020 + 180 = 58200 = 00:58.200
		expect(output).toBe('[00:57.500]流<00:58.020>れ<00:58.200>')
	})

	it('应该处理延迟开始的情况', () => {
		// Line starts at 1000. Word 1 starts at 1500.
		// Word 1: 1500, 500 -> End 2000
		// Word 2: 2000, 500 -> End 2500
		const input = `[1000,2000](1500,500,0)Hello(2000,500,0)World`
		const output = parseYrc(input)
		// [00:01.000] Line start
		// <00:01.000> First gap start (implicit from line start)
		// <00:01.500> Word 1 start
		// <00:02.000> Word 1 end / Word 2 start (contiguous)
		// <00:02.500> Word 2 end
		expect(output).toBe(
			'[00:01.000]<00:01.000><00:01.500>Hello<00:02.000>World<00:02.500>',
		)
	})

	it('应该能解析真实文件数据', () => {
		const filePath = path.join(__dirname, '../__tests__/fixtures/687506.json')
		if (fs.existsSync(filePath)) {
			const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
				yrc: {
					lyric: string
				}
			}
			if (data.yrc?.lyric) {
				const result = parseYrc(data.yrc.lyric)
				// 期望包含间奏的时间戳 <00:58.020>
				expect(result).toContain('[00:57.500]流<00:58.020>れ')
			}
		} else {
		}
	})
	it('应该解析混合了 JSON 和标准 LRC 的行', () => {
		const input = `{"t":0,"c":[{"tx":"作词: "},{"tx":"DECO*27"}]}
{"t":1000,"c":[{"tx":"作曲: "},{"tx":"DECO*27"}]}
[00:20.848]特別な君と 特別な日を
[00:25.915]笑い合って バカもしたいな`

		const output = parseYrc(input)
		const lines = output.split('\n')

		expect(lines).toContain('[00:00.000]作词: DECO*27')
		expect(lines).toContain('[00:01.000]作曲: DECO*27')
		expect(lines).toContain('[00:20.848]特別な君と 特別な日を')
		expect(lines).toContain('[00:25.915]笑い合って バカもしたいな')
	})

	it('应该正确处理过长的间奏（遵循词的持续时间）', () => {
		// [57920,11880](57920,830,0)宙... (64080,2630,0)る
		// Line end: 57920 + 11880 = 69800 = 01:09.800
		// Last word end: 64080 + 2630 = 66710 = 01:06.710
		const input = `[57920,11880](57920,830,0)宙(64080,2630,0)る`
		const output = parseYrc(input)
		// Should end at 01:06.710, not 01:09.800
		// Should include gap: <00:58.750> (end of 宙) -> <01:04.080> (start of る)
		expect(output).toBe('[00:57.920]宙<00:58.750><01:04.080>る<01:06.710>')
	})

	it('应该优雅地处理负时间戳', () => {
		const input = `{"t":-1,"c":[{"tx":"Invalid Time"}]}`
		const output = parseYrc(input)
		// Should clamp to 00:00.000
		expect(output).toBe('[00:00.000]Invalid Time')
	})
})
