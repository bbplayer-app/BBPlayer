import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Button, Divider, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
	getMetrics,
	subscribeToMetrics,
	type StartupMetrics,
} from '@/lib/performance'

function formatMs(value: number | null): string {
	if (value === null) return '—'
	return value < 1000
		? `${Math.round(value)}ms`
		: `${(value / 1000).toFixed(2)}s`
}

function MetricRow({
	label,
	value,
	description,
}: {
	label: string
	value: number | null
	description?: string
}) {
	const theme = useTheme()
	return (
		<View style={styles.metricRow}>
			<View style={styles.metricLabel}>
				<Text variant='bodyLarge'>{label}</Text>
				{description ? (
					<Text
						variant='bodySmall'
						style={{ color: theme.colors.onSurfaceVariant }}
					>
						{description}
					</Text>
				) : null}
			</View>
			<Text
				variant='bodyLarge'
				style={{ fontVariant: ['tabular-nums'], fontWeight: '600' }}
			>
				{formatMs(value)}
			</Text>
		</View>
	)
}

function MarksList({
	marks,
	title,
}: {
	marks: Array<{ name: string; startTime: number; duration?: number }>
	title: string
}) {
	const theme = useTheme()
	if (marks.length === 0) return null
	return (
		<View style={styles.section}>
			<Text
				variant='titleSmall'
				style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}
			>
				{title}
			</Text>
			{marks.map((m) => {
				const key = `${m.name}-${m.startTime}`
				return (
					<View
						key={key}
						style={styles.markRow}
					>
						<Text
							variant='bodySmall'
							numberOfLines={1}
							style={styles.markName}
						>
							{m.name}
						</Text>
						<Text
							variant='bodySmall'
							style={{ fontVariant: ['tabular-nums'] }}
						>
							{formatMs(m.startTime)}
							{'duration' in m && m.duration
								? ` (${formatMs(m.duration)})`
								: ''}
						</Text>
					</View>
				)
			})}
		</View>
	)
}

export default function PerformanceScreen() {
	const insets = useSafeAreaInsets()
	const theme = useTheme()
	const router = useRouter()
	const [metrics, setMetrics] = useState<StartupMetrics>(getMetrics)

	useEffect(() => {
		return subscribeToMetrics(() => {
			setMetrics({ ...getMetrics() })
		})
	}, [])

	const handleRefresh = useCallback(() => {
		setMetrics({ ...getMetrics() })
	}, [])

	return (
		<View
			style={[styles.container, { backgroundColor: theme.colors.background }]}
		>
			<View style={[styles.header, { paddingTop: insets.top + 8 }]}>
				<Pressable onPress={() => router.back()}>
					<Text style={{ color: theme.colors.primary }}>返回</Text>
				</Pressable>
				<Text
					variant='titleMedium'
					style={{ fontWeight: '600' }}
				>
					性能指标
				</Text>
				<Button
					mode='text'
					compact
					onPress={handleRefresh}
				>
					刷新
				</Button>
			</View>

			<ScrollView
				contentContainerStyle={[
					styles.scrollContent,
					{ paddingBottom: insets.bottom + 40 },
				]}
			>
				<MetricRow
					label='启动耗时'
					value={metrics.startTime}
					description='nativeLaunchStart → contentAppeared'
				/>
				<Divider />
				<MetricRow
					label='Bundle 加载'
					value={metrics.bundleLoadTime}
					description='runJsBundleStart → runJsBundleEnd'
				/>
				<Divider />
				<MetricRow
					label='首帧渲染 (TTR)'
					value={metrics.timeToRender}
					description='nativeLaunchStart → contentAppeared'
				/>
				<Divider />
				<MetricRow
					label='可交互时间 (TTI)'
					value={metrics.timeToInteractive}
					description='nativeLaunchStart → markInteractive'
				/>

				{metrics.profilerTracePath ? (
					<>
						<Divider />
						<View style={styles.traceSection}>
							<Text variant='bodyLarge'>Hermes CPU Trace</Text>
							<Text
								variant='bodySmall'
								style={{ color: theme.colors.onSurfaceVariant }}
								numberOfLines={3}
							>
								{metrics.profilerTracePath}
							</Text>
							<Text
								variant='bodySmall'
								style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}
							>
								用 npx react-native-release-profiler --local 路径 导出分析
							</Text>
						</View>
					</>
				) : null}

				<MarksList
					title='Native Marks'
					marks={metrics.nativeMarks}
				/>
				<MarksList
					title='Custom Marks'
					marks={metrics.customMarks}
				/>
			</ScrollView>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
		paddingBottom: 12,
	},
	scrollContent: {
		paddingHorizontal: 16,
	},
	metricRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 12,
	},
	metricLabel: {
		flex: 1,
		marginRight: 16,
	},
	section: {
		marginTop: 24,
	},
	sectionTitle: {
		marginBottom: 8,
	},
	markRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 4,
	},
	markName: {
		flex: 1,
		marginRight: 12,
		fontVariant: ['tabular-nums'],
	},
	traceSection: {
		paddingVertical: 12,
	},
})
