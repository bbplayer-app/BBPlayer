import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Button, Divider, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import UniversalSwitch from '@/components/common/UniversalSwitch'
import {
	getMetrics,
	isShakeProfilingEnabled,
	isStartupProfilingEnabled,
	setShakeProfilingEnabled,
	setStartupProfilingEnabled,
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

export default function PerformanceScreen() {
	const insets = useSafeAreaInsets()
	const theme = useTheme()
	const router = useRouter()
	const [metrics, setMetrics] = useState<StartupMetrics>(getMetrics)
	const [startupProfilingEnabled, setStartupProfilingEnabledState] = useState(
		isStartupProfilingEnabled,
	)
	const [shakeProfilingEnabled, setShakeProfilingEnabledState] = useState(
		isShakeProfilingEnabled,
	)

	useEffect(() => {
		return subscribeToMetrics(() => {
			setMetrics({ ...getMetrics() })
		})
	}, [])

	const handleRefresh = useCallback(() => {
		setMetrics({ ...getMetrics() })
	}, [])

	const handleStartupProfilingChange = useCallback((enabled: boolean) => {
		setStartupProfilingEnabled(enabled)
		setStartupProfilingEnabledState(enabled)
	}, [])

	const handleShakeProfilingChange = useCallback((enabled: boolean) => {
		setShakeProfilingEnabled(enabled)
		setShakeProfilingEnabledState(enabled)
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
				<View style={styles.settingRow}>
					<View style={styles.settingLabel}>
						<Text variant='bodyLarge'>自动记录启动性能</Text>
						<Text
							variant='bodySmall'
							style={{ color: theme.colors.onSurfaceVariant }}
						>
							下次启动时采集，并保存到 Downloads 文件夹
						</Text>
					</View>
					<UniversalSwitch
						value={startupProfilingEnabled}
						onValueChange={handleStartupProfilingChange}
					/>
				</View>
				<Divider />
				<View style={styles.settingRow}>
					<View style={styles.settingLabel}>
						<Text variant='bodyLarge'>摇一摇记录性能</Text>
						<Text
							variant='bodySmall'
							style={{ color: theme.colors.onSurfaceVariant }}
						>
							摇动设备后确认，记录 10 秒并保存到 Downloads 文件夹
						</Text>
					</View>
					<UniversalSwitch
						value={shakeProfilingEnabled}
						onValueChange={handleShakeProfilingChange}
					/>
				</View>
				<Divider />
				<MetricRow
					label='冷启动'
					value={metrics.coldLaunchTime}
					description='process start → activity load'
				/>
				<Divider />
				<MetricRow
					label='温启动'
					value={metrics.warmLaunchTime}
					description='launch → activity create'
				/>
				<Divider />
				<MetricRow
					label='首帧渲染 (TTFR)'
					value={metrics.timeToFirstRender}
					description='markLoaded → markFirstRender'
				/>
				<Divider />
				<MetricRow
					label='Bundle 加载'
					value={metrics.bundleLoadTime}
					description='RUN_JS_BUNDLE_START → END'
				/>
				<Divider />
				<MetricRow
					label='可交互时间 (TTI)'
					value={metrics.timeToInteractive}
					description='markLoaded → markInteractive'
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
	settingRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 12,
		gap: 16,
	},
	settingLabel: {
		flex: 1,
	},
	traceSection: {
		paddingVertical: 12,
	},
})
