import { parseSpans } from './spans'

describe('Span Parser (逐字解析)', () => {
	const LINE_START = 1000

	test('should parse plain text (纯文本)', () => {
		const result = parseSpans('Hello World', LINE_START, 1)
		expect(result.content).toBe('Hello World')
		expect(result.isDynamic).toBe(false)
		expect(result.spans).toHaveLength(1)
		expect(result.spans[0].text).toBe('Hello World')
		expect(result.spans[0].startTime).toBe(LINE_START)
		expect(result.spans[0].endTime).toBe(0) // Placeholder
	})

	test('should parse verbatim with brackets (中括号逐字)', () => {
		// [1s]Hello[2s]World[3s]
		const input = 'Hello[00:02.00]World[00:03.00]'
		// Start at 1s (1000ms)
		const result = parseSpans(input, 1000, 1)

		expect(result.content).toBe('HelloWorld')
		expect(result.isDynamic).toBe(true)
		expect(result.spans).toHaveLength(2)

		expect(result.spans[0].text).toBe('Hello')
		expect(result.spans[0].startTime).toBe(1000)
		expect(result.spans[0].endTime).toBe(2000)

		expect(result.spans[1].text).toBe('World')
		expect(result.spans[1].startTime).toBe(2000)
		expect(result.spans[1].endTime).toBe(3000) // Explicit end from last tag if treated as tag?
		// Wait, parser logic: if tag is loop item, it sets PREV valid span endTime.
		// Last tag [00:03.00] updates "World" span end time.
		// And explicitEnd should be 3000.

		expect(result.explicitEnd).toBe(3000)
	})

	test('should parse verbatim with angle brackets (尖括号/兼容模式)', () => {
		// [1s]Hello<00:02.00>World[00:03.00]
		const input = 'Hello<00:02.00>World[00:03.00]'
		const result = parseSpans(input, 1000, 1)

		expect(result.content).toBe('HelloWorld')
		expect(result.spans[0].endTime).toBe(2000)
		expect(result.spans[1].startTime).toBe(2000)
		expect(result.spans[1].endTime).toBe(3000)
	})

	test('should handle delayed start (延迟开始)', () => {
		// [1s]<1.5s>Text
		const input = '<00:01.50>Text'
		// Line start 1000
		const result = parseSpans(input, 1000, 1)

		// First part is empty string (before <...>), ignored?
		// Split: ["", "<00:01.50>", "Text"]
		// Loop 0: "" -> ignored.
		// Loop 1: Tag 1500. currentTime = 1500.
		// Loop 2: "Text". Span start 1500.

		expect(result.content).toBe('Text')
		expect(result.spans).toHaveLength(1)
		expect(result.spans[0].text).toBe('Text')
		expect(result.spans[0].startTime).toBe(1500)
	})

	test('should warn and ignore regression timestamps (时间倒流)', () => {
		const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
		// Start 5s. Tag 4s.
		const input = 'Hello[00:04.00]World'
		const result = parseSpans(input, 5000, 1)

		expect(consoleSpy).toHaveBeenCalled()
		expect(result.spans[0].endTime).toBe(0) // Not updated by invalid tag
		// Second span "World" starts at 5000 (ignored tag didn't update currentTime)?
		// Wait, let's check logic:
		// Parsing "Hello": spans check.
		// Tag matches: time < currentTime? continue.
		// So currentTime remains 5000.
		// Next text "World": spans.push(startTime: 5000).

		expect(result.spans[1].startTime).toBe(5000)
		consoleSpy.mockRestore()
	})

	test('should handle redundant timestamps (处理冗余时间戳)', () => {
		// Text[1s][2s]Suffix
		// Text ends at 1s. [2s] updates CurrentTime but doesn't extend Text (since it's already closed).
		const input = 'Text[00:01.00][00:02.00]Suffix'
		const result = parseSpans(input, 0, 1)

		expect(result.spans[0].text).toBe('Text')
		expect(result.spans[0].endTime).toBe(1000) // Closed by first tag

		expect(result.spans[1].text).toBe('Suffix')
		expect(result.spans[1].startTime).toBe(2000) // Starts at second tag
	})
})
