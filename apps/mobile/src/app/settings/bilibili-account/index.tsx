import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { ScrollView, StyleSheet, View } from 'react-native'
import {
	Appbar,
	Avatar,
	Divider,
	List,
	Surface,
	Text,
	useTheme,
} from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Button from '@/components/common/Button'
import UniversalSwitch from '@/components/common/UniversalSwitch'
import { alert } from '@/components/modals/AlertModal'
import NowPlayingBar from '@/components/NowPlayingBar'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { usePersonalInformation } from '@/hooks/queries/bilibili/user'
import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { queryClient } from '@/lib/config/queryClient'
import toast from '@/utils/toast'

export default function BilibiliAccountSettingsPage() {
	const router = useRouter()
	const { colors } = useTheme()
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()
	const openModal = useModalStore((state) => state.open)
	const hasBilibiliCookie = useAppStore((state) => state.hasBilibiliCookie())
	const cachedUserInfo = useAppStore((state) => state.bilibiliUserInfo)
	const clearBilibiliCookie = useAppStore((state) => state.clearBilibiliCookie)
	const sendPlayHistory = useAppStore((state) => state.settings.sendPlayHistory)
	const setSettings = useAppStore((state) => state.setSettings)
	const { data: personalInfo } = usePersonalInformation()
	const profile = personalInfo ?? cachedUserInfo

	const clearAccount = () => {
		alert(
			'退出 Bilibili 账号？',
			'退出后收藏夹、稍后再看和播放记录上报等功能会暂停。',
			[
				{ text: '取消' },
				{
					text: '确定',
					onPress: async () => {
						clearBilibiliCookie()
						await queryClient.cancelQueries()
						queryClient.clear()
						toast.success('Bilibili 账号已退出')
					},
				},
			],
			{ cancelable: true },
		)
	}

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title='Bilibili 账号' />
			</Appbar.Header>
			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={[
					styles.scrollContent,
					{ paddingBottom: insets.bottom + (haveTrack ? 90 : 24) },
				]}
			>
				{hasBilibiliCookie ? (
					<>
						<Surface
							mode='flat'
							style={[
								styles.profileCard,
								{ backgroundColor: colors.surfaceVariant },
							]}
						>
							{profile?.face ? (
								<Image
									source={{ uri: profile.face }}
									style={styles.profileImage}
									cachePolicy='disk'
								/>
							) : (
								<Avatar.Image
									size={72}
									source={require('../../../../assets/images/bilibili-default-avatar.jpg')}
								/>
							)}
							<View style={styles.profileText}>
								<Text
									variant='titleLarge'
									numberOfLines={1}
								>
									{profile?.name ?? 'Bilibili 用户'}
								</Text>
								<Text
									variant='bodyMedium'
									style={{ color: colors.onSurfaceVariant }}
									numberOfLines={1}
								>
									{profile?.mid ? `UID ${profile.mid}` : '已保存 Cookie'}
								</Text>
							</View>
						</Surface>
						<View style={styles.section}>
							<View style={styles.settingRow}>
								<View style={styles.settingText}>
									<Text variant='bodyLarge'>上报观看进度</Text>
									<Text
										variant='bodySmall'
										style={{ color: colors.onSurfaceVariant }}
									>
										播放 Bilibili 来源歌曲时同步观看记录
									</Text>
								</View>
								<UniversalSwitch
									value={sendPlayHistory}
									onValueChange={() =>
										setSettings({ sendPlayHistory: !sendPlayHistory })
									}
								/>
							</View>
							<Divider />
							<List.Item
								title='重新扫码登录'
								description='适合在当前 Cookie 失效后重新授权'
								left={(props) => (
									<List.Icon
										{...props}
										icon='qrcode-scan'
									/>
								)}
								right={(props) => (
									<List.Icon
										{...props}
										icon='chevron-right'
									/>
								)}
								onPress={() =>
									router.push(
										'/settings/bilibili-account/qrcode-login' as never,
									)
								}
							/>
							<Divider />
							<List.Item
								title='手机号登录'
								description='使用短信验证码登录 Bilibili'
								left={(props) => (
									<List.Icon
										{...props}
										icon='cellphone-key'
									/>
								)}
								right={(props) => (
									<List.Icon
										{...props}
										icon='chevron-right'
									/>
								)}
								onPress={() =>
									router.push('/settings/bilibili-account/phone-login' as never)
								}
							/>
							<Divider />
							<List.Item
								title='修改 Cookie'
								description='手动粘贴或清空 Bilibili Cookie'
								left={(props) => (
									<List.Icon
										{...props}
										icon='cookie'
									/>
								)}
								right={(props) => (
									<List.Icon
										{...props}
										icon='chevron-right'
									/>
								)}
								onPress={() => openModal('CookieLogin', undefined)}
							/>
						</View>
						<Button
							mode='outlined'
							onPress={clearAccount}
						>
							退出 Bilibili 账号
						</Button>
					</>
				) : (
					<>
						<View style={styles.loginHero}>
							<Avatar.Image
								size={72}
								source={require('../../../../assets/images/bilibili-default-avatar.jpg')}
							/>
							<View style={styles.loginHeroText}>
								<Text variant='headlineSmall'>连接 Bilibili</Text>
								<Text
									variant='bodyMedium'
									style={{ color: colors.onSurfaceVariant }}
								>
									登录后可以读取收藏夹、稍后再看、上传播放记录，并访问需要账号权限的内容。
								</Text>
							</View>
						</View>
						<View style={styles.loginActions}>
							<Button
								mode='contained'
								icon='qrcode-scan'
								onPress={() =>
									router.push(
										'/settings/bilibili-account/qrcode-login' as never,
									)
								}
							>
								扫码登录
							</Button>
							<Button
								mode='outlined'
								icon='cellphone-key'
								onPress={() =>
									router.push('/settings/bilibili-account/phone-login' as never)
								}
							>
								手机号登录
							</Button>
							<Button
								mode='outlined'
								icon='cookie'
								onPress={() => openModal('CookieLogin', undefined)}
							>
								添加 Cookie
							</Button>
						</View>
					</>
				)}
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
	profileCard: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 16,
		borderRadius: 8,
		padding: 18,
	},
	profileImage: {
		width: 72,
		height: 72,
		borderRadius: 36,
	},
	profileText: {
		flex: 1,
		gap: 4,
	},
	section: {
		borderRadius: 8,
		overflow: 'hidden',
	},
	settingRow: {
		minHeight: 72,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
		gap: 16,
	},
	settingText: {
		flex: 1,
		gap: 2,
	},
	loginHero: {
		alignItems: 'center',
		gap: 16,
		paddingTop: 24,
	},
	loginHeroText: {
		alignItems: 'center',
		gap: 8,
	},
	loginActions: {
		gap: 12,
	},
	nowPlayingBarContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
	},
})
