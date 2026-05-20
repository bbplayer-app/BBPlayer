import { Icon } from '@expo/ui'
import {
	MenuView,
	type MenuAction,
	type NativeActionEvent,
} from '@expo/ui/community/menu'
import {
	Children,
	isValidElement,
	memo,
	type PropsWithChildren,
	type ReactElement,
	type ReactNode,
	useCallback,
	useMemo,
} from 'react'
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native'

import * as Haptics from '@/utils/haptics'

type FunctionalMenuItemProps = {
	title?: string
	label?: string
	leadingIcon?: ReturnType<typeof Icon.select>
	onPress?: () => void
	disabled?: boolean
	status?: 'checked' | 'unchecked' | 'indeterminate'
	state?: 'on' | 'off'
	destructive?: boolean
	titleStyle?: StyleProp<TextStyle>
}

type FunctionalMenuProps = PropsWithChildren<{
	anchor: ReactNode
	visible?: boolean
	onDismiss?: () => void
	title?: string
	anchorPosition?: 'top' | 'bottom'
	statusBarHeight?: number
}>

type FunctionalMenuAction = MenuAction & {
	onPress?: () => void
}

function FunctionalMenuItem(_props: FunctionalMenuItemProps) {
	return null
}

function toAction(
	child: ReactElement<FunctionalMenuItemProps>,
	index: number,
): FunctionalMenuAction | null {
	const title = child.props.title ?? child.props.label
	if (!title) return null
	const titleColor = StyleSheet.flatten(child.props.titleStyle)?.color

	return {
		id: String(index),
		title,
		titleColor,
		image: child.props.leadingIcon,
		attributes: {
			disabled: child.props.disabled,
			destructive: child.props.destructive,
		},
		state:
			child.props.state ??
			(child.props.status
				? child.props.status === 'checked'
					? 'on'
					: 'off'
				: undefined),
		onPress: child.props.onPress,
	}
}

const FunctionalMenuComponent = memo(function FunctionalMenu({
	anchor,
	children,
	onDismiss,
	title,
}: FunctionalMenuProps) {
	const actions = useMemo(
		() =>
			Children.toArray(children)
				.filter(isValidElement)
				.map((child, index) =>
					toAction(child as ReactElement<FunctionalMenuItemProps>, index),
				)
				.filter((action): action is FunctionalMenuAction => action !== null),
		[children],
	)

	const menuActions = useMemo(
		() => actions.map(({ onPress, ...action }) => action),
		[actions],
	)

	const handlePressAction = useCallback(
		(event: NativeActionEvent) => {
			actions
				.find((action) => action.id === event.nativeEvent.event)
				?.onPress?.()
		},
		[actions],
	)

	const handleOpenMenu = useCallback(() => {
		void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
	}, [])

	return (
		<MenuView
			actions={menuActions}
			onCloseMenu={onDismiss}
			onOpenMenu={handleOpenMenu}
			onPressAction={handlePressAction}
			title={title}
		>
			{anchor}
		</MenuView>
	)
})

const FunctionalMenu = Object.assign(FunctionalMenuComponent, {
	Item: FunctionalMenuItem,
})

export default FunctionalMenu
