import { desc, ne } from 'drizzle-orm'

import { useTracedQuery } from '@/hooks/utils/useTracedQuery'
import db from '@/lib/db/db'
import * as schema from '@/lib/db/schema'

export function useRecentPlaylists() {
	return useTracedQuery({
		span: { name: 'playlist.recent' },
		queryKey: ['recentPlaylists'],
		queryFn: async () => {
			return db
				.select({
					id: schema.playlists.id,
					title: schema.playlists.title,
					coverUrl: schema.playlists.coverUrl,
					type: schema.playlists.type,
					itemCount: schema.playlists.itemCount,
				})
				.from(schema.playlists)
				.where(ne(schema.playlists.type, 'dynamic'))
				.orderBy(desc(schema.playlists.updatedAt))
				.limit(6)
		},
		networkMode: 'always',
	})
}
