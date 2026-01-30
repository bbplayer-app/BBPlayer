import type { ListRenderItemInfo } from '@shopify/flash-list'

export type ListRenderItemInfoWithExtraData<TItem, TExtraData> = Omit<
	ListRenderItemInfo<TItem>,
	'extraData'
> & {
	extraData?: TExtraData
}

/**
 * 播放列表页面的多选状态管理
 */
export interface SelectionState {
	/**
	 * 是否处于多选模式
	 */
	active: boolean
	/**
	 * 已选中的项目ID
	 */
	selected: Set<number>
	/**
	 * 切换项目的选中状态
	 */
	toggle: (id: number) => void
	/**
	 * 进入多选模式
	 */
	enter: (id: number) => void
}
