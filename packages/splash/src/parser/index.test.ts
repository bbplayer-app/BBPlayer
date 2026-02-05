import { parseSpl } from './index'

describe('SPL Parser Integration (整体集成测试)', () => {
	test('should parse basic LRC (基础 LRC)', () => {
		const lrc = `
[ti:Title]
[00:01.00]Line 1
[00:02.00]Line 2
`
		const result = parseSpl(lrc)
		expect(result.meta.ti).toBe('Title')
		expect(result.lines).toHaveLength(2)
		expect(result.lines[0].content).toBe('Line 1')
		expect(result.lines[0].startTime).toBe(1000)
		expect(result.lines[0].endTime).toBe(2000) // Inferred from next line
		expect(result.lines[1].endTime).toBe(12000) // 2000 + 10s default
	})

	test('should handle repeated lines (重复行)', () => {
		const lrc = `[00:01.00][00:03.00]Repeated`
		const result = parseSpl(lrc)
		expect(result.lines).toHaveLength(2)
		expect(result.lines[0].startTime).toBe(1000)
		expect(result.lines[0].content).toBe('Repeated')
		expect(result.lines[1].startTime).toBe(3000)
		expect(result.lines[1].content).toBe('Repeated')
	})

	test('should handle explicit translations (显式翻译)', () => {
		const lrc = `
[00:01.00]Main
[00:01.00]Trans 1
[00:01.00]Trans 2
`
		const result = parseSpl(lrc)
		expect(result.lines).toHaveLength(1)
		expect(result.lines[0].content).toBe('Main')
		expect(result.lines[0].translations).toEqual(['Trans 1', 'Trans 2'])
	})

	test('should handle implicit translations (隐式翻译)', () => {
		// "只要都有时间戳，翻译和主歌词可以不挨着" - Test explicit timestamps not adjacent
		const lrc = `
[00:01.00]Main 1
[00:02.00]Main 2
[00:01.00]Trans 1
`
		// Should merge Trans 1 into Main 1
		const result = parseSpl(lrc)
		// Result sorted by time.
		// Line 1: 1s. Line 2: 2s.
		// But map grouping logic handles this before creating lines array.
		expect(result.lines[0].content).toBe('Main 1')
		expect(result.lines[0].translations).toContain('Trans 1')
		expect(result.lines[1].content).toBe('Main 2')
	})

	test('should handle pure implicit translation (纯隐式/无时间戳翻译)', () => {
		// Translation follows main lines without timestamp
		const lrc = `
[00:01.00]Main
Implicit Trans
`
		const result = parseSpl(lrc)
		expect(result.lines[0].content).toBe('Main')
		expect(result.lines[0].translations).toContain('Implicit Trans')
	})

	test('should handle repeated lines with implicit translation (重复行+隐式翻译)', () => {
		// Complex case:
		// [1s][3s]Main
		// Trans
		// Should attach Trans to both 1s and 3s lines.
		const lrc = `
[00:01.00][00:03.00]Main
Trans
`
		const result = parseSpl(lrc)
		expect(result.lines).toHaveLength(2)
		expect(result.lines[0].startTime).toBe(1000)
		expect(result.lines[0].translations).toContain('Trans')
		expect(result.lines[1].startTime).toBe(3000)
		expect(result.lines[1].translations).toContain('Trans')
	})

	test('should throw on orphaned text (被遗弃的文本)', () => {
		const lrc = `Orphaned Text`
		expect(() => parseSpl(lrc)).toThrow(/未找到时间戳/)
	})

	test('should correct invalid end times with spans (使用 spans 修正结束时间)', () => {
		// Line with explicit end tag in spans
		const lrc = `[00:01.00]Text[00:02.00]`
		const result = parseSpl(lrc)
		expect(result.lines[0].endTime).toBe(2000)
	})

	test('should fallback to 10s if last line has no end (最后一行默认时长)', () => {
		const lrc = `[00:01.00]Text`
		const result = parseSpl(lrc)
		expect(result.lines[0].endTime).toBe(11000)
	})

	test('should ignore empty lines and whitespace (忽略空行)', () => {
		const lrc = `
      
      [00:01.00]Text
      
      `
		const result = parseSpl(lrc)
		expect(result.lines).toHaveLength(1)
	})
})
