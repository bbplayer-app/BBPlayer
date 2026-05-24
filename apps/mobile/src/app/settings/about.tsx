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
import NowPlayingBar from '@/components/NowPlayingBar'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import toast from '@/utils/toast'

const updateTime = Updates.createdAt
	? `${Updates.createdAt.getFullYear()}-${Updates.createdAt.getMonth() + 1}-${Updates.createdAt.getDate()}`
	: ''

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

export default function AboutSettingsPage() {
	const router = useRouter()
	const { colors } = useTheme()
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()
	const versionText = `v${Application.nativeApplicationVersion}:${Application.nativeBuildVersion}${
		Updates.updateId
			? ` hotfix-${Updates.updateId.slice(0, 7)}-${updateTime}`
			: ''
	}`

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
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
						title='开源许可证'
						description='使用到的开源库'
						left={(props) => (
							<List.Icon
								{...props}
								icon='file-certificate'
							/>
						)}
						right={(props) => (
							<List.Icon
								{...props}
								icon='chevron-right'
							/>
						)}
						onPress={() => router.push('/settings/about/licenses' as never)}
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
				</View>
			</ScrollView>
			<View style={styles.nowPlayingBarContainer}>
				<NowPlayingBar />
			</View>
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
	nowPlayingBarContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
	},
})
