import { FlashList } from '@shopify/flash-list'
import { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import {
	ActivityIndicator,
	Checkbox,
	Dialog,
	Text,
	TextInput,
	TouchableRipple,
} from 'react-native-paper'

import Button from '@/components/common/Button'
import { useMergePlaylists } from '@/hooks/mutations/db/playlist'
import { usePlaylistLists } from '@/hooks/queries/db/playlist'
import { useModalStore } from '@/hooks/stores/useModalStore'
import type { Playlist } from '@/types/core/media'

const LocalPlaylistItem = ({
	item,
	isSelected,
	onToggle,
}: {
	item: Playlist
	isSelected: boolean
	onToggle: (id: number) => void
}) => (
	<TouchableRipple onPress={() => onToggle(item.id)}>
		<View style={styles.itemContainer}>
			<View style={{ flex: 1 }}>
				<Text
					variant='bodyLarge'
					numberOfLines={1}
				>
					{item.title}
				</Text>
				<Text
					variant='bodySmall'
					style={{ opacity: 0.7 }}
				>
					{item.itemCount} 首歌曲
				</Text>
			</View>
			<Checkbox
				status={isSelected ? 'checked' : 'unchecked'}
				onPress={() => onToggle(item.id)}
			/>
		</View>
	</TouchableRipple>
)

export default function MergePlaylistsModal() {
	const close = useModalStore((state) => state.close)
	const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set())
	const [newTitle, setNewTitle] = useState('')

	const { data: playlists, isPending, isError } = usePlaylistLists()
	const { mutateAsync: mergePlaylists, isPending: isMerging } =
		useMergePlaylists()

	const toggleSelection = useCallback((id: number) => {
		setSelectedIds((prev) => {
			const next = new Set(prev)
			if (next.has(id)) {
				next.delete(id)
			} else {
				next.add(id)
			}
			return next
		})
	}, [])

	const handleConfirm = async () => {
		if (selectedIds.size === 0) return
		if (!newTitle.trim()) return

		try {
			await mergePlaylists({
				sourcePlaylistIds: Array.from(selectedIds),
				title: newTitle.trim(),
			})
			close('MergePlaylists')
		} catch {
			// error handled in mutation
		}
	}

	const renderItem = useCallback(
		({ item }: { item: Playlist }) => (
			<LocalPlaylistItem
				item={item}
				isSelected={selectedIds.has(item.id)}
				onToggle={toggleSelection}
			/>
		),
		[selectedIds, toggleSelection],
	)

	return (
		<>
			<Dialog.Title>合并歌单</Dialog.Title>
			<Dialog.Content style={styles.content}>
				{isPending ? (
					<View style={styles.center}>
						<ActivityIndicator size='large' />
					</View>
				) : isError ? (
					<View style={styles.center}>
						<Text style={{ opacity: 0.7 }}>加载本地歌单失败</Text>
					</View>
				) : !playlists || playlists.length === 0 ? (
					<View style={styles.center}>
						<Text style={{ opacity: 0.7 }}>没有本地歌单</Text>
					</View>
				) : (
					<View style={{ flex: 1 }}>
						<TextInput
							label='新歌单名称'
							value={newTitle}
							onChangeText={setNewTitle}
							mode='outlined'
							style={styles.input}
						/>
						<Text
							variant='labelMedium'
							style={styles.subtitle}
						>
							选择要合并的歌单（将自动去重）：
						</Text>
						<View style={styles.listContainer}>
							<FlashList
								data={playlists}
								renderItem={renderItem}
								keyExtractor={(item) => item.id.toString()}
								showsVerticalScrollIndicator={false}
							/>
						</View>
					</View>
				)}
			</Dialog.Content>
			<Dialog.Actions>
				<Button
					onPress={() => close('MergePlaylists')}
					disabled={isMerging}
				>
					取消
				</Button>
				<Button
					mode='contained'
					onPress={handleConfirm}
					disabled={
						isMerging || selectedIds.size === 0 || newTitle.trim() === ''
					}
					loading={isMerging}
				>
					合并
				</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		height: 400,
		paddingHorizontal: 0,
	},
	center: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	itemContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 24,
		paddingVertical: 12,
	},
	input: {
		marginHorizontal: 24,
		marginBottom: 16,
	},
	subtitle: {
		marginHorizontal: 24,
		marginBottom: 8,
		opacity: 0.7,
	},
	listContainer: {
		flex: 1,
	},
})
