import { LinearGradient } from 'expo-linear-gradient'
import { useObserve } from 'expo-observe'
import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Divider, List, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import SettingsSectionTitle from '@/components/common/SettingsSectionTitle'
import SkinAppbarBackground from '@/components/navigation/SkinAppbarBackground'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import useAppStore from '@/hooks/stores/useAppStore'
import useSkinForegroundColor from '@/hooks/theme/useSkinForegroundColor'
import { useNowPlayingBar } from '@/hooks/ui/useNowPlayingBar'

export default function SettingsPage() {
	useNowPlayingBar()
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()
	const colors = useTheme().colors
	const headerForegroundColor = useSkinForegroundColor()
	const router = useRouter()
	const account = useAppStore((state) => state.bbplayerAccount)
	const hasBilibiliCookie = useAppStore((state) => state.hasBilibiliCookie())
	const bilibiliUserInfo = useAppStore((state) => state.bilibiliUserInfo)
	const { markInteractive } = useObserve()

	useEffect(() => {
		markInteractive()
	}, [markInteractive])

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<SkinAppbarBackground height={insets.top + 100} />
			<View
				style={{
					flex: 1,
					paddingTop: insets.top + 8,
					paddingBottom: haveTrack ? 70 : 0,
				}}
			>
				<View style={[styles.header]}>
					<Text
						variant='headlineSmall'
						style={[styles.title, { color: headerForegroundColor }]}
					>
						设置
					</Text>
				</View>
				<ScrollView
					style={styles.scrollView}
					contentContainerStyle={styles.scrollContent}
					showsVerticalScrollIndicator
					persistentScrollbar // 我看哪个 b 还说看不见这是可滚动的？！
				>
					<SettingsSectionTitle
						title='个性化'
						first
					/>
					<List.Item
						title='外观与主题'
						description='播放器样式、动态主题、启动动画'
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
						description='播放行为、启动行为、音效'
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
						title='歌词'
						description='歌词源、桌面歌词、样式'
						left={(props) => (
							<List.Icon
								{...props}
								icon='text-box-outline'
							/>
						)}
						right={(props) => (
							<List.Icon
								{...props}
								icon='chevron-right'
							/>
						)}
						onPress={() => router.push('/settings/lyrics')}
					/>

					<SettingsSectionTitle title='账号' />
					<List.Item
						title='Bilibili 账号'
						description={
							hasBilibiliCookie && bilibiliUserInfo
								? `${bilibiliUserInfo.name} ( uid${bilibiliUserInfo.mid} )`
								: '扫码、手机号或 Cookie 登录'
						}
						left={(props) => (
							<List.Icon
								{...props}
								icon='account-box'
							/>
						)}
						right={(props) => (
							<List.Icon
								{...props}
								icon='chevron-right'
							/>
						)}
						onPress={() => router.push('/settings/bilibili-account')}
					/>
					<Divider style={styles.divider} />
					<List.Item
						title='BBPlayer 账号'
						description={
							account
								? `${account.name} ( @${account.username} )`
								: '注册、登录、个人资料'
						}
						left={(props) => (
							<List.Icon
								{...props}
								icon='account-circle'
							/>
						)}
						right={(props) => (
							<List.Icon
								{...props}
								icon='chevron-right'
							/>
						)}
						onPress={() => router.push('/settings/account')}
					/>

					<SettingsSectionTitle title='媒体库与存储' />
					<List.Item
						title='下载与存储'
						description='下载并发、存储占用、缓存清理'
						left={(props) => (
							<List.Icon
								{...props}
								icon='harddisk'
							/>
						)}
						right={(props) => (
							<List.Icon
								{...props}
								icon='chevron-right'
							/>
						)}
						onPress={() => router.push('/settings/storage')}
					/>

					<SettingsSectionTitle title='数据' />
					<List.Item
						title='数据与备份'
						description='本地备份、WebDAV 云端备份'
						left={(props) => (
							<List.Icon
								{...props}
								icon='cloud-sync'
							/>
						)}
						right={(props) => (
							<List.Icon
								{...props}
								icon='chevron-right'
							/>
						)}
						onPress={() => router.push('/settings/backup')}
					/>

					<SettingsSectionTitle title='通用与关于' />
					<List.Item
						title='通用'
						description='更新、日志、调试'
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
						testID='setting-general'
					/>
					<Divider style={styles.divider} />
					<List.Item
						title='关于 BBPlayer'
						description='版本、项目主页'
						left={(props) => (
							<List.Icon
								{...props}
								icon='information'
							/>
						)}
						right={(props) => (
							<List.Icon
								{...props}
								icon='chevron-right'
							/>
						)}
						onPress={() => router.push('/settings/about')}
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
			</View>
			<LinearGradient
				pointerEvents='none'
				colors={['rgba(0,0,0,0)', colors.background]}
				style={[styles.bottomFade, { bottom: haveTrack ? 70 : 0 }]}
			/>
		</View>
	)
}

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
		// 与底部渐变高度一致，保证末项刚好落在渐变上方，不留多余空白
		paddingBottom: 40,
	},
	divider: {
		marginVertical: 4,
		backgroundColor: 'transparent', // Spacer
	},
	bottomFade: {
		position: 'absolute',
		left: 0,
		right: 0,
		height: 40,
	},
})
