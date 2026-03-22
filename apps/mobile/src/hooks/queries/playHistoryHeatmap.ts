import { useQuery } from '@tanstack/react-query'
import { count, sql } from 'drizzle-orm'

import drizzleDb from '@/lib/db/db'
import { playHistory } from '@/lib/db/schema'

export const usePlayHistoryHeatmap = () => {
	return useQuery({
		queryKey: ['playHistoryHeatmap'],
		queryFn: async () => {
			const result = await drizzleDb
				.select({
					date: sql<string>`date(${playHistory.startTime} / 1000, 'unixepoch')`,
					count: count(),
				})
				.from(playHistory)
				.groupBy(sql`date(${playHistory.startTime} / 1000, 'unixepoch')`)

			const data: Record<string, number> = {}
			result.forEach((row) => {
				if (row.date) {
					data[row.date] = row.count
				}
			})
			return data
		},
	})
}
