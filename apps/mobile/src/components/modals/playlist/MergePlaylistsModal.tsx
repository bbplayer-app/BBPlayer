import {
	Host,
	OutlinedTextField,
	Text as ComposeText,
} from '@expo/ui/jetpack-compose'
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers'
import { FlashList } from '@shopify/flash-list'
import { memo, useCallback, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Dialog, Text, TouchableRipple } from 'react-native-paper'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import Button from '@/components/common/Button'
import UniversalCheckbox from '@/components/common/UniversalCheckbox'
import { useMergePlaylists } from '@/hooks/mutations/db/playlist'
import { usePlaylistLists } from '@/hooks/queries/db/playlist'
import { useModalStore } from '@/hooks/stores/useModalStore'
import useTextFieldState from '@/hooks/useTextFieldState'
import type { Playlist } from '@/types/core/media'
import type { ListRenderItemInfoWithExtraData } from '@/types/flashlist'

const SelectablePlaylistItem = memo(function SelectablePlaylistItem({
	item,
	isSelected,
	onToggle,
}: {
	item: Playlist
	isSelected: boolean
	onToggle: (id: number) => void
}) {
	return (
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
				<UniversalCheckbox
					status={isSelected ? 'checked' : 'unchecked'}
					onPress={() => onToggle(item.id)}
				/>
			</View>
		</TouchableRipple>
	)
})

type RenderExtraData = {
	selectedIds: Set<number>
	onToggle: (id: number) => void
}

const renderPlaylistItem = ({
	item,
	extraData,
}: ListRenderItemInfoWithExtraData<Playlist, RenderExtraData>) => {
	if (!extraData) return null
	return (
		<SelectablePlaylistItem
			item={item}
			isSelected={extraData.selectedIds.has(item.id)}
			onToggle={extraData.onToggle}
		/>
	)
}

export default function MergePlaylistsModal() {
	const close = useModalStore((state) => state.close)
	const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set())
	const [newTitle, setNewTitle] = useState('')
	const newTitleState = useTextFieldState(newTitle)

	const { data: playlists, isPending, isError } = usePlaylistLists()
	const { mutateAsync: mergePlaylists, isPending: isMerging } =
		useMergePlaylists()
	const availablePlaylists = useMemo(
		() => playlists?.filter((playlist) => playlist.type !== 'dynamic') ?? [],
		[playlists],
	)

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
		if (selectedIds.size < 2) return
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

	const extraData = useMemo(
		() => ({ selectedIds, onToggle: toggleSelection }),
		[selectedIds, toggleSelection],
	)

	return (
		<>
			<Dialog.Title>动态合并歌单</Dialog.Title>
			<Dialog.Content style={styles.content}>
				{isPending ? (
					<View style={styles.center}>
						<ActivityIndicator size='large' />
					</View>
				) : isError ? (
					<View style={styles.center}>
						<Text style={{ opacity: 0.7 }}>加载本地歌单失败</Text>
					</View>
				) : availablePlaylists.length === 0 ? (
					<View style={styles.center}>
						<Text style={{ opacity: 0.7 }}>没有本地歌单</Text>
					</View>
				) : (
					<View style={{ flex: 1 }}>
						<Host
							matchContents={{ vertical: true }}
							style={styles.input}
						>
							<OutlinedTextField
								value={newTitleState}
								onValueChange={setNewTitle}
								singleLine
								modifiers={[fillMaxWidth()]}
							>
								<OutlinedTextField.Label>
									<ComposeText>新歌单名称</ComposeText>
								</OutlinedTextField.Label>
							</OutlinedTextField>
						</Host>
						<Text
							variant='labelMedium'
							style={styles.subtitle}
						>
							选择至少两个源歌单（显示时动态合并并自动去重）：
						</Text>
						<View style={styles.listContainer}>
							<FlashList
								data={availablePlaylists}
								renderItem={renderPlaylistItem}
								extraData={extraData}
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
					disabled={isMerging || selectedIds.size < 2 || newTitle.trim() === ''}
					loading={isMerging}
				>
					创建
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
