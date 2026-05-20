import { SegmentedControl } from '@expo/ui/community/segmented-control'
import { useMemo } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { useTheme } from 'react-native-paper'

type NativeSegmentedButton<TValue extends string> = {
	value: TValue
	label: string
	disabled?: boolean
}

type NativeSegmentedButtonsProps<TValue extends string> = {
	value: TValue
	onValueChange: (value: TValue) => void
	buttons: NativeSegmentedButton<TValue>[]
	style?: StyleProp<ViewStyle>
}

export default function NativeSegmentedButtons<TValue extends string>({
	buttons,
	onValueChange,
	style,
	value,
}: NativeSegmentedButtonsProps<TValue>) {
	const { colors, dark } = useTheme()
	const values = useMemo(() => buttons.map((button) => button.label), [buttons])
	const selectedIndex = Math.max(
		0,
		buttons.findIndex((button) => button.value === value),
	)

	return (
		<SegmentedControl
			appearance={dark ? 'dark' : 'light'}
			enabled={buttons.every((button) => !button.disabled)}
			onChange={(event) => {
				const button = buttons[event.nativeEvent.selectedSegmentIndex]
				if (button) {
					onValueChange(button.value)
				}
			}}
			selectedIndex={selectedIndex}
			style={style}
			tintColor={colors.primary}
			values={values}
		/>
	)
}
