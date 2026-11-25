export interface LastPlayRecord {
	cid: number
	completed: boolean
}

interface Part {
	uniqueKey: string
	bilibiliMetadata: { cid: number | null }
}

/**
 * 多 P 视频「续播」该从哪一 P 开始，返回它在 parts 里的下标，没有可续播的返回 -1。
 *
 * 播放器里正在放的分 P 要等播完或切走才写进播放记录，所以它属于这个视频时优先用它。
 * 否则看这个视频最近一条播放记录：没听完就续这一 P，听完了就续下一 P。
 * 记录里的分 P 已不在列表里，或者听完的就是最后一 P，都不续播。
 */
export function findResumePartIndex(
	parts: readonly Part[],
	currentTrackKey: string | undefined,
	lastRecord: LastPlayRecord | null | undefined,
): number {
	if (currentTrackKey !== undefined) {
		const current = parts.findIndex(
			(part) => part.uniqueKey === currentTrackKey,
		)

		if (current !== -1) return current
	}

	if (!lastRecord) return -1

	const index = parts.findIndex(
		(part) => part.bilibiliMetadata.cid === lastRecord.cid,
	)

	if (index === -1) return -1

	if (!lastRecord.completed) return index

	return index + 1 < parts.length ? index + 1 : -1
}
