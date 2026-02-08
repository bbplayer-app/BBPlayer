import { forwardRef, type ComponentRef } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { StyleSheet, View } from 'react-native'
import { BaseButton } from 'react-native-gesture-handler'
import { Icon, useTheme } from 'react-native-paper'
import type { MD3Theme } from 'react-native-paper'
import type { IconSource } from 'react-native-paper/lib/typescript/components/Icon'

type IconButtonMode = 'outlined' | 'contained' | 'contained-tonal'

export interface IconButtonProps {
	/**
	 * Icon to display.
	 */
	icon: IconSource
	/**
	 * Mode of the icon button. By default there is no specified mode - only pressable icon will be rendered.
	 */
	mode?: IconButtonMode
	/**
	 * Color of the icon.
	 */
	iconColor?: string
	/**
	 * Background color of the icon container.
	 */
	containerColor?: string
	/**
	 * Color of the ripple effect.
	 */
	rippleColor?: string
	/**
	 * Whether icon button is selected. A selected button receives alternative combination of icon and container colors.
	 */
	selected?: boolean
	/**
	 * Size of the icon.
	 */
	size?: number
	/**
	 * Whether the button is disabled. A disabled button is greyed out and `onPress` is not called on touch.
	 */
	disabled?: boolean
	/**
	 * Whether an icon change is animated.
	 */
	animated?: boolean
	/**
	 * Style of button's inner content.
	 * Use this prop to apply custom height and width or to set a custom padding`.
	 */
	contentStyle?: StyleProp<ViewStyle>
	style?: StyleProp<ViewStyle>
	/**
	 * Function to execute on press.
	 */
	onPress?: () => void
	/**
	 * TestID used for testing purposes
	 */
	testID?: string
	/**
	 * Whether to show a loading indicator.
	 */
	loading?: boolean
}

// Extracted from react-native-paper/src/components/IconButton/utils.ts
const getIconButtonColor = ({
	theme,
	disabled,
	mode,
	selected,
	customIconColor,
	customContainerColor,
}: {
	theme: MD3Theme
	disabled?: boolean
	selected?: boolean
	mode?: IconButtonMode
	customIconColor?: string
	customContainerColor?: string
}) => {
	if (disabled) {
		return {
			iconColor: theme.colors.onSurfaceDisabled,
			backgroundColor:
				mode === 'contained' || mode === 'contained-tonal'
					? theme.colors.surfaceDisabled
					: undefined,
			borderColor: undefined,
		}
	}

	let iconColor = customIconColor
	let backgroundColor = customContainerColor
	let borderColor

	if (mode === 'contained') {
		if (selected) {
			backgroundColor = backgroundColor ?? theme.colors.primary
			iconColor = iconColor ?? theme.colors.onPrimary
		} else {
			backgroundColor = backgroundColor ?? theme.colors.surfaceVariant
			iconColor = iconColor ?? theme.colors.primary
		}
	} else if (mode === 'contained-tonal') {
		if (selected) {
			backgroundColor = backgroundColor ?? theme.colors.secondaryContainer
			iconColor = iconColor ?? theme.colors.onSecondaryContainer
		} else {
			backgroundColor = backgroundColor ?? theme.colors.surfaceVariant
			iconColor = iconColor ?? theme.colors.onSurfaceVariant
		}
	} else if (mode === 'outlined') {
		borderColor = theme.colors.outline
		if (selected) {
			backgroundColor = backgroundColor ?? theme.colors.inverseSurface
			iconColor = iconColor ?? theme.colors.inverseOnSurface
		} else {
			iconColor = iconColor ?? theme.colors.onSurfaceVariant
		}
	} else {
		// Standard (no mode)
		if (selected) {
			iconColor = iconColor ?? theme.colors.primary
		} else {
			iconColor = iconColor ?? theme.colors.onSurfaceVariant
		}
	}

	// Fallback for non-V3 themes or simple overrides if needed
	if (!iconColor) {
		iconColor = theme.colors.onSurface
	}

	return {
		iconColor,
		backgroundColor,
		borderColor,
	}
}

const IconButton = forwardRef<ComponentRef<typeof BaseButton>, IconButtonProps>(
	(
		{
			icon,
			iconColor: customIconColor,
			containerColor: customContainerColor,
			rippleColor: customRippleColor,
			size = 24,
			disabled,
			onPress,
			selected = false,
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			animated = false,
			mode,
			style,
			testID = 'icon-button',
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			loading = false,
			contentStyle,
			...rest
		},
		ref,
	) => {
		const theme = useTheme()

		const { iconColor, backgroundColor, borderColor } = getIconButtonColor({
			theme,
			disabled,
			selected,
			mode,
			customIconColor,
			customContainerColor,
		})

		const buttonSize = size + 2 * 8 // PADDING = 8
		const borderRadius = buttonSize / 2

		// Ripple color calculation
		const rippleColorFinal =
			customRippleColor ??
			(iconColor
				? theme.isV3
					? `${iconColor}1F`
					: `${iconColor}32`
				: undefined)

		const handlePress = () => {
			onPress?.()
		}

		return (
			<BaseButton
				ref={ref}
				onPress={handlePress}
				enabled={!disabled}
				rippleColor={rippleColorFinal}
				style={[
					{
						width: buttonSize,
						height: buttonSize,
						borderRadius,
						backgroundColor,
						borderColor,
						borderWidth: mode === 'outlined' && !selected ? 1 : 0,
						overflow: 'hidden',
					},
					styles.container,
					style,
					styles.touchable,
					contentStyle,
				]}
				testID={testID}
				{...rest}
			>
				<View style={styles.content}>
					<Icon
						source={icon}
						color={iconColor}
						size={size}
					/>
				</View>
			</BaseButton>
		)
	},
)

IconButton.displayName = 'IconButton'

const styles = StyleSheet.create({
	container: {
		margin: 6,
		elevation: 0,
	},
	touchable: {
		justifyContent: 'center',
		alignItems: 'center',
	},
	content: {
		justifyContent: 'center',
		alignItems: 'center',
	},
})

export default IconButton
