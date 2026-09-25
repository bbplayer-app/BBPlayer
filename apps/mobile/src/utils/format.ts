/**
 * 把字节数格式化为带单位的可读字符串（B/KB/MB/GB/TB）。
 */
export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	const units = ['KB', 'MB', 'GB', 'TB']
	let value = bytes
	let unit = -1
	do {
		value /= 1024
		unit++
	} while (value >= 1024 && unit < units.length - 1)
	return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`
}
