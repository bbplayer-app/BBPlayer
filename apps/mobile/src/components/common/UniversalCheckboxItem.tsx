import { memo } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Text, useTheme } from 'react-native-paper'

import UniversalCheckbox from '@/components/common/UniversalCheckbox'

type UniversalCheckboxItemProps = {
	label: string
	status: 'checked' | 'unchecked' | 'indeterminate'
	onPress?: () => void
	disabled?: boolean
	mode?: 'android' | 'ios'
	position?: 'leading' | 'trailing'
	testID?: string
}

const UniversalCheckboxItem = memo(function UniversalCheckboxItem({
	disabled,
	label,
	onPress,
	position = 'leading',
	status,
	testID,
}: UniversalCheckboxItemProps) {
	const { colors } = useTheme()
	const checkbox = (
		<UniversalCheckbox
			disabled={disabled}
			onPress={onPress}
			status={status}
			testID={testID}
		/>
	)

	return (
		<Pressable
			accessibilityRole='checkbox'
			accessibilityState={{ checked: status === 'checked', disabled }}
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }) => [
				styles.container,
				pressed && { backgroundColor: colors.surfaceVariant },
			]}
		>
			{position === 'leading' && checkbox}
			<View style={styles.labelContainer}>
				<Text
					numberOfLines={1}
					style={[
						styles.label,
						disabled && { color: colors.onSurfaceDisabled },
					]}
				>
					{label}
				</Text>
			</View>
			{position === 'trailing' && checkbox}
		</Pressable>
	)
})

const styles = StyleSheet.create({
	container: {
		alignItems: 'center',
		flexDirection: 'row',
		minHeight: 48,
		paddingHorizontal: 16,
	},
	label: {
		flexShrink: 1,
	},
	labelContainer: {
		flex: 1,
		marginHorizontal: 16,
	},
})

export default UniversalCheckboxItem
