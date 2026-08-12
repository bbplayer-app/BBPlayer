import { useQuery } from '@tanstack/react-query'
import { count, desc, sql } from 'drizzle-orm'

import drizzleDb from '@/lib/db/db'
import * as schema from '@/lib/db/schema'
import { trackService } from '@/lib/services/trackService'
import type { Track } from '@/types/core/media'

export const playHistoryKeys = {
	all: ['playHistory'] as const,
	heatmap: () => [...playHistoryKeys.all, 'heatmap'] as const,
	byDate: (date: string) => [...playHistoryKeys.all, 'byDate', date] as const,
	topPlayed: (days: number, limit: number) =>
		[...playHistoryKeys.all, 'topPlayed', days, limit] as const,
}

export const usePlayHistoryHeatmap = () => {
	return useQuery({
		queryKey: playHistoryKeys.heatmap(),
		queryFn: async () => {
			const result = await drizzleDb
				.select({
					date: sql<string>`date(${schema.playHistory.startTime} / 1000, 'unixepoch', 'localtime')`,
					count: count(),
				})
				.from(schema.playHistory)
				.groupBy(
					sql`date(${schema.playHistory.startTime} / 1000, 'unixepoch', 'localtime')`,
				)

			const data: Record<string, number> = {}
			result.forEach((row) => {
				if (row.date) {
					data[row.date] = row.count
				}
			})
			return data
		},
		networkMode: 'always',
		staleTime: 0,
	})
}

export const usePlayHistoryByDate = (dateStr: string) => {
	return useQuery({
		queryKey: playHistoryKeys.byDate(dateStr),
		queryFn: async () => {
			const historyRows = await drizzleDb.query.playHistory.findMany({
				where: (ph, { sql: sqlFn }) => {
					return sqlFn`date(${ph.startTime} / 1000, 'unixepoch', 'localtime') = ${dateStr}`
				},
				with: {
					track: {
						with: {
							artist: true,
							bilibiliMetadata: true,
							localMetadata: true,
						},
					},
				},
				orderBy: [desc(schema.playHistory.startTime)],
			})

			// 过滤掉没有 track 的异常数据，并转换类型
			return historyRows
				.filter((row) => row.track !== null && row.track !== undefined)
				.map((row) => {
					const track = row.track as unknown as Track
					return {
						...track,
						historyId: row.id,
						playedAt: row.startTime,
					}
				})
		},
		enabled: !!dateStr,
		networkMode: 'always',
		staleTime: 0,
	})
}

export const useMostPlayedTracks = (days: number, limit: number) => {
	return useQuery({
		queryKey: playHistoryKeys.topPlayed(days, limit),
		queryFn: async () => {
			const result = await trackService.getMostPlayedTracksInLastDays({
				days,
				limit,
			})
			if (result.isErr()) {
				throw result.error
			}
			return result.value
		},
		enabled: true,
		networkMode: 'always',
		staleTime: 60 * 1000,
	})
}
