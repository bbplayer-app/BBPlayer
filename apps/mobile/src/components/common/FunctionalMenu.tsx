import type { PropsWithChildren } from 'react'
import { memo, useEffect } from 'react'
import { Menu } from 'react-native-paper'

import * as Haptics from '@/utils/haptics'

type FunctionalMenuProps = PropsWithChildren<Parameters<typeof Menu>[0]>

const FunctionalMenu = memo(function FunctionalMenu({
	children,
	onDismiss,
	visible,
	...props
}: FunctionalMenuProps) {
	useEffect(() => {
		if (visible) {
			void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
		}
	}, [visible])

	return (
		<>
			<Menu
				{...props}
				onDismiss={onDismiss}
				visible={visible}
			>
				{/* 在 react-native-paper 5.15.1 中修复 */}
				{/*<View
					// new arch issue: 第一次打开 Menu 时会有闪烁，采用这种方法躲闪...
					onLayout={() => {
						setTimeout(() => setShowContent(true), 100)
					}}
				/>*/}
				{children}
			</Menu>
		</>
	)
})
export default FunctionalMenu
