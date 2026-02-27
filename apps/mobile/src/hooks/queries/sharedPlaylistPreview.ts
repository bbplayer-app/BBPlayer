import { skipToken, useQuery } from '@tanstack/react-query'

import { sharedPlaylistFacade } from '@/lib/facades/sharedPlaylist'
import { returnOrThrowAsync } from '@/utils/neverthrow-utils'

export const sharedPlaylistPreviewKeys = {
	preview: (shareId?: string) =>
		['bbplayer', 'sharedPlaylist', 'preview', shareId] as const,
}

export const useSharedPlaylistPreview = (shareId?: string) => {
	return useQuery({
		queryKey: sharedPlaylistPreviewKeys.preview(shareId),
		queryFn: shareId
			? () => returnOrThrowAsync(sharedPlaylistFacade.getPreview(shareId))
			: skipToken,
		enabled: !!shareId,
	})
}
