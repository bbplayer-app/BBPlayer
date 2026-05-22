import Color from 'color'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { decode } from 'he'
import { ScrollView, StyleSheet, View } from 'react-native'
import { RectButton } from 'react-native-gesture-handler'
import { Text, useTheme } from 'react-native-paper'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import { useUserSearchResults } from '@/hooks/queries/bilibili/search'
import type { BilibiliSearchUser } from '@/types/apis/bilibili'

interface SearchUserHeaderProps {
	query: string
}

const formatFansCount = (count: number): string => {
	if (count >= 10000) {
		return `${(count / 10000).toFixed(1)}万`
	}
	return String(count)
}

const sanitizeHtmlString = (str: string): string => {
	if (!str) return ''
	return decode(str.replace(/<em[^>]*>|<\/em>/g, ''))
}

export function SearchUserHeader({ query }: SearchUserHeaderProps) {
	const { colors } = useTheme()
	const router = useRouter()
	const { data, isPending, isError } = useUserSearchResults(query)

	// Curated premium mixed colors for card background based on active theme
	const singleCardBg = Color(colors.elevation.level1)
		.mix(Color(colors.primary), 0.06)
		.rgb()
		.string()

	const scrollCardBg = Color(colors.surfaceVariant).alpha(0.6).rgb().string()

	if (isPending) {
		return (
			<View style={styles.multiContainer}>
				<View style={styles.headerTitleRow}>
					<Text
						variant='titleMedium'
						style={[
							styles.sectionTitle,
							{ color: colors.onSurface, marginBottom: 0 },
						]}
					>
						相关 UP 主
					</Text>
					<ActivityIndicator
						size='small'
						style={{ marginLeft: 8 }}
					/>
				</View>
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={styles.scrollContent}
				>
					{Array.from({ length: 3 }, (_, index) => (
						<View
							key={index}
							style={[
								styles.cardWrapper,
								{
									backgroundColor: scrollCardBg,
									borderColor: Color(colors.outlineVariant)
										.alpha(0.15)
										.rgb()
										.string(),
								},
							]}
						>
							<View style={styles.cardSkeletonContent}>
								<View
									style={[
										styles.cardAvatarSkeleton,
										{
											backgroundColor: Color(colors.onSurface)
												.alpha(0.08)
												.rgb()
												.string(),
										},
									]}
								/>
								<View
									style={[
										styles.cardNameSkeleton,
										{
											backgroundColor: Color(colors.onSurface)
												.alpha(0.08)
												.rgb()
												.string(),
										},
									]}
								/>
								<View
									style={[
										styles.cardSubSkeleton,
										{
											backgroundColor: Color(colors.onSurface)
												.alpha(0.08)
												.rgb()
												.string(),
										},
									]}
								/>
							</View>
						</View>
					))}
				</ScrollView>
			</View>
		)
	}

	if (isError || !data?.result || data.result.length === 0) {
		return null
	}

	const users: BilibiliSearchUser[] = data.result

	const handleUserPress = (mid: number) => {
		router.push({
			pathname: '/playlist/remote/uploader/[mid]',
			params: { mid: String(mid) },
		})
	}

	if (users.length === 1) {
		const user = users[0]
		const avatarUrl = user.upic.startsWith('//')
			? `https:${user.upic}`
			: user.upic

		return (
			<View style={styles.singleContainer}>
				<Text
					variant='titleMedium'
					style={[styles.sectionTitle, { color: colors.onSurface }]}
				>
					相关 UP 主
				</Text>
				<View
					style={[
						styles.singleCardWrapper,
						{
							backgroundColor: singleCardBg,
							shadowColor: colors.shadow,
							borderColor: Color(colors.primary).alpha(0.12).rgb().string(),
						},
					]}
				>
					<RectButton
						onPress={() => handleUserPress(user.mid)}
						style={styles.singleCardButton}
						activeOpacity={0.08}
						rippleColor={Color(colors.primary).alpha(0.12).rgb().string()}
					>
						<View style={styles.singleRow}>
							<Image
								source={{ uri: avatarUrl }}
								style={[
									styles.singleAvatar,
									{ borderColor: colors.outlineVariant },
								]}
								contentFit='cover'
								cachePolicy='disk'
							/>
							<View style={styles.singleMeta}>
								<Text
									variant='titleMedium'
									style={[styles.singleName, { color: colors.primary }]}
									numberOfLines={1}
								>
									{sanitizeHtmlString(user.uname)}
								</Text>
								<View style={styles.badgeRow}>
									<View
										style={[
											styles.levelBadge,
											{
												backgroundColor: Color(colors.tertiary)
													.alpha(0.12)
													.rgb()
													.string(),
											},
										]}
									>
										<Text
											variant='labelSmall'
											style={{ color: colors.tertiary, fontWeight: '700' }}
										>
											LV{user.level}
										</Text>
									</View>
									<Text
										variant='bodySmall'
										style={{ color: colors.onSurfaceVariant }}
									>
										{formatFansCount(user.fans)} 粉丝 • {user.videos} 投稿
									</Text>
								</View>
							</View>
						</View>
						{user.usign ? (
							<View
								style={[
									styles.bioWrapper,
									{
										borderTopColor: Color(colors.outlineVariant)
											.alpha(0.4)
											.rgb()
											.string(),
									},
								]}
							>
								<Text
									variant='bodyMedium'
									style={[styles.singleBio, { color: colors.onSurfaceVariant }]}
									numberOfLines={2}
								>
									{sanitizeHtmlString(user.usign)}
								</Text>
							</View>
						) : null}
					</RectButton>
				</View>
				<Text
					variant='titleMedium'
					style={[styles.videoSectionTitle, { color: colors.onSurface }]}
				>
					相关视频
				</Text>
			</View>
		)
	}

	return (
		<View style={styles.multiContainer}>
			<Text
				variant='titleMedium'
				style={[styles.sectionTitle, { color: colors.onSurface }]}
			>
				相关 UP 主
			</Text>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				snapToInterval={132}
				snapToAlignment='start'
				contentContainerStyle={styles.scrollContent}
				decelerationRate='fast'
			>
				{users.map((user) => {
					const avatarUrl = user.upic.startsWith('//')
						? `https:${user.upic}`
						: user.upic

					return (
						<View
							key={user.mid}
							style={[
								styles.cardWrapper,
								{
									backgroundColor: scrollCardBg,
									borderColor: Color(colors.outlineVariant)
										.alpha(0.3)
										.rgb()
										.string(),
								},
							]}
						>
							<RectButton
								onPress={() => handleUserPress(user.mid)}
								style={styles.cardButton}
								activeOpacity={0.08}
								rippleColor={Color(colors.primary).alpha(0.1).rgb().string()}
							>
								<Image
									source={{ uri: avatarUrl }}
									style={styles.cardAvatar}
									contentFit='cover'
									cachePolicy='disk'
								/>
								<Text
									variant='labelMedium'
									style={[styles.cardName, { color: colors.onSurface }]}
									numberOfLines={1}
								>
									{sanitizeHtmlString(user.uname)}
								</Text>
								<Text
									variant='bodySmall'
									style={[styles.cardSub, { color: colors.onSurfaceVariant }]}
									numberOfLines={1}
								>
									{formatFansCount(user.fans)} 粉丝
								</Text>
							</RectButton>
						</View>
					)
				})}
			</ScrollView>
			<Text
				variant='titleMedium'
				style={[styles.videoSectionTitle, { color: colors.onSurface }]}
			>
				相关视频
			</Text>
		</View>
	)
}

