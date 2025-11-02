import type { ListRenderItemInfo } from '@shopify/flash-list'

export type ListRenderItemInfoWithExtraData<TItem, TExtraData> = Omit<
	ListRenderItemInfo<TItem>,
	'extraData'
> & {
	extraData?: TExtraData
}
