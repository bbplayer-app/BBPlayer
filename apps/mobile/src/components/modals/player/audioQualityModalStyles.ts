import { StyleSheet } from 'react-native'

import { LIST_ITEM_BORDER_RADIUS } from '@/theme/dimensions'

export const styles = StyleSheet.create({
	content: {
		flexShrink: 1,
	},
	scroll: {
		flexShrink: 1,
	},
	scrollContent: {
		paddingBottom: 8,
	},
	actualCard: {
		borderRadius: 16,
		paddingHorizontal: 14,
		paddingVertical: 12,
		marginBottom: 12,
		gap: 2,
	},
	actualHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	actualHeaderLabel: {
		flexShrink: 1,
	},
	recheckButton: {
		minHeight: 48,
		justifyContent: 'center',
	},
	actualStatus: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
	},
	actualIndicatorSlot: {
		height: 16,
		width: 16,
		alignItems: 'center',
		justifyContent: 'center',
	},
	actualTitle: {
		fontWeight: 'bold',
	},
	optionList: {
		gap: 2,
	},
	optionSectionTitle: {
		marginTop: 4,
		marginBottom: 4,
	},
	accessHint: {
		marginBottom: 8,
	},
	optionRow: {
		borderRadius: LIST_ITEM_BORDER_RADIUS,
		paddingHorizontal: 8,
		paddingVertical: 6,
	},
	optionContent: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
	},
	optionDisabled: {
		opacity: 0.6,
	},
	optionText: {
		flexShrink: 1,
		flexGrow: 1,
		gap: 2,
	},
	optionHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		flexShrink: 1,
		gap: 6,
	},
	optionBadge: {
		fontWeight: 'bold',
		// Android 按常规字重测量宽度、按粗体绘制，徽标又能收缩时最后一个字符会被裁掉（「64k」显示成「64」）
		flexShrink: 0,
	},
})
