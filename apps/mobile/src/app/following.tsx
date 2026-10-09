import { FlashList } from '@shopify/flash-list'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { Appbar, Chip, Searchbar, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import Button from '@/components/common/Button'
import { FollowingGroupsSkeleton } from '@/features/following/components/FollowingGroupsSkeleton'
import { FollowingListItem } from '@/features/following/components/FollowingListItem'
import { FollowingListSkeleton } from '@/features/following/components/FollowingListSkeleton'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import {
	useBilibiliRelationAccount,
	useFollowingGroups,
	useInfiniteFollowings,
} from '@/hooks/queries/bilibili/relations'
import { useScreenTransitionReady } from '@/hooks/router/useScreenTransitionReady'
import useAppStore from '@/hooks/stores/useAppStore'
import { useNowPlayingBar } from '@/hooks/ui/useNowPlayingBar'
import { useDebouncedValue } from '@/hooks/utils/useDebouncedValue'

export default function FollowingPage() {
	const isListReady = useScreenTransitionReady()
	useNowPlayingBar()
	const router = useRouter()
	const { colors } = useTheme()
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()
	const hasCookie = useAppStore((state) => state.hasBilibiliCookie())
	const [refreshing, setRefreshing] = useState(false)
	const [searchQuery, setSearchQuery] = useState('')
	const keyword = useDebouncedValue(searchQuery.trim())
	const isSearchPending = searchQuery.trim() !== keyword
	const isSearching = searchQuery.trim().length > 0 || keyword.length > 0
	const [selectedTagId, setSelectedTagId] = useState(-20)
	const groups = useFollowingGroups()
	const selectedGroup = groups.data?.find(
		(group) => group.tagid === selectedTagId,
	)
	const tagId = keyword ? -20 : (selectedGroup?.tagid ?? -20)
	const {
		data,
		isPending,
		isError,
		error,
		refetch,
		fetchNextPage,
		hasNextPage,
		isFetching,
		isFetchingNextPage,
		isFetchNextPageError,
	} = useInfiniteFollowings(keyword, tagId, !isSearchPending)
	const account = useBilibiliRelationAccount()
	const [followingCount, setFollowingCount] = useState<{
		account: string | null
		total: number
	} | null>(null)
	// 切换分组后仍显示全部关注数量，不把分组人数当成总人数。
	useEffect(() => {
		const total = data?.pages[0].total
		if (keyword || tagId !== -20 || total === undefined) return
		setFollowingCount((previous) =>
			previous?.account === account && previous.total === total
				? previous
				: { account, total },
		)
	}, [account, data, keyword, tagId])
	const totalFollowings =
		tagId === -20 && !keyword
			? data?.pages[0].total
			: followingCount?.account === account
				? followingCount.total
				: undefined
	const refetchGroups = groups.refetch
	useFocusEffect(
		useCallback(() => {
			if (hasCookie && !isSearchPending) void refetch()
		}, [hasCookie, isSearchPending, refetch]),
	)
	useFocusEffect(
		useCallback(() => {
			if (hasCookie) void refetchGroups()
		}, [hasCookie, refetchGroups]),
	)
	const followings = useMemo(() => {
		const users = data?.pages.flatMap((page) => page.list ?? []) ?? []
		return [...new Map(users.map((user) => [user.mid, user])).values()]
	}, [data])

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header elevated>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title='我的关注' />
			</Appbar.Header>
			{hasCookie && (
				<View style={styles.filters}>
					<Searchbar
						mode='bar'
						placeholder='搜索全部关注的 UP 主'
						value={searchQuery}
						onChangeText={setSearchQuery}
						onClearIconPress={() => setSearchQuery('')}
					/>
					{!isSearching && (
						<>
							{groups.isPending ? (
								<FollowingGroupsSkeleton animate={isListReady} />
							) : (
								<ScrollView
									horizontal
									showsHorizontalScrollIndicator={false}
									contentContainerStyle={styles.groups}
								>
									<Chip
										selected={tagId === -20}
										onPress={() => setSelectedTagId(-20)}
									>
										全部关注
										{totalFollowings !== undefined
											? ` · ${totalFollowings}`
											: ''}
									</Chip>
									{groups.data
										?.filter((group) => group.tagid !== -20)
										.map((group) => (
											<Chip
												key={group.tagid}
												selected={tagId === group.tagid}
												onPress={() => setSelectedTagId(group.tagid)}
											>
												{group.name} · {group.count}
											</Chip>
										))}
								</ScrollView>
							)}
							{groups.isError && (
								<Button onPress={() => void refetchGroups()}>
									分组加载失败，重试
								</Button>
							)}
						</>
					)}
				</View>
			)}
			{!hasCookie ? (
				<View style={styles.state}>
					<Text>登录 Bilibili 账号后查看我的关注</Text>
					<Button
						mode='contained'
						onPress={() => router.navigate('/settings/bilibili-account')}
					>
						登录
					</Button>
				</View>
			) : !isListReady || isPending || isSearchPending ? (
				<FollowingListSkeleton />
			) : isError && !data ? (
				<View style={styles.state}>
					<Text>加载关注列表失败</Text>
					<Text style={styles.error}>{error.message}</Text>
					<Button onPress={() => void refetch()}>重试</Button>
				</View>
			) : (
				<FlashList
					key={`${tagId}:${keyword}`}
					data={followings}
					style={styles.list}
					maintainVisibleContentPosition={{ disabled: true }}
					keyboardShouldPersistTaps='handled'
					keyboardDismissMode='on-drag'
					keyExtractor={(item) => item.mid.toString()}
					contentContainerStyle={{
						paddingBottom: insets.bottom + (haveTrack ? 70 : 16),
					}}
					renderItem={({ item }) => <FollowingListItem user={item} />}
					ListHeaderComponent={
						isError && !isFetchNextPageError ? (
							<Button onPress={() => void refetch()}>刷新失败，点击重试</Button>
						) : null
					}
					ListEmptyComponent={
						<Text style={styles.count}>
							{keyword
								? '没有找到匹配的 UP 主'
								: tagId === -20
									? '还没有关注 UP 主'
									: '该分组暂无 UP 主'}
						</Text>
					}
					ListFooterComponent={
						isFetchingNextPage ? (
							<ActivityIndicator style={styles.count} />
						) : isFetchNextPageError ? (
							<Button onPress={() => void fetchNextPage()}>
								加载更多失败，重试
							</Button>
						) : null
					}
					onEndReachedThreshold={0.3}
					onEndReached={() => {
						if (hasNextPage && !isFetching && !isFetchNextPageError)
							void fetchNextPage()
					}}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							colors={[colors.primary]}
							onRefresh={async () => {
								setRefreshing(true)
								try {
									await Promise.all([refetch(), refetchGroups()])
								} finally {
									setRefreshing(false)
								}
							}}
						/>
					}
				/>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	list: { flex: 1 },
	filters: { paddingHorizontal: 16, gap: 4, marginTop: 8 },
	groups: { gap: 8, paddingVertical: 4 },
	state: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		gap: 16,
		padding: 24,
	},
	error: { textAlign: 'center' },
	count: { padding: 16 },
})
