import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Divider, List, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import NowPlayingBar from '@/components/NowPlayingBar'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import useAppStore from '@/hooks/stores/useAppStore'

export default function SettingsPage() {
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()
	const colors = useTheme().colors
	const router = useRouter()
	const account = useAppStore((state) => state.bbplayerAccount)
	const hasBilibiliCookie = useAppStore((state) => state.hasBilibiliCookie())
	const bilibiliUserInfo = useAppStore((state) => state.bilibiliUserInfo)

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
					contentContainerStyle={[
						styles.scrollContent,
						{ paddingBottom: insets.bottom + (haveTrack ? 132 : 40) },
					]}
					contentInsetAdjustmentBehavior='automatic'
					showsVerticalScrollIndicator
					persistentScrollbar // 我看哪个 b 还说看不见这是可滚动的？！
				>
					<List.Item
						title='外观'
						description='主题、播放器样式'
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
					<Divider style={styles.divider} />
					<List.Item
						title='下载'
						description='相关设置'
						left={(props) => (
							<List.Icon
								{...props}
								icon='download'
							/>
						)}
						right={(props) => (
							<List.Icon
								{...props}
								icon='chevron-right'
							/>
						)}
						onPress={() => router.push('/settings/download')}
					/>
					<Divider style={styles.divider} />
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
						onPress={() => router.push('/settings/bilibili-account' as never)}
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
						onPress={() => router.push('/settings/account' as never)}
					/>
					<Divider style={styles.divider} />
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
					<Divider style={styles.divider} />
					<List.Item
						title='关于 BBPlayer'
						description='版本、开源许可证'
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
						onPress={() => router.push('/settings/about' as never)}
					/>
				</ScrollView>
			</View>
			<LinearGradient
				pointerEvents='none'
				colors={['rgba(0,0,0,0)', colors.background]}
				style={[styles.bottomFade, { bottom: haveTrack ? 70 : 0 }]}
			/>
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
	nowPlayingBarContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
	},
	bottomFade: {
		position: 'absolute',
		left: 0,
		right: 0,
		height: 40,
	},
})
