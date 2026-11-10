import { useResponsiveLayout } from '@/hooks/ui/useResponsiveLayout'

export function useLibraryGrid() {
	const { width, fontScale, isTablet } = useResponsiveLayout()
	const columns = isTablet
		? Math.max(
				1,
				Math.min(4, Math.floor((width - 32) / (220 * Math.max(1, fontScale)))),
			)
		: 1
	return {
		columns,
		isGrid: columns > 1,
		coverSize: Math.min(160, (width - 32) / columns - 48),
	}
}
