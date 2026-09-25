import { observable } from '@legendapp/state'

export interface NowPlayingBarPageState {
	playerScreenActive: boolean
	owner: symbol | null
	backgroundColor: string | undefined
	bottomTabBarHeight: number
	/** Modal 打开后仍用于维持其底层 Tab 页的播放条位置。 */
	retainedBottomTabBarHeight: number
	/** 当前焦点页面的路由根段；Modal 打开时保持为其底层页面的根段。 */
	underlyingSegmentRoot: string | null
}

// 页面展示状态只在当前运行期间有效，不持久化。
export const nowPlayingBarStore$ = observable<NowPlayingBarPageState>({
	playerScreenActive: false,
	owner: null,
	backgroundColor: undefined,
	bottomTabBarHeight: 0,
	retainedBottomTabBarHeight: 0,
	underlyingSegmentRoot: null,
})
