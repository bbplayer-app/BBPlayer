import { useRouter } from 'expo-router'
import { Suspense, useEffect, useState } from 'react'
import { ActivityIndicator, Keyboard, StyleSheet, View } from 'react-native'

import AnimatedModalOverlay from '@/components/common/AnimatedModalOverlay'
import { modalRegistry } from '@/components/ModalRegistry'
import usePreventRemove from '@/hooks/router/usePreventRemove'
import { useModalStore } from '@/hooks/stores/useModalStore'

export default function ModalHost() {
	const modals = useModalStore((state) => state.modals)
	const closeTop = useModalStore((s) => s.closeTop)
	const eventEmitter = useModalStore((s) => s.eventEmitter)
	const [canUnmountHost, setCanUnmountHost] = useState(modals.length === 0)
	const router = useRouter()

	usePreventRemove(modals.length > 0, () => {
		if (modals[modals.length - 1].options?.dismissible === false) {
			return
		}
		closeTop()
	})

	useEffect(() => {
		if (modals.length > 0) {
			setCanUnmountHost(false)
			return
		}
		Keyboard.dismiss()
		if (router.canGoBack()) {
			setCanUnmountHost(true)
			router.back()
			setImmediate(() => {
				eventEmitter.emit('modalHostDidClose')
			})
		}
	}, [eventEmitter, modals, router])

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
						<Suspense
							fallback={
								<View style={styles.loadingContainer}>
									<ActivityIndicator size='large' />
								</View>
							}
						>
							{/*
            // @ts-expect-error -- 懒得管了*/}
							<Component {...m.props} />
						</Suspense>
					</AnimatedModalOverlay>
				)
			})}
		</View>
	)
}

const styles = StyleSheet.create({
	loadingContainer: {
		width: 200,
		height: 150,
		alignSelf: 'center',
		justifyContent: 'center',
		alignItems: 'center',
	},
})
