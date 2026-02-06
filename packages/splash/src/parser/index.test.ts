import { parseSpl, verify } from './index'

describe('SPL Parser Integration (整体集成测试)', () => {
	test('应该解析基础 LRC', () => {
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

	test('应该处理重复行', () => {
		const lrc = `[00:01.00][00:03.00]Repeated`
		const result = parseSpl(lrc)
		expect(result.lines).toHaveLength(2)
		expect(result.lines[0].startTime).toBe(1000)
		expect(result.lines[0].content).toBe('Repeated')
		expect(result.lines[1].startTime).toBe(3000)
		expect(result.lines[1].content).toBe('Repeated')
	})

	test('应该处理显式翻译', () => {
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

	test('应该处理隐式翻译', () => {
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

	test('应该处理纯隐式/无时间戳翻译', () => {
		// Translation follows main lines without timestamp
		const lrc = `
[00:01.00]Main
Implicit Trans
`
		const result = parseSpl(lrc)
		expect(result.lines[0].content).toBe('Main')
		expect(result.lines[0].translations).toContain('Implicit Trans')
	})

	test('应该处理带有隐式翻译的重复行', () => {
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

	test('对于未匹配到时间戳的文本应报错', () => {
		const lrc = `Orphaned Text`
		expect(() => parseSpl(lrc)).toThrow(/未找到时间戳/)
	})

	test('应该使用 spans 修正结束时间', () => {
		// Line with explicit end tag in spans
		const lrc = `[00:01.00]Text[00:02.00]`
		const result = parseSpl(lrc)
		expect(result.lines[0].endTime).toBe(2000)
	})

	test('如果最后一行没有结束标识，则默认为 10 秒', () => {
		const lrc = `[00:01.00]Text`
		const result = parseSpl(lrc)
		expect(result.lines[0].endTime).toBe(11000)
	})

	test('应该忽略空行和空白字符', () => {
		const lrc = `
      
      [00:01.00]Text
      
      `
		const result = parseSpl(lrc)
		expect(result.lines).toHaveLength(1)
	})
	test('应该处理文件中间的元数据', () => {
		const lrc = `
[00:01.00]Line 1
[by:Artist]
[00:02.00]Line 2
`
		const result = parseSpl(lrc)
		expect(result.meta.by).toBe('Artist')
		expect(result.lines).toHaveLength(2)
		expect(result.lines[0].content).toBe('Line 1')
		expect(result.lines[1].content).toBe('Line 2')
	})

	test('应该优雅地处理负数时间戳', () => {
		const lrc = `[-1:-1.000]Negative Time`
		// Should clamp to 0 or at least parse without throwing "orphaned text" (if logic allows)
		// Since regex doesn't match "-", it will likely be treated as text "[-1:-1.000]Negative Time"
		// And if no prior timestamp, it throws "orphaned text"
		expect(() => parseSpl(lrc)).not.toThrow()
		const result = parseSpl(lrc)
		expect(result.lines[0].startTime).toBe(0)
	})
})

describe('verify', () => {
	test('应该返回 isValid: true 对于有效的歌词', () => {
		const lrc = `[00:01.00]Valid`
		const result = verify(lrc)
		expect(result.isValid).toBe(true)
	})

	test('应该返回 isValid: false 和 error 对于无效的歌词', () => {
		const lrc = `Invalid Without Timestamp`
		const result = verify(lrc)
		if (result.isValid) {
			throw new Error('Should be invalid')
		}
		expect(result.isValid).toBe(false)
		expect(result.error.line).toBe(1)
		expect(result.error.message).toContain('未找到时间戳')
	})
})
