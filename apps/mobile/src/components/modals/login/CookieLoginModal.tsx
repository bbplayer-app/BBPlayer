import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { StyleSheet } from 'react-native'
import { Button, Dialog, Divider, Text, TextInput } from 'react-native-paper'

import { favoriteListQueryKeys } from '@/hooks/queries/bilibili/favorite'
import { userQueryKeys } from '@/hooks/queries/bilibili/user'
import useAppStore, { serializeCookieObject } from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { toastAndLogError } from '@/utils/error-handling'
import toast from '@/utils/toast'

export default function CookieLoginModal() {
	const queryClient = useQueryClient()
	const cookieObjectFromStore = useAppStore((state) => state.bilibiliCookie)
	const setBilibiliCookie = useAppStore((state) => state.setBilibiliCookie)
	const clearBilibiliCookie = useAppStore((state) => state.clearBilibiliCookie)
	const _close = useModalStore((state) => state.close)
	const close = useCallback(() => _close('CookieLogin'), [_close])

	const displayCookieString = useMemo(() => {
		if (!cookieObjectFromStore) return ''
		return serializeCookieObject(cookieObjectFromStore)
	}, [cookieObjectFromStore])

	const [inputCookie, setInputCookie] = useState(displayCookieString)
	const [isLoading, setIsLoading] = useState(false)

	const handleConfirm = async () => {
		setIsLoading(true)
		const cookie = inputCookie?.trim()
		try {
			if (!cookie) {
				clearBilibiliCookie()
				await queryClient.cancelQueries()
				queryClient.clear()
				toast.success('Cookie 已清除')
				close()
				setIsLoading(false)
				return
			}

			if (inputCookie === displayCookieString) {
				close()
				setIsLoading(false)
				return
			}

			const result = setBilibiliCookie(inputCookie)
			if (result.isErr()) {
				toast.error(result.error.message)
				setIsLoading(false)
				return
			}
			toast.success('Cookie 已更新')
			await queryClient.cancelQueries()
			await queryClient.invalidateQueries({
				queryKey: favoriteListQueryKeys.all,
			})
			await queryClient.invalidateQueries({ queryKey: userQueryKeys.all })
			close()
		} catch (error) {
			toastAndLogError('操作失败', error, 'Components.CookieLoginModal')
		}
		setIsLoading(false)
	}

	const handleDismiss = () => {
		if (isLoading) return
		close()
	}

	return (
		<>
			<Dialog.Title>设置 Bilibili Cookie</Dialog.Title>
			<Dialog.Content>
				<TextInput
					label='Cookie'
					key={displayCookieString}
					value={inputCookie}
					onChangeText={setInputCookie}
					mode='outlined'
					numberOfLines={5}
					multiline
					style={styles.cookieInput}
					textAlignVertical='top'
					testID='cookie-input'
				/>
				<Text
					variant='bodySmall'
					style={styles.cookieDescription}
				>
					请在此处粘贴您的{'\u2009Bilibili\u2009Cookie\u2009'}以使用完整
					{'\u2009BBPlayer\u2009'}功能。
				</Text>
				<Divider style={styles.divider} />
			</Dialog.Content>
			<Dialog.Actions>
				<Button onPress={handleDismiss}>取消</Button>
				<Button
					onPress={handleConfirm}
					testID='cookie-login-confirm'
				>
					确定
				</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	cookieInput: {
		maxHeight: 200,
	},
	cookieDescription: {
		marginTop: 8,
	},
	divider: {
		marginTop: 16,
		marginBottom: 16,
	},
})
