import type { TrueSheet } from '@lodev09/react-native-true-sheet'
import { TrueSheet as TrueSheetComponent } from '@lodev09/react-native-true-sheet'
import { forwardRef, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native'
import { Avatar, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useSharedPlaylistAllMembers } from '@/hooks/queries/sharedPlaylistAllMembers'
import { formatRelativeTime } from '@/utils/time'

interface Props {
	shareId?: string | null
}

export const SharedPlaylistMembersSheet = forwardRef<TrueSheet, Props>(
	function SharedPlaylistMembersSheet({ shareId }, ref) {
		const [isOpen, setIsOpen] = useState(false)
		const {
			data: members,
			isPending,
			isError,
		} = useSharedPlaylistAllMembers(isOpen ? shareId : null)
		const theme = useTheme()
		const insets = useSafeAreaInsets()

		return (
			<TrueSheetComponent
				ref={ref}
				detents={[0.5]}
				cornerRadius={24}
				backgroundColor={theme.colors.elevation.level1}
				onDidPresent={() => setIsOpen(true)}
				onDidDismiss={() => setIsOpen(false)}
				scrollable
			>
				<View style={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
					<Text
						variant='titleLarge'
						style={styles.title}
					>
						协作者 {members ? `(${members.length})` : ''}
					</Text>

					{isPending ? (
						<View style={styles.center}>
							<ActivityIndicator size='large' />
						</View>
					) : isError || !members ? (
						<View style={styles.center}>
							<Text>加载失败</Text>
						</View>
					) : (
						<ScrollView
							style={styles.listContent}
							nestedScrollEnabled
						>
							{members.map((item) => (
								<View
									key={item.mid}
									style={styles.memberRow}
								>
									{item.avatarUrl ? (
										<Avatar.Image
											size={40}
											source={{ uri: item.avatarUrl }}
										/>
									) : (
										<Avatar.Text
											size={40}
											label={item.name.slice(0, 1)}
										/>
									)}
									<View style={styles.memberInfo}>
										<Text
											variant='bodyLarge'
											style={styles.memberName}
										>
											{item.name}
										</Text>
										<Text
											variant='bodySmall'
											style={{ color: theme.colors.onSurfaceVariant }}
										>
											{item.role === 'owner'
												? '所有者'
												: item.role === 'editor'
													? '编辑者'
													: '订阅者'}
											{' • '}
											{formatRelativeTime(item.joinedAt)}加入
										</Text>
									</View>
								</View>
							))}
						</ScrollView>
					)}
				</View>
			</TrueSheetComponent>
		)
	},
)

const styles = StyleSheet.create({
	container: {
		maxHeight: '80%',
		marginTop: 24,
	},
	center: {
		padding: 40,
		alignItems: 'center',
		justifyContent: 'center',
	},
	title: {
		fontWeight: 'bold',
		paddingHorizontal: 20,
		paddingBottom: 16,
	},
	listContent: {
		paddingHorizontal: 20,
	},
	memberRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 10,
	},
	memberInfo: {
		marginLeft: 12,
		flex: 1,
		justifyContent: 'center',
	},
	memberName: {
		fontWeight: '600',
		marginBottom: 2,
	},
})
