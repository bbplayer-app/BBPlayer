import { TvFocusScope } from '@bbplayer/native'
import type {
	MenuAction,
	MenuComponentProps,
	MenuComponentRef,
} from '@expo/ui/community/menu'
import {
	cloneElement,
	isValidElement,
	useImperativeHandle,
	useState,
	type Ref,
} from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Text, useTheme } from 'react-native-paper'

export default function TvMenuView({
	ref,
	actions,
	children,
	onOpenMenu,
	onCloseMenu,
	onPressAction,
	shouldOpenOnLongPress,
	style,
	testID,
}: MenuComponentProps & { ref?: Ref<MenuComponentRef> }) {
	const theme = useTheme()
	const [path, setPath] = useState<MenuAction[][]>([])

	const open = () => {
		if (path.length > 0) return
		setPath([actions])
		onOpenMenu?.()
	}

	const dismiss = () => {
		if (path.length === 0) return
		setPath([])
		onCloseMenu?.()
	}

	useImperativeHandle(ref, () => ({ show: open }))

	const trigger = isValidElement<{
		onPress?: () => void
		onLongPress?: () => void
	}>(children)
		? cloneElement(
				children,
				shouldOpenOnLongPress
					? { onLongPress: () => open() }
					: { onPress: () => open() },
			)
		: children

	const renderActions = (items: MenuAction[]): React.ReactNode =>
		items
			.filter((action) => !action.attributes?.hidden)
			.map((action) =>
				action.displayInline && action.subactions ? (
					renderActions(action.subactions)
				) : (
					<Pressable
						key={action.id ?? action.title}
						accessibilityRole='menuitem'
						accessibilityState={{
							disabled: action.attributes?.disabled,
							selected: action.state === 'on',
						}}
						disabled={action.attributes?.disabled}
						onPress={() => {
							if (action.subactions?.length) {
								setPath([...path, action.subactions])

								return
							}

							dismiss()
							onPressAction?.({
								nativeEvent: { event: action.id ?? action.title },
							})
						}}
						style={styles.item}
						testID={`tv-menu-action-${action.id ?? action.title}`}
					>
						<Text
							style={{
								color: action.attributes?.disabled
									? theme.colors.onSurfaceDisabled
									: (action.titleColor ??
										(action.attributes?.destructive
											? theme.colors.error
											: theme.colors.onSurface)),
							}}
						>
							{action.state === 'on' ? '✓ ' : ''}
							{action.title}
							{action.subactions?.length ? ' ›' : ''}
						</Text>
					</Pressable>
				),
			)

	return (
		<View
			style={style}
			testID={testID}
		>
			{trigger}
			<Modal
				transparent
				visible={path.length > 0}
				onRequestClose={() =>
					path.length > 1 ? setPath(path.slice(0, -1)) : dismiss()
				}
			>
				<TvFocusScope style={styles.overlay}>
					<View
						style={[
							styles.menu,
							{ backgroundColor: theme.colors.elevation.level2 },
						]}
					>
						<ScrollView>{renderActions(path.at(-1) ?? [])}</ScrollView>
					</View>
				</TvFocusScope>
			</Modal>
		</View>
	)
}

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: 'rgba(0,0,0,0.5)',
	},
	menu: { width: 360, maxHeight: '80%', borderRadius: 24, padding: 12 },
	item: { padding: 16, minHeight: 48 },
})
