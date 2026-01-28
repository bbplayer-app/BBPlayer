import * as React from 'react'
import { BottomTabBarHeightContext } from 'react-native-bottom-tabs'

export function useBottomTabBarHeight() {
	const height = React.useContext(BottomTabBarHeightContext)

	if (height === undefined) {
		// 说明这个页面并不是 tabs 页面，直接返回 0 就可以
		return 0
	}

	return height
}
