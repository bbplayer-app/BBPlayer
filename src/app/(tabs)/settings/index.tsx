import NowPlayingBar from '@/components/NowPlayingBar'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import toast from '@/utils/toast'
import * as Application from 'expo-application'
import * as Clipboard from 'expo-clipboard'
import { useRouter } from 'expo-router'
import * as Updates from 'expo-updates'
import * as WebBrowser from 'expo-web-browser'
import { memo } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Divider, List, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const updateTime = Updates.createdAt
	? `${Updates.createdAt.getFullYear()}-${Updates.createdAt.getMonth() + 1}-${Updates.createdAt.getDate()}`
	: ''

export default function SettingsPage() {
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()
	const colors = useTheme().colors
	const router = useRouter()

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<View
				style={{
					flex: 1,
					paddingTop: insets.top + 8,
					paddingBottom: haveTrack ? 70 : 0,
				}}
			>
				<View style={styles.header}>
					<Text
						variant='headlineSmall'
						style={styles.title}
					>
						设置
					</Text>
				</View>
				<ScrollView
					style={styles.scrollView}
					contentContainerStyle={styles.scrollContent}
					contentInsetAdjustmentBehavior='automatic'
				>
					<List.Item
						title='外观'
						description='主题、播放器样式、歌词样式'
						left={(props) => (
							<List.Icon
								{...props}
								icon='palette'
							/>
						)}
						right={(props) => (
							<List.Icon
								{...props}
								icon='chevron-right'
							/>
						)}
						onPress={() => router.push('/settings/appearance')}
					/>
					<Divider style={styles.divider} />
					<List.Item
						title='播放'
						description='播放行为、音效设置'
						left={(props) => (
							<List.Icon
								{...props}
								icon='play-circle'
							/>
						)}
						right={(props) => (
							<List.Icon
								{...props}
								icon='chevron-right'
							/>
						)}
						onPress={() => router.push('/settings/playback')}
					/>
					<Divider style={styles.divider} />
					<List.Item
						title='通用'
						description='账号、更新、日志、调试'
						left={(props) => (
							<List.Icon
								{...props}
								icon='cog'
							/>
						)}
						right={(props) => (
							<List.Icon
								{...props}
								icon='chevron-right'
							/>
						)}
						onPress={() => router.push('/settings/general')}
					/>
					<Divider style={styles.divider} />
					<List.Item
						title='捐赠支持'
						description='请开发者喝杯咖啡'
						left={(props) => (
							<List.Icon
								{...props}
								icon='coffee'
							/>
						)}
						right={(props) => (
							<List.Icon
								{...props}
								icon='chevron-right'
							/>
						)}
						onPress={() => router.push('/settings/donate')}
					/>
				</ScrollView>
				<Divider style={styles.sectionDivider} />
				<AboutSection />
			</View>
			<View style={styles.nowPlayingBarContainer}>
				<NowPlayingBar />
			</View>
		</View>
	)
}

const AboutSection = memo(function AboutSection() {
	return (
		<View style={styles.aboutSectionContainer}>
			<Text
				variant='titleLarge'
				style={styles.aboutTitle}
			>
				BBPlayer
			</Text>
			<Text
				variant='bodySmall'
				style={styles.aboutVersion}
			>
				v{Application.nativeApplicationVersion}:{Application.nativeBuildVersion}{' '}
				{Updates.updateId
					? `(hotfix-${Updates.updateId.slice(0, 7)}-${updateTime})`
					: ''}
			</Text>

			<Text
				variant='bodyMedium'
				style={styles.aboutSubtitle}
			>
				又一个{'\u2009Bilibili\u2009'}音乐播放器
			</Text>
			<Text
				variant='bodyMedium'
				style={styles.aboutWebsite}
			>
				官网：
				<Text
					variant='bodyMedium'
					onPress={() =>
						WebBrowser.openBrowserAsync('https://bbplayer.roitium.com').catch(
							(e) => {
								void Clipboard.setStringAsync('https://bbplayer.roitium.com')
								toast.error('无法调用浏览器打开网页，已将链接复制到剪贴板', {
									description: String(e),
								})
							},
						)
					}
					style={styles.aboutWebsiteLink}
				>
					https://bbplayer.roitium.com
				</Text>
			</Text>
		</View>
	)
})

AboutSection.displayName = 'AboutSection'

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	header: {
		paddingHorizontal: 25,
		paddingBottom: 20,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	title: {
		fontWeight: 'bold',
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		paddingHorizontal: 16,
	},
	divider: {
		marginVertical: 4,
		backgroundColor: 'transparent', // Spacer
	},
	sectionDivider: {
		marginTop: 24,
		marginBottom: 24,
	},
	nowPlayingBarContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
	},
	aboutSectionContainer: {
		paddingBottom: 15,
	},
	aboutTitle: {
		textAlign: 'center',
		marginBottom: 5,
	},
	aboutVersion: {
		textAlign: 'center',
		marginBottom: 5,
	},
	aboutSubtitle: {
		textAlign: 'center',
	},
	aboutWebsite: {
		textAlign: 'center',
		marginTop: 8,
	},
	aboutWebsiteLink: {
		textDecorationLine: 'underline',
	},
})