const styles = StyleSheet.create({
	headerTitleRow: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 10,
	},
	cardSkeletonContent: {
		alignItems: 'center',
		paddingVertical: 16,
		paddingHorizontal: 10,
	},
	cardAvatarSkeleton: {
		width: 56,
		height: 56,
		borderRadius: 28,
		marginBottom: 8,
	},
	cardNameSkeleton: {
		width: 60,
		height: 12,
		borderRadius: 4,
		marginBottom: 6,
	},
	cardSubSkeleton: {
		width: 40,
		height: 10,
		borderRadius: 4,
	},
	singleContainer: {
		paddingVertical: 12,
	},
	multiContainer: {
		paddingVertical: 12,
	},
	sectionTitle: {
		fontWeight: 'bold',
		paddingHorizontal: 16,
		marginBottom: 10,
	},
	videoSectionTitle: {
		fontWeight: 'bold',
		paddingHorizontal: 16,
		marginTop: 18,
		marginBottom: 4,
	},
	singleCardWrapper: {
		marginHorizontal: 16,
		borderRadius: 16,
		overflow: 'hidden',
		borderWidth: 1,
		elevation: 2,
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
	},
	singleCardButton: {
		padding: 16,
	},
	singleRow: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	singleAvatar: {
		width: 60,
		height: 60,
		borderRadius: 30,
		borderWidth: 1.5,
	},
	singleMeta: {
		flex: 1,
		marginLeft: 16,
		justifyContent: 'center',
	},
	singleName: {
		fontWeight: 'bold',
		marginBottom: 4,
	},
	badgeRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	levelBadge: {
		paddingHorizontal: 6,
		paddingVertical: 1.5,
		borderRadius: 4,
	},
	bioWrapper: {
		marginTop: 12,
		paddingTop: 12,
		borderTopWidth: 1,
	},
	singleBio: {
		lineHeight: 20,
	},
	scrollContent: {
		paddingHorizontal: 16,
		gap: 12,
	},
	cardWrapper: {
		width: 120,
		borderRadius: 16,
		overflow: 'hidden',
		borderWidth: 1,
	},
	cardButton: {
		alignItems: 'center',
		paddingVertical: 16,
		paddingHorizontal: 10,
	},
	cardAvatar: {
		width: 56,
		height: 56,
		borderRadius: 28,
		marginBottom: 8,
	},
	cardName: {
		fontWeight: 'bold',
		textAlign: 'center',
		marginBottom: 2,
		width: '100%',
	},
	cardSub: {
		fontSize: 11,
		textAlign: 'center',
		width: '100%',
	},
})
