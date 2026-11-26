import { BUILTIN_EQ_PRESETS, type EqualizerPreset } from '@bbplayer/orpheus'
import { useCallback, useMemo } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Chip, Text, useTheme } from 'react-native-paper'

import Button from '@/components/common/Button'
import { useModalStore } from '@/hooks/stores/useModalStore'

export interface EqPresetBarProps {
	activePresetId: string | null
	customPresets: readonly EqualizerPreset[]
	enabled: boolean
	onDelete: (id: string) => void
	onOverwrite: (id: string) => void
	onRename: (id: string, name: string) => void
	onSaveAs: (name: string) => void
	onSelect: (preset: EqualizerPreset) => void
}

export default function EqPresetBar({
	activePresetId,
	customPresets,
	enabled,
	onDelete,
	onOverwrite,
	onRename,
	onSaveAs,
	onSelect,
}: EqPresetBarProps) {
	const { colors } = useTheme()

	const activeCustomPreset = useMemo(
		() => customPresets.find((preset) => preset.id === activePresetId) ?? null,
		[activePresetId, customPresets],
	)

	const openSaveDialog = useCallback(() => {
		useModalStore.getState().open('EqPresetName', {
			mode: 'create',
			initialName: `自定义${customPresets.length + 1}`,
			onConfirm: onSaveAs,
		})
	}, [customPresets.length, onSaveAs])

	const openRenameDialog = useCallback(
		(preset: EqualizerPreset) => {
			useModalStore.getState().open('EqPresetName', {
				mode: 'rename',
				initialName: preset.name,
				onConfirm: (name) => onRename(preset.id, name),
			})
		},
		[onRename],
	)

	const confirmDelete = useCallback(
		(preset: EqualizerPreset) => {
			useModalStore.getState().open('Alert', {
				title: '删除预设',
				message: `确定删除「${preset.name}」吗？删除后无法恢复。`,
				buttons: [
					{ text: '取消' },
					{ text: '删除', onPress: () => onDelete(preset.id) },
				],
			})
		},
		[onDelete],
	)

	return (
		<View style={styles.container}>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.chips}
			>
				{BUILTIN_EQ_PRESETS.map((preset) => (
					<Chip
						key={preset.id}
						compact
						selected={preset.id === activePresetId}
						showSelectedCheck
						testID={`eq-preset-${preset.id}`}
						onPress={() => onSelect(preset)}
					>
						{preset.name}
					</Chip>
				))}
				{customPresets.map((preset) => (
					<Chip
						key={preset.id}
						compact
						icon='tune-variant'
						selected={preset.id === activePresetId}
						showSelectedCheck={false}
						testID={`eq-preset-${preset.id}`}
						onPress={() => onSelect(preset)}
						onLongPress={() => openRenameDialog(preset)}
					>
						{preset.name}
					</Chip>
				))}
				<Chip
					icon='plus'
					compact
					testID='eq-save-preset-button'
					onPress={openSaveDialog}
				>
					另存为
				</Chip>
			</ScrollView>
			{activeCustomPreset ? (
				<View style={styles.actions}>
					<Text
						variant='labelMedium'
						style={[styles.actionsTitle, { color: colors.onSurfaceVariant }]}
					>
						自定义预设「{activeCustomPreset.name}」
					</Text>
					<Button
						mode='text'
						compact
						testID='eq-overwrite-preset-button'
						onPress={() => onOverwrite(activeCustomPreset.id)}
					>
						覆盖
					</Button>
					<Button
						mode='text'
						compact
						testID='eq-rename-preset-button'
						onPress={() => openRenameDialog(activeCustomPreset)}
					>
						重命名
					</Button>
					<Button
						mode='text'
						compact
						testID='eq-delete-preset-button'
						onPress={() => confirmDelete(activeCustomPreset)}
					>
						删除
					</Button>
				</View>
			) : null}
			{!enabled ? (
				<Text
					variant='bodySmall'
					style={[styles.hint, { color: colors.onSurfaceVariant }]}
				>
					均衡器已关闭，选择预设后开启即可生效。
				</Text>
			) : null}
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		gap: 8,
	},
	chips: {
		gap: 8,
		paddingVertical: 2,
	},
	actions: {
		alignItems: 'center',
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 4,
	},
	actionsTitle: {
		marginEnd: 4,
	},
	hint: {
		opacity: 0.9,
	},
})
