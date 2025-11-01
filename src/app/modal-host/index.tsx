import { useModalStore } from '@/hooks/stores/useModalStore'
import { usePreventRemove } from '@react-navigation/native'
import { useNavigation, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Keyboard, StyleSheet, View } from 'react-native'
import { useShallow } from 'zustand/shallow'
import AnimatedModalOverlay from './common/AnimatedModalOverlay'
import { modalRegistry } from './ModalRegistry'

export default function ModalHost() {
	const { modals } = useModalStore(
		useShallow((state) => ({
			modals: state.modals,
		})),
	)
	const closeTop = useModalStore((s) => s.closeTop)
	const eventEmitter = useModalStore((s) => s.eventEmitter)
	const [canUnmountHost, setCanUnmountHost] = useState(modals.length === 0)
	const router = useRouter()
	const navigation = useNavigation()

	usePreventRemove(modals.length > 0, () => {
		if (modals[modals.length - 1].options?.dismissible === false) {
			return
		}
		closeTop()
	})

	useEffect(() => {
		if (modals.length === 0) return
		setCanUnmountHost(false)
	}, [modals])

	useEffect(() => {
		const closeAction = () => {
			if (navigation.canGoBack()) {
				setCanUnmountHost(true)
				router.back()
				// 确保在 ModalHost 关闭后再执行回调，避免其他导航操作与 ModalHost 关闭发生竞态
				setImmediate(() => {
					eventEmitter.emit('modalHostDidClose')
				})
			}
		}
		if (modals.length === 0) {
			Keyboard.dismiss()
			closeAction()
		}
	}, [eventEmitter, modals, navigation, router])

	if (canUnmountHost) return null

	return (
		<View
			style={StyleSheet.absoluteFill}
			pointerEvents='box-none'
		>
			{modals.map((m, idx) => {
				const Component = modalRegistry[m.key]
				if (!Component) return null
				const zIndex = 1000 + idx * 100
				return (
					<AnimatedModalOverlay
						key={m.key}
						visible
						onDismiss={() => {
							if (
								m.options?.dismissible === undefined ||
								m.options?.dismissible
							) {
								useModalStore.getState().close(m.key)
							}
						}}
						contentStyle={{ zIndex }}
					>
						{/*
            // @ts-expect-error -- 懒得管了*/}
						<Component {...m.props} />
					</AnimatedModalOverlay>
				)
			})}
		</View>
	)
}
