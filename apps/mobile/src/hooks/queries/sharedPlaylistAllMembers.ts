import { useTracedQuery } from '@/hooks/utils/useTracedQuery'
import { api } from '@/lib/api/bbplayer/client'

export type SharedPlaylistAllMember = {
	accountId: string
	name: string
	avatarUrl?: string | null
	role: 'owner' | 'editor' | 'subscriber'
	joinedAt: number
}

export function useSharedPlaylistAllMembers(shareId?: string | null) {
	return useTracedQuery({
		span: { name: 'shared_playlist.all_members' },
		queryKey: ['sharedPlaylistAllMembers', shareId],
		queryFn: async (): Promise<SharedPlaylistAllMember[]> => {
			if (!shareId) return []

			const resp = await api.playlists[':id'].members.$get({
				param: { id: shareId },
			})

			if (!resp.ok) {
				throw new Error('Failed to fetch members')
			}

			const data = await resp.json()

			return data.members.map((m) => ({
				accountId: m.account_id,
				name: m.name,
				avatarUrl: m.avatar_url,
				role: m.role,
				joinedAt: m.joined_at,
			}))
		},
		enabled: !!shareId,
	})
}
