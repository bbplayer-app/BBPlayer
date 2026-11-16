import { Orpheus, type AudioDebugSection } from '@bbplayer/orpheus'
import * as Clipboard from 'expo-clipboard'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import {
	AppState,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	View,
} from 'react-native'
import { Button, Divider, Switch, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import toast from '@/utils/toast'

const REFRESH_INTERVAL_MS = 1000

type TestOptionKey = 'testForceMediaCodec' | 'testForcePcm'

// 功耗测量时用来切换配置，同一个安装包就能测完所有组合
const TEST_OPTIONS: {
	key: TestOptionKey
	label: string
	description: string
	// 解码器在创建播放器时就定下来了，要重启才生效；offload 偏好可以随时重新应用
	needsRestart: boolean
}[] = [
	{
		key: 'testForceMediaCodec',
		label: '强制 MediaCodec',
		description: 'PCM 也用系统解码器，不用 FFmpeg（重启 App 后生效）',
		needsRestart: true,
	},
	{
		key: 'testForcePcm',
		label: '强制 PCM',
		description: '不开频谱也不走 offload（立即生效）',
		needsRestart: false,
	},
]

function readTestOptions(): Record<TestOptionKey, boolean> {
	return {
		testForceMediaCodec: Orpheus.testForceMediaCodec,
		testForcePcm: Orpheus.testForcePcm,
	}
}

function formatSectionsAsText(sections: AudioDebugSection[]): string {
	return sections
		.map(
			(section) =>
				`[${section.title}]\n` +
				section.items.map((item) => `${item.label}: ${item.value}`).join('\n'),
		)
		.join('\n\n')
}

export default function AudioDebugScreen() {
	const router = useRouter()
	const theme = useTheme()
	const insets = useSafeAreaInsets()
	const [sections, setSections] = useState<AudioDebugSection[]>([])
	const [error, setError] = useState<string | null>(null)
	const [testOptions, setTestOptions] = useState(readTestOptions)

	const toggleTestOption = useCallback(
		(key: TestOptionKey, needsRestart: boolean) => {
			Orpheus[key] = !Orpheus[key]
			setTestOptions(readTestOptions())
			toast.success(
				needsRestart ? '已保存，彻底关闭并重新打开 App 后生效' : '已生效',
			)
		},
		[],
	)

	// 只在页面可见且 App 位于前台时轮询
	useFocusEffect(
		useCallback(() => {
			let timer: ReturnType<typeof setInterval> | null = null

			const refresh = () => {
				Orpheus.getAudioDebugInfo()
					.then((result) => {
						setSections(result)
						setError(null)
					})
					.catch((e: Error) => {
						setError(e.message)
					})
			}

			const start = () => {
				if (timer) return
				refresh()
				timer = setInterval(refresh, REFRESH_INTERVAL_MS)
			}

			const stop = () => {
				if (timer) clearInterval(timer)
				timer = null
			}

			if (AppState.currentState === 'active') start()

			const subscription = AppState.addEventListener('change', (state) => {
				if (state === 'active') start()
				else stop()
			})

			return () => {
				stop()
				subscription.remove()
			}
		}, []),
	)

	const handleCopy = useCallback(() => {
		void Clipboard.setStringAsync(formatSectionsAsText(sections)).then(() => {
			toast.success('已复制音频调试信息')
		})
	}, [sections])

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
					音频调试
				</Text>
				<Button
					mode='text'
					compact
					onPress={handleCopy}
					disabled={sections.length === 0}
				>
					复制
				</Button>
			</View>

			<ScrollView
				contentContainerStyle={[
					styles.scrollContent,
					{ paddingBottom: insets.bottom + 40 },
				]}
			>
				{error ? (
					<Text style={[styles.message, { color: theme.colors.error }]}>
						获取失败：{error}
					</Text>
				) : null}
				{!error && sections.length === 0 ? (
					<Text
						style={[styles.message, { color: theme.colors.onSurfaceVariant }]}
					>
						暂无数据（播放器尚未初始化，或当前平台不支持）
					</Text>
				) : null}

				{Platform.OS === 'android' ? (
					<View style={styles.section}>
						<Text
							variant='titleSmall'
							style={[styles.sectionTitle, { color: theme.colors.primary }]}
						>
							测量开关
						</Text>
						{TEST_OPTIONS.map((option, index) => (
							<View key={option.key}>
								{index > 0 ? <Divider /> : null}
								<View style={styles.row}>
									<View style={styles.label}>
										<Text variant='bodyMedium'>{option.label}</Text>
										<Text
											variant='bodySmall'
											style={{ color: theme.colors.onSurfaceVariant }}
										>
											{option.description}
										</Text>
									</View>
									<Switch
										value={testOptions[option.key]}
										onValueChange={() =>
											toggleTestOption(option.key, option.needsRestart)
										}
										accessibilityLabel={option.label}
										accessibilityHint={option.description}
									/>
								</View>
							</View>
						))}
					</View>
				) : null}

				{sections.map((section) => (
					<View
						key={section.title}
						style={styles.section}
					>
						<Text
							variant='titleSmall'
							style={[styles.sectionTitle, { color: theme.colors.primary }]}
						>
							{section.title}
						</Text>
						{section.items.map((item, index) => (
							<View key={item.label}>
								{index > 0 ? <Divider /> : null}
								<View style={styles.row}>
									<Text
										variant='bodyMedium'
										style={[
											styles.label,
											{ color: theme.colors.onSurfaceVariant },
										]}
									>
										{item.label}
									</Text>
									<Text
										variant='bodyMedium'
										selectable
										style={styles.value}
									>
										{item.value}
									</Text>
								</View>
							</View>
						))}
					</View>
				))}
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
	message: {
		paddingVertical: 16,
	},
	section: {
		marginBottom: 16,
	},
	sectionTitle: {
		fontWeight: '600',
		paddingVertical: 8,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		paddingVertical: 10,
		gap: 16,
	},
	label: {
		flex: 2,
	},
	value: {
		flex: 3,
		textAlign: 'right',
		fontVariant: ['tabular-nums'],
	},
})
