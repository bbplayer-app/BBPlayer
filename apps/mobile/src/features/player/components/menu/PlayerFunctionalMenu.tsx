import { Computed } from '@legendapp/state/react'
import { TrueSheet } from '@lodev09/react-native-true-sheet'
import { useCallback, useEffect, useRef } from 'react'
import { ScrollView } from 'react-native'
import { useTheme } from 'react-native-paper'

import { playbackContextStore$ } from '@/hooks/stores/playbackContextStore'

import { MusicFunctionalMenu } from './MusicFunctionalMenu'
import { PodcastFunctionalMenu } from './PodcastFunctionalMenu'

export function PlayerFunctionalMenu({
	menuVisible,
	setMenuVisible,
}: {
	menuVisible: boolean
	setMenuVisible: (visible: boolean) => void
}) {
	const { colors } = useTheme()
	const sheetRef = useRef<TrueSheet>(null)
	const isPresented = useRef(false)
	const pendingAction = useRef<(() => void) | null>(null)

	useEffect(() => {
		if (menuVisible) {
			sheetRef.current?.present().catch(() => {
				// Ignore error
			})
		} else {
			if (isPresented.current) {
				sheetRef.current?.dismiss().catch(() => {
					// Ignore error
				})
			}
		}
	}, [menuVisible])

	const onDismiss = useCallback(() => {
		isPresented.current = false
		setMenuVisible(false)
		const action = pendingAction.current
		pendingAction.current = null
		action?.()
	}, [setMenuVisible])

	const onPresent = useCallback(() => {
		isPresented.current = true
		if (!menuVisible) {
			sheetRef.current?.dismiss().catch(() => {
				// Ignore error
			})
		}
	}, [menuVisible])

	const handleAction = useCallback(
		(action: () => void) => {
			pendingAction.current = action
			setMenuVisible(false)
		},
		[setMenuVisible],
	)

	return (
		<TrueSheet
			ref={sheetRef}
			detents={[0.6]}
			cornerRadius={24}
			backgroundColor={colors.elevation.level1}
			onDidDismiss={onDismiss}
			onDidPresent={onPresent}
			scrollable
		>
			<ScrollView
				style={{ marginTop: 32 }}
				// contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
			>
				<Computed>
					{playbackContextStore$.context.mode.get() === 'podcast' ? (
						<PodcastFunctionalMenu onAction={handleAction} />
					) : (
						<MusicFunctionalMenu onAction={handleAction} />
					)}
				</Computed>
			</ScrollView>
		</TrueSheet>
	)
}
