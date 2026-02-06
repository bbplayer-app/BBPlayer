/**
 * 解析 SPL/LRC 时间标签
 *
 * 支持格式:
 * - `[mm:ss.SS]` (标准 LRC)
 * - `<mm:ss.SS>` (SPL 兼容格式)
 * - `mm:ss.SS` (无括号)
 * - 短位/长位毫秒: `[00:00.1]` (100ms), `[00:00.02]` (20ms), `[00:00.123456]`
 *
 * @param timeStr 时间字符串，例如 "[05:20.22]" 或 "<01:00.00>"
 * @returns 解析后的绝对时间，单位：毫秒 (ms)
 */
export function parseTimeTag(timeStr: string): number {
	const clean = timeStr.replace(/[[\]<>]/g, '')
	const [minStr, rest] = clean.split(':')
	const [secStr, msStr] = rest.split('.')

	const min = parseInt(minStr, 10)
	const seconds = parseFloat(secStr + '.' + (msStr || '0'))
	const result = min * 60 * 1000 + Math.round(seconds * 1000)

	return result < 0 ? 0 : result
}
