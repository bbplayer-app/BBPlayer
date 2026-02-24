import { bilibiliApi } from '@/lib/api/bilibili/api'
import { queryClient } from '@/lib/config/queryClient'
import { returnOrThrowAsync } from '@/utils/neverthrow-utils'

export const danmakuQueryKeys = {
	all: ['bilibili', 'danmaku'] as const,
	segment: (bvid: string, cid: number, segmentIndex: number) =>
		[...danmakuQueryKeys.all, 'segment', bvid, cid, segmentIndex] as const,
}

export async function fetchDanmakuSegmentQuery(
	bvid: string,
	cid: number,
	segmentIndex: number,
) {
	return queryClient.fetchQuery({
		queryKey: danmakuQueryKeys.segment(bvid, cid, segmentIndex),
		queryFn: () =>
			returnOrThrowAsync(bilibiliApi.getSegDanmaku(bvid, cid, segmentIndex)),
		staleTime: 1000 * 60 * 5,
		gcTime: 1000 * 60 * 10,
	})
}
