import { BottomTabBarHeightContext as JsBottomTabBarHeightContext } from 'expo-router/build/react-navigation/bottom-tabs'
import * as React from 'react'
import { BottomTabBarHeightContext } from 'react-native-bottom-tabs'

export function useBottomTabBarHeight() {
	const nativeHeight = React.useContext(BottomTabBarHeightContext)
	const jsHeight = React.useContext(JsBottomTabBarHeightContext)
	const height = nativeHeight ?? jsHeight

	if (height === undefined) {
		// 说明这个页面并不是 tabs 页面，直接返回 0 就可以
		return 0
	}

	return height
}
