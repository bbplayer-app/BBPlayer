/** 只限制远端 Logs；本地文件保留完整记录。三个级别桶互不占用额度。 */
export class LogRateLimiter {
	private windowStart = performance.now()
	private counts = new Map<string, number>()
	private totals = new Map<string, number>()
	private dropped = new Map<string, number>()

	acquire(event: string, level: string, scope = ''): number | null {
		const now = performance.now()

		if (now - this.windowStart >= 60_000) {
			this.windowStart = now
			this.counts.clear()
			this.totals.clear()

			if (this.dropped.size > 1000) this.dropped.clear()
		}

		const bucket =
			level === 'error' || level === 'fatal'
				? 'error'
				: level === 'warn' || level === 'warning'
					? 'warning'
					: 'info'

		const key = JSON.stringify([bucket, scope, event])
		const count = this.counts.get(key) ?? 0
		const total = this.totals.get(bucket) ?? 0

		if (count >= 30 || total >= 600) {
			this.dropped.set(key, (this.dropped.get(key) ?? 0) + 1)

			return null
		}

		this.counts.set(key, count + 1)
		this.totals.set(bucket, total + 1)
		const dropped = this.dropped.get(key) ?? 0
		this.dropped.delete(key)

		return dropped
	}
}
