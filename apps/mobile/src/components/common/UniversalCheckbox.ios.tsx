import { memo } from 'react'
import { View } from 'react-native'
import { Checkbox } from 'react-native-paper'

import type { UniversalCheckboxProps } from './UniversalCheckbox'

/** SwiftUI has no checkbox on iOS, so `@expo/ui` renders a switch too wide for list rows. */
const UniversalCheckbox = memo(function UniversalCheckbox({
	disabled,
	onPress,
	status,
	testID,
}: UniversalCheckboxProps) {
	const checkbox = (
		<Checkbox.Android
			disabled={disabled}
			onPress={onPress}
			status={status}
			testID={testID}
		/>
	)

	if (!onPress) {
		return <View pointerEvents='none'>{checkbox}</View>
	}

	return checkbox
})

export default UniversalCheckbox
