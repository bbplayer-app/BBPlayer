import { useQuery } from '@tanstack/react-query'
import { desc } from 'drizzle-orm'

import db from '@/lib/db/db'
import * as schema from '@/lib/db/schema'

export function useRecentPlaylists() {
	return useQuery({
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
				.orderBy(desc(schema.playlists.updatedAt))
				.limit(6)
		},
		networkMode: 'always',
	})
}
