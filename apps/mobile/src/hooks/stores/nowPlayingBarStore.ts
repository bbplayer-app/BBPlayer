import { observable } from '@legendapp/state'

// 这些路由根节点（含其全部子路由）不展示播放条。
export const HIDDEN_SEGMENT_ROOTS = new Set([
	'player',
	'comments',
	'onboarding',
	'settings',
	'performance',
	'test',
])

/** 由根路由名（如 `settings/general`）取首个路径段作为根段。 */
export function routeNameToSegmentRoot(routeName: string): string {
	return routeName.split('/')[0]
}

export interface NowPlayingBarPageState {
	/**
	 * 当前停留的页面是否属于不展示播放条的路由（与 player 页面语义一致）。
	 * 进入这类页面时立即隐藏；离开时等返回动画结束后再恢复显示。
	 */
	hiddenScreenActive: boolean
	owner: symbol | null
	backgroundColor: string | undefined
	bottomTabBarHeight: number
	/** Modal 打开后仍用于维持其底层 Tab 页的播放条位置。 */
	retainedBottomTabBarHeight: number
}

// 页面展示状态只在当前运行期间有效，不持久化。
export const nowPlayingBarStore$ = observable<NowPlayingBarPageState>({
	hiddenScreenActive: false,
	owner: null,
	backgroundColor: undefined,
	bottomTabBarHeight: 0,
	retainedBottomTabBarHeight: 0,
})
