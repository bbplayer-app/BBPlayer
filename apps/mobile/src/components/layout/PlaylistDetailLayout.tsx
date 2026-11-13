import type { ReactElement, ReactNode } from 'react'
import { createContext, useContext } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import useCurrentTrackId from '@/hooks/player/useCurrentTrackId'
import { useResponsiveLayout } from '@/hooks/ui/useResponsiveLayout'

const PlaylistSidebarContext = createContext(false)

/** 播放列表头部是否渲染在宽屏的侧栏中。 */
export function usePlaylistSidebar() {
	return useContext(PlaylistSidebarContext)
}

/**
 * 播放列表详情页的响应式布局：宽屏时头部固定在左侧栏，列表占据右侧；
 * 窄屏时把头部交给列表作为 ListHeaderComponent。
 */
export default function PlaylistDetailLayout({
	header,
	children,
}: {
	header: ReactElement
	children: (listHeader: ReactElement | null) => ReactNode
}) {
	const { colors } = useTheme()
	const { width, isTwoPane } = useResponsiveLayout()
	const insets = useSafeAreaInsets()
	const currentTrackId = useCurrentTrackId()

	if (!isTwoPane) {
		return <View style={styles.fill}>{children(header)}</View>
	}

	const paneWidth = Math.min(400, Math.max(300, width * 0.3))
	return (
		<View style={[styles.fill, styles.row]}>
			<ScrollView
				style={{ width: paneWidth, flexGrow: 0 }}
				contentContainerStyle={{
					paddingBottom: (currentTrackId ? 70 : 0) + insets.bottom + 16,
				}}
				showsVerticalScrollIndicator={false}
				testID='playlist-detail-pane'
			>
				<PlaylistSidebarContext value={true}>{header}</PlaylistSidebarContext>
			</ScrollView>
			<View
				style={[styles.divider, { backgroundColor: colors.outlineVariant }]}
			/>
			<View style={styles.fill}>{children(null)}</View>
		</View>
	)
}

const styles = StyleSheet.create({
	fill: { flex: 1, minWidth: 0 },
	row: { flexDirection: 'row' },
	divider: { width: StyleSheet.hairlineWidth },
})
