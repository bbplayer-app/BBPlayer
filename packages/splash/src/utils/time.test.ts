import { parseTimeTag } from './time'

describe('Time Utils (时间工具)', () => {
	test('应该解析标准格式 [mm:ss.SS]', () => {
		// 05:20.22 -> 5*60*1000 + 20.22*1000 = 300000 + 20220 = 320220
		expect(parseTimeTag('[05:20.22]')).toBe(320220)
	})

	test('应该能解析尖括号或无括号的格式', () => {
		expect(parseTimeTag('<05:20.22>')).toBe(320220)
		expect(parseTimeTag('05:20.22')).toBe(320220)
	})

	test('应该解析短位数字', () => {
		// [1:02.1] -> 1m 2s 100ms
		// 60000 + 2000 + 100 = 62100
		// "1" digit in ms -> 100ms per spec logic (padEnd 3)
		expect(parseTimeTag('[1:02.1]')).toBe(62100)

		// [1:02.02] -> 1m 2s 20ms
		// 60000 + 2000 + 20 = 62020
		expect(parseTimeTag('[1:02.02]')).toBe(62020)
	})

	test('应该解析长位数字/微秒', () => {
		// [00:00.123456] -> 0m 0s 123ms (round)
		expect(parseTimeTag('[00:00.123456]')).toBe(123)
	})

	test('应该解析超过两位数的分钟', () => {
		// [100:00.00] -> 100m = 6000000ms
		expect(parseTimeTag('[100:00.00]')).toBe(6000000)
	})

	test('应当能解析不带毫秒的时间', () => {
		// Usually standardized as mm:ss.SS, but basic parseFloat handles "ss"
		// "05:20" -> 5m 20s
		expect(parseTimeTag('[05:20]')).toBe(320000)
	})

	test('应该按照规范示例处理填充补全', () => {
		// "130" -> 130ms (already 3 digits)
		expect(parseTimeTag('[00:00.130]')).toBe(130)
		// "1" -> 100ms
		expect(parseTimeTag('[00:00.1]')).toBe(100)
		// "02" -> 20ms
		expect(parseTimeTag('[00:00.02]')).toBe(20)
		// "103" -> 103ms (checking ambiguous minute definition in spec vs ms)
		// Spec says min limit 1-3 digits.
		// In ms position: .millis
		expect(parseTimeTag('[00:00.103]')).toBe(103)
	})
})
