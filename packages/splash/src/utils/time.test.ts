import { parseTimeTag } from './time'

describe('Time Utils (时间工具)', () => {
	test('should parse standard format [mm:ss.SS] (标准格式)', () => {
		// 05:20.22 -> 5*60*1000 + 20.22*1000 = 300000 + 20220 = 320220
		expect(parseTimeTag('[05:20.22]')).toBe(320220)
	})

	test('should parse format with brackets angle brackets (括号处理)', () => {
		expect(parseTimeTag('<05:20.22>')).toBe(320220)
		expect(parseTimeTag('05:20.22')).toBe(320220)
	})

	test('should parse short digits (短位数字)', () => {
		// [1:02.1] -> 1m 2s 100ms
		// 60000 + 2000 + 100 = 62100
		// "1" digit in ms -> 100ms per spec logic (padEnd 3)
		expect(parseTimeTag('[1:02.1]')).toBe(62100)

		// [1:02.02] -> 1m 2s 20ms
		// 60000 + 2000 + 20 = 62020
		expect(parseTimeTag('[1:02.02]')).toBe(62020)
	})

	test('should parse long digits (长位数字/微秒)', () => {
		// [00:00.123456] -> 0m 0s 123ms (round)
		expect(parseTimeTag('[00:00.123456]')).toBe(123)
	})

	test('should parse >2 digit minutes (长分钟)', () => {
		// [100:00.00] -> 100m = 6000000ms
		expect(parseTimeTag('[100:00.00]')).toBe(6000000)
	})

	test('should handle missing ms part strictly? (无毫秒部分)', () => {
		// Usually standardized as mm:ss.SS, but basic parseFloat handles "ss"
		// "05:20" -> 5m 20s
		expect(parseTimeTag('[05:20]')).toBe(320000)
	})

	test('should handle padding examples from spec (规范填充示例)', () => {
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
