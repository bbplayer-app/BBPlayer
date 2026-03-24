import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { count, desc, sql } from 'drizzle-orm'

import drizzleDb from '@/lib/db/db'
import * as schema from '@/lib/db/schema'
import { trackService } from '@/lib/services/trackService'
import type { Track } from '@/types/core/media'

export const playHistoryKeys = {
	all: ['playHistory'] as const,
	heatmap: () => [...playHistoryKeys.all, 'heatmap'] as const,
	byDate: (date: string) => [...playHistoryKeys.all, 'byDate', date] as const,
	byDayOfMonth: (day: number) =>
		[...playHistoryKeys.all, 'byDayOfMonth', day] as const,
	topPlayed: (days: number, limit: number) =>
		[...playHistoryKeys.all, 'topPlayed', days, limit] as const,
}

export const usePlayHistoryHeatmap = () => {
	return useQuery({
		queryKey: playHistoryKeys.heatmap(),
		queryFn: async () => {
			const result = await drizzleDb
				.select({
					date: sql<string>`date(
                        CASE
                            WHEN ${schema.playHistory.startTime} > 10000000000 THEN ${schema.playHistory.startTime} / 1000
                            ELSE ${schema.playHistory.startTime}
                        END,
                        'unixepoch',
                        'localtime'
                    )`,
					count: count(),
				})
				.from(schema.playHistory)
				.groupBy(
					sql`date(
                        CASE
                            WHEN ${schema.playHistory.startTime} > 10000000000 THEN ${schema.playHistory.startTime} / 1000
                            ELSE ${schema.playHistory.startTime}
                        END,
                        'unixepoch',
                        'localtime'
                    )`,
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
			const date = dayjs(dateStr)
			const startTimeS = date.startOf('day').unix()
			const endTimeS = date.endOf('day').unix()

			const historyRows = await drizzleDb.query.playHistory.findMany({
				where: (ph, { and, sql }) => {
					return and(
						sql`${ph.startTime} >= ${startTimeS * 1000}`,
						sql`${ph.startTime} <= ${endTimeS * 1000}`,
					)
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

export const usePlayHistoryByDayOfMonth = (dayOfMonth: number) => {
	return useQuery({
		queryKey: playHistoryKeys.byDayOfMonth(dayOfMonth),
		queryFn: async () => {
			const historyRows = await drizzleDb.query.playHistory.findMany({
				where: (ph, { sql }) => {
					const dayOfMonthSql = sql`strftime('%d', ${ph.startTime} / 1000, 'unixepoch', 'localtime')`
					return sql`${dayOfMonthSql} = ${String(dayOfMonth).padStart(2, '0')}`
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
		enabled: !!dayOfMonth && dayOfMonth >= 1 && dayOfMonth <= 31,
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
