import { skipToken } from '@tanstack/react-query'

import { useTracedQuery } from '@/hooks/utils/useTracedQuery'
import { sharedPlaylistFacade } from '@/lib/facades/sharedPlaylist'
import { returnOrThrowAsync } from '@/utils/neverthrow-utils'

export const sharedPlaylistPreviewKeys = {
	preview: (shareId?: string) =>
		['bbplayer', 'sharedPlaylist', 'preview', shareId] as const,
}

export const useSharedPlaylistPreview = (shareId?: string) => {
	return useTracedQuery({
		span: { name: 'shared_playlist.preview' },
		queryKey: sharedPlaylistPreviewKeys.preview(shareId),
		queryFn: shareId
			? () => returnOrThrowAsync(sharedPlaylistFacade.getPreview(shareId))
			: skipToken,
		enabled: !!shareId,
	})
}
