import { useNavigation } from 'expo-router'
import type { NativeStackNavigationProp } from 'expo-router/build/react-navigation/native-stack'
import type { ParamListBase } from 'expo-router/react-navigation'
import { useLayoutEffect, useState } from 'react'
import { Platform } from 'react-native'

/** 首次进入完成后保持就绪，返回已有页面不会卸载列表、丢失滚动位置。 */
export function useScreenTransitionReady() {
	const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
	const [ready, setReady] = useState(
		() => Platform.OS === 'web' || navigation.getState().index === 0,
	)

	// 在页面顶层调用：即使数据还在加载，也不能错过原生 onAppear。
	useLayoutEffect(() => {
		if (ready) return
		return navigation.addListener('transitionEnd', ({ data }) => {
			if (!data.closing && navigation.isFocused()) setReady(true)
		})
	}, [navigation, ready])

	return ready
}
