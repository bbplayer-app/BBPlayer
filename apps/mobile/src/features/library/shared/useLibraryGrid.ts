import { useResponsiveLayout } from '@/hooks/ui/useResponsiveLayout'

/** 网格卡片的外边距、内边距与条目内边距之和（水平方向）。 */
const GRID_CARD_HORIZONTAL_CHROME = 44

export function useLibraryGrid() {
	const { width, fontScale, isTablet } = useResponsiveLayout()

	const columns = isTablet
		? Math.max(
				1,
				Math.min(6, Math.floor((width - 32) / (200 * Math.max(1, fontScale)))),
			)
		: 1

	return {
		columns,
		isGrid: columns > 1,
		// 封面撑满卡片宽度，避免卡片内出现大块留白。
		coverSize: Math.floor((width - 32) / columns - GRID_CARD_HORIZONTAL_CHROME),
	}
}
