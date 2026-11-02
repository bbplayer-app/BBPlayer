import { Orpheus, type BilibiliCdnPreference } from '@bbplayer/orpheus'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import {
	Appbar,
	Button,
	List,
	RadioButton,
	Text,
	useTheme,
} from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import SettingsSectionTitle from '@/components/common/SettingsSectionTitle'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import {
	BILIBILI_CDN_OPTIONS,
	getCdnTestNodes,
	measureCdnSpeed,
	setPreferredBilibiliCdn,
	type BilibiliCdnNode,
} from '@/lib/services/bilibiliCdnService'
import { toastAndLogError } from '@/utils/error-handling'

interface NodeResult {
	node: BilibiliCdnNode
	status: string
}

export default function CdnSettingsPage() {
	const router = useRouter()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()
	const currentTrack = useCurrentTrack()
	const [preferred, setPreferred] = useState(Orpheus.preferredBilibiliCdn)
	const [running, setRunning] = useState(false)
	const [preparing, setPreparing] = useState(false)
	const [results, setResults] = useState<NodeResult[]>([])
	const [sampleName, setSampleName] = useState('')
	const operation = useRef<AbortController | null>(null)

	useEffect(
		() => () => {
			operation.current?.abort()
			operation.current = null
		},
		[],
	)

	const selectCdn = (value: string) => {
		const option = BILIBILI_CDN_OPTIONS.find((item) => item.id === value)
		if (!option) return
		try {
			setPreferredBilibiliCdn(option.id)
			setPreferred(option.id)
		} catch (error) {
			toastAndLogError('设置首选 CDN 失败', error, 'Settings.CDN')
		}
	}

	const cancel = () => {
		operation.current?.abort()
		operation.current = null
		setRunning(false)
		setPreparing(false)
		setResults((items) =>
			items.map((item) => ({
				...item,
				status:
					item.status === '等待测速' || item.status === '测速中…'
						? '已取消'
						: item.status,
			})),
		)
	}

	const start = async () => {
		if (operation.current) return
		const controller = new AbortController()
		operation.current = controller
		const active = () =>
			operation.current === controller && !controller.signal.aborted
		setRunning(true)
		setPreparing(true)
		setResults([])
		const track = currentTrack?.source === 'bilibili' ? currentTrack : null
		setSampleName(track?.title ?? '预设视频 BV1fK4y1t7hj')
		try {
			const nodes = await getCdnTestNodes(track, controller.signal)
			if (!active()) return
			setPreparing(false)
			setResults(nodes.map((node) => ({ node, status: '等待测速' })))
			for (const node of nodes) {
				if (!active()) break
				const update = (status: string) => {
					if (!active()) return
					setResults((items) =>
						items.map((item) =>
							item.node.host === node.host ? { ...item, status } : item,
						),
					)
				}
				update('测速中…')
				try {
					const result = await measureCdnSpeed(node.url, controller.signal)
					update(
						`${result.megabytesPerSecond.toFixed(2)} MB/s · 响应 ${Math.round(result.latencyMs)} ms`,
					)
				} catch (error) {
					update(error instanceof Error ? error.message : '测速失败')
				}
			}
		} catch (error) {
			if (active()) toastAndLogError('获取测速节点失败', error, 'Settings.CDN')
		} finally {
			if (operation.current === controller) {
				operation.current = null
				setRunning(false)
				setPreparing(false)
			}
		}
	}

	const availability = (id: BilibiliCdnPreference) => {
		if (id === 'auto' || !results.length) return undefined
		return results.some(({ node }) => node.provider === id)
			? undefined
			: '本次未返回该 CDN 节点'
	}

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title='CDN 设置' />
			</Appbar.Header>
			<ScrollView
				contentContainerStyle={[
					styles.content,
					{ paddingBottom: insets.bottom + (currentTrack ? 100 : 24) },
				]}
			>
				<SettingsSectionTitle
					title='首选 CDN'
					first
				/>
				<Text
					variant='bodySmall'
					style={{ color: colors.onSurfaceVariant }}
				>
					优先使用所选服务商的常规节点，再尝试其他常规节点，最后尝试
					mcdn。自动模式优先使用常规
					CDN。对之后的播放和下载请求生效，已缓存内容不受影响。
				</Text>
				<RadioButton.Group
					onValueChange={selectCdn}
					value={preferred}
				>
					{BILIBILI_CDN_OPTIONS.map((option) => (
						<List.Item
							key={option.id}
							title={option.label}
							description={availability(option.id)}
							onPress={() => selectCdn(option.id)}
							right={() => <RadioButton value={option.id} />}
						/>
					))}
				</RadioButton.Group>
				<SettingsSectionTitle title='CDN 测速' />
				<Text
					variant='bodySmall'
					style={{ color: colors.onSurfaceVariant }}
				>
					优先使用当前播放的 B
					站内容，没有时使用预设视频。逐个测试实际返回的节点，每个节点最多采样约
					2 MB，超时 8 秒，会消耗网络流量。结果仅供参考。
				</Text>
				<Button
					mode='contained-tonal'
					style={styles.button}
					onPress={running ? cancel : () => void start()}
				>
					{running ? '取消测速' : '开始测速'}
				</Button>
				{sampleName ? (
					<Text variant='bodySmall'>测速音源：{sampleName}</Text>
				) : null}
				{preparing ? (
					<Text style={styles.preparing}>正在获取音频节点…</Text>
				) : null}
				{results.map(({ node, status }) => (
					<List.Item
						key={node.host}
						title={
							node.provider === 'auto'
								? 'B 站分配节点'
								: BILIBILI_CDN_OPTIONS.find(
										(option) => option.id === node.provider,
									)?.label
						}
						description={`${node.host}\n${status}`}
						descriptionNumberOfLines={3}
					/>
				))}
			</ScrollView>
		</View>
	)
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	content: { paddingHorizontal: 24 },
	button: { marginVertical: 16, alignSelf: 'flex-start' },
	preparing: { marginTop: 12 },
})
