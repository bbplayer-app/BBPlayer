import { PlaybackState, useIsPlaying } from '@bbplayer/orpheus'

import { findResumePartIndex } from '@/features/playlist/resume/resumePart'
import { useCurrentTrackId } from '@/hooks/player/useCurrentTrackId'
import { useLastPlayRecordOfVideo } from '@/hooks/queries/db/track'
import { usePlayerStore } from '@/hooks/stores/usePlayerStore'
import { useDebouncedValue } from '@/hooks/utils/useDebouncedValue'

interface ResumablePart {
	uniqueKey: string
	title: string
	bilibiliMetadata: { cid: number | null }
}

/** 续播卡片要显示的内容 */
export interface ResumeCardInfo {
	/** 从 1 开始的分 P 序号 */
	partNumber: number
	title: string
	/** 正在放这一 P：卡片显示「正在播放」，点了只定位过去 */
	listening: boolean
}

/**
 * 多 P 视频的「续播」：算出该续哪一 P，以及续播卡片上显示什么。
 * 分 P 页和从分 P 同步来的本地播放列表共用。
 *
 * parts 是按分 P 顺序排好的列表；bvid 为空时不查播放记录，也就没有续播。
 */
export function useMultiPageResume<T extends ResumablePart>(
	bvid: string | undefined,
	parts: readonly T[],
) {
	const currentTrackId = useCurrentTrackId()
	const isPlaying = useIsPlaying()
	const playbackState = usePlayerStore((state) => state.playbackState)
	const { data: lastPlayRecord } = useLastPlayRecordOfVideo(bvid)

	// 播完以后播放器里还留着刚放完的那一 P，这时要按播放记录续（听完了就续下一 P），
	// 不能再把它当成正在放或暂停着的那一 P
	const partInPlayer =
		playbackState === PlaybackState.ENDED ? undefined : currentTrackId

	const resumeIndex = bvid
		? findResumePartIndex(parts, partInPlayer, lastPlayRecord)
		: -1

	const resumePart = resumeIndex === -1 ? undefined : parts[resumeIndex]

	/** 续播的目标就是播放器里暂停着的那一 P，接着放就行，不用重新加进队列 */
	const isResumePartInPlayer =
		resumePart !== undefined && resumePart.uniqueKey === partInPlayer

	// 续播的目标就是当前曲目、并且正在放：卡片改成「正在播放」。切换曲目和取音频地址时报告的是缓冲，
	// 也算正在放。放着别的歌时照样是续播，点了就切回这个视频
	const listeningHere =
		isResumePartInPlayer &&
		(isPlaying || playbackState === PlaybackState.BUFFERING)

	// 切换曲目时当前曲目和播放状态会连着变好几次，稳定一会儿再更新卡片，免得闪一下。
	// 防抖期间沿用旧内容而不是先藏起来，卡片不会一会儿有一会儿没有，头部高度也就不会跳
	const settled = useDebouncedValue(
		resumePart === undefined
			? undefined
			: `${resumeIndex}:${listeningHere ? 1 : 0}`,
	)

	let resumeCard: ResumeCardInfo | undefined

	if (settled !== undefined) {
		const [index, listening] = settled.split(':').map(Number)
		const part = parts[index]

		if (part) {
			resumeCard = {
				partNumber: index + 1,
				title: part.title,
				listening: listening === 1,
			}
		}
	}

	return { resumeIndex, resumePart, isResumePartInPlayer, resumeCard }
}
