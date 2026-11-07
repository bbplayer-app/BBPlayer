import {
	MenuView as ExpoMenuView,
	type MenuComponentProps,
	type MenuComponentRef,
} from '@expo/ui/community/menu'
import {
	cloneElement,
	isValidElement,
	useImperativeHandle,
	useState,
	type Ref,
} from 'react'

export type {
	MenuAction,
	MenuAttributes,
	MenuComponentProps,
	MenuComponentRef,
	MenuState,
	NativeActionEvent,
} from '@expo/ui/community/menu'

/**
 * `@expo/ui` 的 MenuView 在 Android 上用一个不可聚焦的 Pressable 包住触发按钮来打开菜单，
 * 遥控器 / 键盘选中按钮后按确认键时，按下的是按钮本身，菜单打不开。
 *
 * 这里让没有自己 onPress 的触发按钮负责打开菜单。触摸时外层 Pressable 也可能同时打开，
 * MenuView 对重复打开做了去重。
 */
export function MenuView({
	ref,
	children,
	...props
}: MenuComponentProps & { ref?: Ref<MenuComponentRef> }) {
	const [menu, setMenu] = useState<MenuComponentRef | null>(null)
	useImperativeHandle(ref, () => ({ show: () => menu?.show() }), [menu])

	const trigger =
		!props.shouldOpenOnLongPress &&
		isValidElement<{ onPress?: unknown }>(children) &&
		children.props.onPress === undefined
			? cloneElement(children, { onPress: () => menu?.show() })
			: children

	return (
		<ExpoMenuView
			ref={setMenu}
			{...props}
		>
			{trigger}
		</ExpoMenuView>
	)
}

export default MenuView
