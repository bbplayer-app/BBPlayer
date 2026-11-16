import {
	MenuView as ExpoMenuView,
	type MenuComponentProps,
	type MenuComponentRef,
} from '@expo/ui/community/menu'
import {
	cloneElement,
	isValidElement,
	useEffect,
	useImperativeHandle,
	useState,
	type Ref,
} from 'react'
import { Platform, Pressable, View } from 'react-native'

import TvMenuView from './TvMenuView'

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
 *
 * MenuView 即使没打开也会创建 Compose 宿主并渲染全部菜单项，首次挂载很重（冷启动时单个菜单
 * 可达数十毫秒），列表里每一行都有一个时更明显。所以第一次请求打开之前只渲染触发按钮，
 * 请求打开时才挂载 MenuView，等拿到它的 ref 后再打开；挂载后不再卸载。
 */
function NativeMenuView({
	ref,
	children,
	...props
}: MenuComponentProps & { ref?: Ref<MenuComponentRef> }) {
	const [menu, setMenu] = useState<MenuComponentRef | null>(null)
	const [mounted, setMounted] = useState(false)

	const show = () => {
		if (menu) {
			menu.show()

			return
		}

		setMounted(true)
	}

	// 只有请求打开时才会挂载 MenuView，所以第一次拿到 ref 就是要打开菜单
	useEffect(() => {
		menu?.show()
	}, [menu])

	useImperativeHandle(ref, () => ({ show }))

	const triggerOpensMenu =
		!props.shouldOpenOnLongPress &&
		isValidElement<{ onPress?: unknown }>(children) &&
		children.props.onPress === undefined

	const trigger = triggerOpensMenu
		? cloneElement(children, { onPress: show })
		: children

	if (!mounted) {
		return (
			<View
				style={props.style}
				testID={props.testID}
			>
				{triggerOpensMenu ? (
					trigger
				) : (
					// 与 MenuView 内部包住触发按钮的 Pressable 保持一致
					<Pressable
						onPress={props.shouldOpenOnLongPress ? undefined : show}
						onLongPress={props.shouldOpenOnLongPress ? show : undefined}
						android_disableSound
						focusable={false}
						accessible={false}
					>
						{trigger}
					</Pressable>
				)}
			</View>
		)
	}

	return (
		<ExpoMenuView
			ref={setMenu}
			{...props}
		>
			{trigger}
		</ExpoMenuView>
	)
}

export function MenuView(
	props: MenuComponentProps & { ref?: Ref<MenuComponentRef> },
) {
	return Platform.OS === 'android' && Platform.isTV ? (
		<TvMenuView {...props} />
	) : (
		<NativeMenuView {...props} />
	)
}

export default MenuView
