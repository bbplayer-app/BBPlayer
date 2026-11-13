import { count, desc, sql } from 'drizzle-orm'

import { useTracedQuery } from '@/hooks/utils/useTracedQuery'
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

async function fetchPlayHistoryHeatmap() {
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
}

export const usePlayHistoryHeatmap = () => {
	return useTracedQuery({
		span: { name: 'play_history.heatmap' },
		queryKey: playHistoryKeys.heatmap(),
		queryFn: fetchPlayHistoryHeatmap,
		networkMode: 'always',
		staleTime: 0,
	})
}

async function fetchPlayHistoryByDate(dateStr: string) {
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
}

export const usePlayHistoryByDate = (dateStr: string) => {
	return useTracedQuery({
		span: { name: 'play_history.by_date' },
		queryKey: playHistoryKeys.byDate(dateStr),
		queryFn: () => fetchPlayHistoryByDate(dateStr),
		enabled: !!dateStr,
		networkMode: 'always',
		staleTime: 0,
	})
}

export const useMostPlayedTracks = (days: number, limit: number) => {
	return useTracedQuery({
		span: { name: 'play_history.most_played' },
		queryKey: playHistoryKeys.topPlayed(days, limit),
		queryFn: async ({ span }) => {
			const result = await trackService
				.withTrace(span)
				.getMostPlayedTracksInLastDays({
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
