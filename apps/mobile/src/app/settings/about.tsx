import * as Application from 'expo-application'
import * as Clipboard from 'expo-clipboard'
import { useRouter } from 'expo-router'
import * as Updates from 'expo-updates'
import * as WebBrowser from 'expo-web-browser'
import { ScrollView, StyleSheet, View } from 'react-native'
import {
	Appbar,
	Divider,
	List,
	Surface,
	Text,
	useTheme,
} from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Button from '@/components/common/Button'
import { useSettingsSplit } from '@/components/layout/SettingsNavigation'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { getDiagnosticId } from '@/lib/config/sentry'
import toast from '@/utils/toast'

const openExternalLink = async (url: string) => {
	try {
		await WebBrowser.openBrowserAsync(url)
	} catch (e) {
		await Clipboard.setStringAsync(url)
		toast.error('无法调用浏览器打开网页，已将链接复制到剪贴板', {
			description: String(e),
		})
	}
}

// 匿名 ID，只有用户主动提供时才能用它在 Sentry 里找到对应的日志
const copyDiagnosticId = async (id: string) => {
	try {
		await Clipboard.setStringAsync(id)
	} catch (e) {
		toast.error('复制诊断 ID 失败', { description: String(e) })

		return
	}

	toast.success('已复制诊断 ID', {
		description: '反馈问题时附上它，方便定位日志',
	})
}

const updateTime = Updates.createdAt
	? `${Updates.createdAt.getFullYear()}-${Updates.createdAt.getMonth() + 1}-${Updates.createdAt.getDate()}`
	: ''

export default function AboutSettingsPage() {
	const router = useRouter()
	const split = useSettingsSplit()
	const { colors } = useTheme()
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()

	const diagnosticId = getDiagnosticId()

	const versionText = `v${Application.nativeApplicationVersion}:${Application.nativeBuildVersion}${
		Updates.updateId
			? ` hotfix-${Updates.updateId.slice(0, 7)}-${updateTime}`
			: ''
	}`

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header>
				{!split && <Appbar.BackAction onPress={() => router.back()} />}
				<Appbar.Content title='关于 BBPlayer' />
			</Appbar.Header>
			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={[
					styles.scrollContent,
					{ paddingBottom: insets.bottom + (haveTrack ? 90 : 24) },
				]}
			>
				<Surface
					mode='flat'
					style={[styles.hero, { backgroundColor: colors.surfaceVariant }]}
				>
					<Text variant='headlineMedium'>BBPlayer</Text>
					<Text
						variant='bodyLarge'
						style={{ color: colors.onSurfaceVariant }}
					>
						又一个 Bilibili 音乐播放器
					</Text>
					<Text
						variant='bodySmall'
						style={{ color: colors.onSurfaceVariant }}
					>
						{versionText}
					</Text>
					<View style={styles.linkButtons}>
						<Button
							mode='contained'
							icon='web'
							onPress={() =>
								void openExternalLink('https://bbplayer.roitium.com')
							}
						>
							官网
						</Button>
						<Button
							mode='outlined'
							icon='github'
							onPress={() =>
								void openExternalLink(
									'https://github.com/bbplayer-app/BBPlayer',
								)
							}
						>
							GitHub
						</Button>
					</View>
				</Surface>
				<View style={styles.section}>
					<List.Item
						title='诊断 ID'
						description={
							diagnosticId ?? '未开启数据分享（设置 → 通用 → 隐私与数据）'
						}
						left={(props) => (
							<List.Icon
								{...props}
								icon='identifier'
							/>
						)}
						right={(props) =>
							diagnosticId ? (
								<List.Icon
									{...props}
									icon='content-copy'
								/>
							) : null
						}
						onPress={
							diagnosticId
								? () => void copyDiagnosticId(diagnosticId)
								: undefined
						}
					/>
					<Divider />
					<List.Item
						title='项目主页'
						description='github.com/bbplayer-app/BBPlayer'
						left={(props) => (
							<List.Icon
								{...props}
								icon='github'
							/>
						)}
						right={(props) => (
							<List.Icon
								{...props}
								icon='open-in-new'
							/>
						)}
						onPress={() =>
							void openExternalLink('https://github.com/bbplayer-app/BBPlayer')
						}
					/>
					<Divider />
					<List.Item
						title='官方网站'
						description='bbplayer.roitium.com'
						left={(props) => (
							<List.Icon
								{...props}
								icon='web'
							/>
						)}
						right={(props) => (
							<List.Icon
								{...props}
								icon='open-in-new'
							/>
						)}
						onPress={() =>
							void openExternalLink('https://bbplayer.roitium.com')
						}
					/>
					<Divider />
					<List.Item
						title='第三方组件许可'
						description='FFmpeg（LGPL 2.1+）等'
						left={(props) => (
							<List.Icon
								{...props}
								icon='license'
							/>
						)}
						right={(props) => (
							<List.Icon
								{...props}
								icon='open-in-new'
							/>
						)}
						onPress={() =>
							void openExternalLink(
								'https://github.com/bbplayer-app/BBPlayer/blob/dev/THIRD_PARTY_NOTICES.md',
							)
						}
					/>
				</View>
			</ScrollView>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		gap: 18,
		paddingHorizontal: 20,
		paddingTop: 8,
	},
	hero: {
		gap: 8,
		borderRadius: 8,
		padding: 20,
	},
	linkButtons: {
		flexDirection: 'row',
		gap: 12,
		marginTop: 8,
	},
	section: {
		borderRadius: 8,
		overflow: 'hidden',
	},
})
