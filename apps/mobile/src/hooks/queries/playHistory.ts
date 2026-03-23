import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { count, desc, sql } from 'drizzle-orm'

import drizzleDb from '@/lib/db/db'
import * as schema from '@/lib/db/schema'
import type { Track } from '@/types/core/media'

export const playHistoryKeys = {
	all: ['playHistory'] as const,
	heatmap: () => [...playHistoryKeys.all, 'heatmap'] as const,
	byDate: (date: string) => [...playHistoryKeys.all, 'byDate', date] as const,
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
					const normalizedTs = sql`CASE WHEN ${ph.startTime} > 10000000000 THEN ${ph.startTime} / 1000 ELSE ${ph.startTime} END`
					return and(
						sql`${normalizedTs} >= ${startTimeS}`,
						sql`${normalizedTs} <= ${endTimeS}`,
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
