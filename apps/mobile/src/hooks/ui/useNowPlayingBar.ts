import { useFocusEffect } from 'expo-router'
import { useCallback } from 'react'

import { useBottomTabBarHeight } from '@/hooks/router/useBottomTabBarHeight'
import { nowPlayingBarStore$ } from '@/hooks/stores/nowPlayingBarStore'

/** 只有聚焦页面能提供播放条配置；异步取色也随焦点更新。 */
export function useNowPlayingBar(backgroundColor?: string) {
	const bottomTabBarHeight = useBottomTabBarHeight()

	useFocusEffect(
		useCallback(() => {
			const owner = Symbol('now-playing-bar-page')
			nowPlayingBarStore$.assign({
				owner,
				backgroundColor,
				bottomTabBarHeight,
				retainedBottomTabBarHeight: bottomTabBarHeight,
			})
			return () => {
				// 避免旧页面延迟失焦时清掉新页面已经发布的配置。
				if (nowPlayingBarStore$.owner.peek() === owner) {
					nowPlayingBarStore$.assign({
						owner: null,
						backgroundColor: undefined,
						bottomTabBarHeight: 0,
					})
				}
			}
		}, [backgroundColor, bottomTabBarHeight]),
	)
}
