// oxlint-disable-next-line import/no-unassigned-import
import 'dayjs/locale/zh-cn'

import { WeeklyHeatMap } from '@bbplayer/heatmap'
import Color from 'color'
import dayjs from 'dayjs'
import { count, eq, sql } from 'drizzle-orm'
import { useLiveQuery } from 'drizzle-orm/expo-sqlite'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback } from 'react'
import { StyleSheet, View } from 'react-native'
import { Touchable } from 'react-native-gesture-handler'
import { Icon, Text, useTheme } from 'react-native-paper'

import Button from '@/components/common/Button'
import { usePlayHistoryHeatmap } from '@/hooks/queries/playHistory'
import db from '@/lib/db/db'
import { playHistory, tracks } from '@/lib/db/schema'

export default function ListeningRecordSection() {
	const theme = useTheme()
	const { colors } = theme
	const router = useRouter()
	// 与「全部统计」一致：完整播放次数 × 曲目时长，不把部分播放算入摘要。
	const { data: summary, error: summaryError } = useLiveQuery(
		db
			.select({
				playCount: count(),
				duration: sql<number>`coalesce(sum(${tracks.duration}), 0)`.mapWith(
					Number,
				),
			})
			.from(playHistory)
			.innerJoin(tracks, eq(playHistory.trackId, tracks.id))
			.where(eq(playHistory.completed, true)),
	)
	const { data, isPending, isError, refetch } = usePlayHistoryHeatmap()
	useFocusEffect(
		useCallback(() => {
			void refetch()
		}, [refetch]),
	)
	const hours =
		summaryError || !summary[0]
			? '—'
			: (Math.max(0, summary[0].duration) / 3600).toLocaleString('zh-CN', {
					maximumFractionDigits: 1,
				})
	const plays =
		summaryError || !summary[0]
			? '—'
			: summary[0].playCount.toLocaleString('zh-CN')

	return (
		<View style={styles.section}>
			<View style={styles.header}>
				<Text
					variant='titleMedium'
					style={styles.bold}
				>
					听歌记录
				</Text>
				<Touchable
					accessibilityRole='button'
					onPress={() => router.navigate('/history/overall')}
					style={styles.statisticsLink}
				>
					<Text
						variant='bodyMedium'
						style={{ color: colors.onSurfaceVariant }}
					>
						全部统计
					</Text>
					<Icon
						source='chevron-right'
						size={20}
						color={colors.onSurfaceVariant}
					/>
				</Touchable>
			</View>
			<View style={styles.metrics}>
				{[
					{ icon: 'headphones', value: hours, unit: '小时', label: '累计听歌' },
					{ icon: 'play-outline', value: plays, unit: '次', label: '完整播放' },
				].map((metric) => (
					<View
						key={metric.label}
						style={styles.metric}
					>
						<Icon
							source={metric.icon}
							size={24}
							color={colors.primary}
						/>
						<View style={styles.metricText}>
							<Text
								variant='titleLarge'
								style={styles.bold}
							>
								{metric.value}
								<Text variant='bodySmall'> {metric.unit}</Text>
							</Text>
							<Text
								variant='bodySmall'
								style={{ color: colors.onSurfaceVariant }}
							>
								{metric.label}
							</Text>
						</View>
					</View>
				))}
			</View>
			{summaryError && (
				<Text
					variant='bodySmall'
					style={{ color: colors.error }}
				>
					听歌摘要加载失败
				</Text>
			)}
			{isError ? (
				<Button onPress={() => void refetch()}>听歌记录加载失败，重试</Button>
			) : isPending ? (
				<View
					style={[
						styles.heatmapPlaceholder,
						{ backgroundColor: colors.surfaceVariant },
					]}
					accessibilityLabel='正在加载听歌记录'
				/>
			) : (
				<WeeklyHeatMap
					data={data ?? {}}
					cellSize={16}
					cellGap={4}
					cellRadius={4}
					initialScrollEnd
					locale='zh-cn'
					weekStartsOn={1}
					scheme={theme.dark ? 'dark' : 'light'}
					onCellPress={({ date }) =>
						router.navigate(`/history/${dayjs(date).format('YYYY-MM-DD')}`)
					}
					cellColor={{
						1: Color(colors.primary).alpha(0.2).rgb().string(),
						2: Color(colors.primary).alpha(0.4).rgb().string(),
						3: Color(colors.primary).alpha(0.6).rgb().string(),
						4: colors.primary,
					}}
					cellDefaultColor={colors.surfaceVariant}
					headerTextColor={colors.onSurfaceVariant}
					sidebarTextColor={colors.onSurfaceVariant}
				/>
			)}
			<Text
				variant='bodySmall'
				style={[styles.hint, { color: colors.onSurfaceVariant }]}
			>
				时长仅统计完整播放 · 点击日期查看历史
			</Text>
		</View>
	)
}

const styles = StyleSheet.create({
	section: { paddingVertical: 16, gap: 16 },
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 8,
		flexWrap: 'wrap',
	},
	bold: { fontWeight: 'bold' },
	statisticsLink: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
	metrics: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
	metric: {
		flex: 1,
		minWidth: 130,
		paddingVertical: 8,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	metricText: { flex: 1, gap: 4 },
	heatmapPlaceholder: { height: 160, borderRadius: 8 },
	hint: { textAlign: 'center' },
})
