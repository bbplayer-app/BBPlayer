import { useCallback, useRef, useState } from 'react'
import { StyleSheet } from 'react-native'
import { Dialog, Text, TextInput, useTheme } from 'react-native-paper'

import Button from '@/components/common/Button'
import { useModalStore } from '@/hooks/stores/useModalStore'
import type { ModalPropsMap } from '@/types/navigation'
import { toastAndLogError } from '@/utils/error-handling'

export const MAX_PRESET_NAME_LENGTH = 24

export default function EqPresetNameModal({
	mode,
	initialName,
	onConfirm,
}: ModalPropsMap['EqPresetName']) {
	const { colors } = useTheme()

	const close = useModalStore((state) => state.close)

	const [name, setName] = useState(initialName ?? '')

	const [submitting, setSubmitting] = useState(false)

	const submittingRef = useRef(false)

	const isEmpty = name.trim().length === 0

	const handleDismiss = useCallback(() => {
		if (submittingRef.current) return

		close('EqPresetName')
	}, [close])

	const handleConfirm = useCallback(() => {
		if (submittingRef.current) return

		const trimmedName = name.trim()

		if (!trimmedName) return

		submittingRef.current = true

		setSubmitting(true)

		void (async () => {
			try {
				await onConfirm(trimmedName)
			} catch (error) {
				submittingRef.current = false

				setSubmitting(false)

				toastAndLogError('保存预设名称失败', error, 'Modal.EqPresetName')

				return
			}

			close('EqPresetName')
		})()
	}, [close, name, onConfirm])

	return (
		<>
			<Dialog.Title>
				{mode === 'rename' ? '重命名预设' : '另存为自定义预设'}
			</Dialog.Title>
			<Dialog.Content style={styles.content}>
				<TextInput
					mode='outlined'
					label='预设名称'
					value={name}
					maxLength={MAX_PRESET_NAME_LENGTH}
					autoFocus
					error={isEmpty}
					editable={!submitting}
					testID='eq-preset-name-input'
					onChangeText={setName}
					onSubmitEditing={handleConfirm}
				/>
				<Text
					variant='bodySmall'
					style={[
						styles.hint,
						{ color: isEmpty ? colors.error : colors.onSurfaceVariant },
					]}
				>
					{isEmpty
						? '预设名称不能为空'
						: `最多 ${MAX_PRESET_NAME_LENGTH} 个字符`}
				</Text>
			</Dialog.Content>
			<Dialog.Actions>
				<Button
					mode='text'
					disabled={submitting}
					testID='eq-preset-name-cancel'
					onPress={handleDismiss}
				>
					取消
				</Button>
				<Button
					mode='text'
					loading={submitting}
					disabled={isEmpty || submitting}
					testID='eq-preset-name-confirm'
					onPress={handleConfirm}
				>
					保存
				</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		gap: 8,
	},
	hint: {
		opacity: 0.9,
	},
})
