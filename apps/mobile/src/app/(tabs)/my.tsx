import type { TrueSheet } from '@lodev09/react-native-true-sheet'
import dayjs from 'dayjs'
import { eq } from 'drizzle-orm'
import { useLiveQuery } from 'drizzle-orm/expo-sqlite'
import { Image } from 'expo-image'
import { useObserve } from 'expo-observe'
import { useRouter } from 'expo-router'
import { useEffect, useRef } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Touchable } from 'react-native-gesture-handler'
import { Icon, List, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import IconButton from '@/components/common/IconButton'
import SettingsSectionTitle from '@/components/common/SettingsSectionTitle'
import SkinAppbarBackground from '@/components/navigation/SkinAppbarBackground'
import { SyncFailuresSheet } from '@/features/playlist/local/components/SyncFailuresSheet'
import ListeningRecordSection from '@/features/profile/ListeningRecordSection'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { usePersonalInformation } from '@/hooks/queries/bilibili/user'
import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import useSkinStore from '@/hooks/stores/useSkinStore'
import useActiveSkin from '@/hooks/theme/useActiveSkin'
import useSkinForegroundColor from '@/hooks/theme/useSkinForegroundColor'
import { useNowPlayingBar } from '@/hooks/ui/useNowPlayingBar'
import db from '@/lib/db/db'
import * as schema from '@/lib/db/schema'
import { markPerfInteractive } from '@/lib/performance'

export default function MyPage() {
	useNowPlayingBar()
	const { colors } = useTheme()
	const insets = useSafeAreaInsets()
	const router = useRouter()
	const haveTrack = useCurrentTrack()
	const hideStarPrompt = useAppStore((state) => state.settings.hideStarPrompt)
	const openModal = useModalStore((state) => state.open)
	const syncFailuresSheetRef = useRef<TrueSheet>(null)
	const { data: syncFailures } = useLiveQuery(
		db
			.select({ id: schema.playlistSyncQueue.id })
			.from(schema.playlistSyncQueue)
			.where(eq(schema.playlistSyncQueue.status, 'failed'))
			.limit(1),
	)

	const headerForegroundColor = useSkinForegroundColor()
	const hasCookie = useAppStore((state) => state.hasBilibiliCookie())
	const cachedProfile = useAppStore((state) => state.bilibiliUserInfo)
	const account = useAppStore((state) => state.bbplayerAccount)
	const token = useAppStore((state) => state.bbplayerToken)
	const { data: personalInfo } = usePersonalInformation()
	const profile = hasCookie ? (personalInfo ?? cachedProfile) : undefined
	const activeSkin = useActiveSkin()
	const avatarFrameIndex = useSkinStore((state) => state.activeAvatarFrameIndex)
	const avatarFrame = activeSkin?.avatarFrames[avatarFrameIndex]
	const { markInteractive } = useObserve()
	useEffect(() => {
		markInteractive()
		void markPerfInteractive()
	}, [markInteractive])
	const chevron = () => (
		<Icon
			source='chevron-right'
			size={24}
			color={colors.onSurfaceVariant}
		/>
	)

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<SkinAppbarBackground height={insets.top + 100} />
			<View style={[styles.header, { paddingTop: insets.top + 8 }]}>
				<Text
					variant='headlineSmall'
					style={[styles.bold, { color: headerForegroundColor }]}
				>
					我的
				</Text>
				<View style={styles.headerActions}>
					{!hideStarPrompt && (
						<IconButton
							icon='star-outline'
							accessibilityLabel='去 GitHub 点个 Star'
							iconColor={headerForegroundColor}
							onPress={() => openModal('StarPrompt', undefined)}
						/>
					)}
					<IconButton
						icon='cog-outline'
						accessibilityLabel='设置'
						iconColor={headerForegroundColor}
						onPress={() => router.navigate('/settings')}
					/>
				</View>
			</View>
			<ScrollView
				contentContainerStyle={[
					styles.content,
					{ paddingBottom: haveTrack ? 86 : 24 },
				]}
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.accounts}>
					<Touchable
						accessibilityRole='button'
						accessibilityLabel={
							hasCookie ? '管理 Bilibili 账号' : '登录 Bilibili 账号'
						}
						style={styles.profile}
						onPress={() => router.navigate('/settings/bilibili-account')}
					>
						<View style={styles.avatarWrapper}>
							<Image
								style={styles.avatar}
								source={
									profile?.face
										? { uri: profile.face }
										: require('../../../assets/images/bilibili-default-avatar.jpg')
								}
								cachePolicy='disk'
							/>
							{avatarFrame && (
								<Image
									source={avatarFrame}
									style={styles.avatarFrame}
									contentFit='contain'
									cachePolicy='memory-disk'
								/>
							)}
						</View>
						<View style={styles.profileText}>
							<Text
								variant='titleLarge'
								style={styles.bold}
								numberOfLines={1}
							>
								{hasCookie
									? (profile?.name ?? 'Bilibili 用户')
									: '登录 Bilibili'}
							</Text>
							<Text
								variant='bodyMedium'
								style={{ color: colors.onSurfaceVariant }}
							>
								{hasCookie
									? 'Bilibili 账号'
									: '登录后使用收藏夹、关注与稍后再看'}
							</Text>
						</View>
						{chevron()}
					</Touchable>
					<Touchable
						accessibilityRole='button'
						accessibilityLabel='BBPlayer 账号'
						style={[
							styles.accountBar,
							{ backgroundColor: colors.surfaceVariant },
						]}
						onPress={() => router.navigate('/settings/account')}
					>
						<Icon
							source='link-variant'
							size={20}
							color={colors.onSurfaceVariant}
						/>
						<Text
							variant='titleSmall'
							style={{ color: colors.onSurfaceVariant }}
						>
							BBPlayer 账号
						</Text>
						<Text
							variant='bodySmall'
							style={[styles.accountStatus, { color: colors.onSurfaceVariant }]}
							numberOfLines={1}
						>
							{token ? (account?.name ?? '已登录') : '未登录'}
						</Text>
						{chevron()}
					</Touchable>
				</View>
				<ListeningRecordSection />
				<SettingsSectionTitle
					title='我的内容'
					first
				/>
				<View>
					{syncFailures.length > 0 && (
						<List.Item
							title='歌单同步失败'
							left={(props) => (
								<List.Icon
									{...props}
									icon='alert-circle-outline'
									color={colors.error}
								/>
							)}
							right={chevron}
							onPress={() => void syncFailuresSheetRef.current?.present()}
						/>
					)}
					<List.Item
						title='最近常听'
						left={(props) => (
							<List.Icon
								{...props}
								icon='history'
							/>
						)}
						right={chevron}
						onPress={() => router.navigate('/playlist/recently')}
					/>
					<List.Item
						title='我的关注'
						left={(props) => (
							<List.Icon
								{...props}
								icon='account-heart-outline'
							/>
						)}
						right={chevron}
						onPress={() => router.navigate('/following')}
					/>
					<List.Item
						title='下载'
						left={(props) => (
							<List.Icon
								{...props}
								icon='download-box-outline'
							/>
						)}
						right={chevron}
						onPress={() => router.navigate('/downloaded')}
					/>
					<List.Item
						title='稍后再看'
						left={(props) => (
							<List.Icon
								{...props}
								icon='clock-outline'
							/>
						)}
						right={chevron}
						onPress={() =>
							router.navigate(
								hasCookie
									? '/playlist/remote/toview'
									: '/settings/bilibili-account',
							)
						}
					/>
					<List.Item
						title='那月今日'
						left={(props) => (
							<List.Icon
								{...props}
								icon='calendar-month-outline'
							/>
						)}
						right={chevron}
						onPress={() =>
							router.navigate(
								`/history/${dayjs().subtract(1, 'month').format('YYYY-MM-DD')}`,
							)
						}
					/>
				</View>
			</ScrollView>
			<SyncFailuresSheet ref={syncFailuresSheetRef} />
		</View>
	)
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	header: {
		paddingHorizontal: 16,
		paddingBottom: 12,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	headerActions: { flexDirection: 'row', alignItems: 'center' },
	content: { paddingHorizontal: 16 },
	bold: { fontWeight: 'bold' },
	accounts: { paddingBottom: 8 },
	accountBar: {
		minHeight: 48,
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 12,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	accountStatus: { flex: 1, textAlign: 'right' },
	profile: {
		paddingVertical: 16,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 16,
		minHeight: 104,
	},
	profileText: { flex: 1, gap: 6 },
	avatarWrapper: {
		width: 64,
		height: 64,
		alignItems: 'center',
		justifyContent: 'center',
	},
	avatar: { width: 64, height: 64, borderRadius: 32 },
	avatarFrame: { position: 'absolute', width: 86, height: 86 },
})
