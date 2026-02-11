import color from 'color'
import { type ComponentRef, forwardRef } from 'react'
import type { StyleProp, TextStyle, ViewStyle } from 'react-native'
import { StyleSheet, View } from 'react-native'
import { BaseButton } from 'react-native-gesture-handler'
import {
	ActivityIndicator,
	Icon,
	Surface,
	Text,
	useTheme,
} from 'react-native-paper'
import type { MD3Theme } from 'react-native-paper'
import type { IconSource } from 'react-native-paper/lib/typescript/components/Icon'

export type ButtonMode =
	| 'text'
	| 'outlined'
	| 'contained'
	| 'elevated'
	| 'contained-tonal'

export interface ButtonProps {
	/**
	 * Mode of the button. You can change the mode to adjust the styling to give it desired emphasis.
	 * - `text` - flat button without background or outline (low emphasis)
	 * - `outlined` - button with an outline (medium emphasis)
	 * - `contained` - button with a background color and elevation shadow (high emphasis)
	 * - `elevated` - button with a background color and elevation shadow, less prominent than contained (high emphasis)
	 * - `contained-tonal` - button with a secondary background color and no elevation shadow (high emphasis)
	 */
	mode?: ButtonMode
	/**
	 * Whether the button is disabled. A disabled button is greyed out and `onPress` is not called on touch.
	 */
	disabled?: boolean
	/**
	 * Whether to show a loading indicator.
	 */
	loading?: boolean
	/**
	 * Icon to display for the `Button`.
	 */
	icon?: IconSource
	/**
	 * Label text of the button.
	 */
	children: React.ReactNode
	/**
	 * Custom text color for flat button, or the icon size.
	 */
	textColor?: string
	/**
	 * Custom button color.
	 */
	buttonColor?: string
	/**
	 * Color of the ripple effect.
	 */
	rippleColor?: string
	/**
	 * Whether the button should be compact.
	 */
	compact?: boolean
	/**
	 * Style of button's inner content.
	 * Use this prop to apply custom height and width and to set the icon on the right with `flexDirection: 'row-reverse'`.
	 */
	contentStyle?: StyleProp<ViewStyle>
	style?: StyleProp<ViewStyle>
	/**
	 * Style for the button text.
	 */
	labelStyle?: StyleProp<TextStyle>
	/**
	 * Function to execute on press.
	 */
	onPress?: () => void
	/**
	 * TestID used for testing purposes
	 */
	testID?: string
}

const getButtonColors = ({
	theme,
	mode,
	customButtonColor,
	customTextColor,
	disabled,
}: {
	theme: MD3Theme
	mode: ButtonMode
	customButtonColor?: string
	customTextColor?: string
	disabled?: boolean
}) => {
	const isMode = (m: ButtonMode) => mode === m

	if (disabled) {
		// Disabled states
		if (isMode('outlined')) {
			return {
				backgroundColor: 'transparent',
				borderColor: theme.colors.surfaceDisabled,
				textColor: theme.colors.onSurfaceDisabled,
				borderWidth: 1,
			}
		}
		if (isMode('text')) {
			return {
				backgroundColor: 'transparent',
				borderColor: 'transparent',
				textColor: theme.colors.onSurfaceDisabled,
				borderWidth: 0,
			}
		}
		// contained, elevated, contained-tonal
		return {
			backgroundColor: theme.colors.surfaceDisabled,
			borderColor: 'transparent',
			textColor: theme.colors.onSurfaceDisabled,
			borderWidth: 0,
		}
	}

	// Active states
	let backgroundColor = customButtonColor
	let textColor = customTextColor
	let borderColor = 'transparent'
	let borderWidth = 0

	if (isMode('contained')) {
		backgroundColor = customButtonColor ?? theme.colors.primary
		textColor = customTextColor ?? theme.colors.onPrimary
	} else if (isMode('contained-tonal')) {
		backgroundColor = customButtonColor ?? theme.colors.secondaryContainer
		textColor = customTextColor ?? theme.colors.onSecondaryContainer
	} else if (isMode('elevated')) {
		backgroundColor = customButtonColor ?? theme.colors.surface
		textColor = customTextColor ?? theme.colors.primary
	} else if (isMode('outlined')) {
		backgroundColor = customButtonColor ?? 'transparent'
		textColor = customTextColor ?? theme.colors.primary
		borderColor = theme.colors.outline
		borderWidth = 1
	} else if (isMode('text')) {
		backgroundColor = customButtonColor ?? 'transparent'
		textColor = customTextColor ?? theme.colors.primary
	}

	return {
		backgroundColor,
		borderColor,
		textColor,
		borderWidth,
	}
}

const Button = forwardRef<ComponentRef<typeof BaseButton>, ButtonProps>(
	(
		{
			mode = 'text',
			disabled,
			loading,
			icon,
			children,
			textColor: customTextColor,
			buttonColor: customButtonColor,
			rippleColor: customRippleColor,
			compact,
			contentStyle,
			style,
			labelStyle,
			onPress,
			testID = 'button',
			...rest
		},
		ref,
	) => {
		const theme = useTheme()
		const { backgroundColor, borderColor, textColor, borderWidth } =
			getButtonColors({
				theme,
				mode,
				customButtonColor,
				customTextColor,
				disabled,
			})

		const rippleColor =
			customRippleColor ?? color(textColor).alpha(0.12).rgb().string()

		const font = theme.fonts.labelLarge

		const isMode = (m: ButtonMode) => mode === m
		const hasElevation = isMode('elevated') || isMode('contained')

		const borderRadius = theme.roundness * 5

		const iconStyle =
			StyleSheet.flatten(contentStyle)?.flexDirection === 'row-reverse'
				? [
						styles.iconReverse,
						styles[`md3IconReverse${compact ? 'Compact' : ''}`],
						isMode('text') &&
							styles[`md3IconReverseTextMode${compact ? 'Compact' : ''}`],
					]
				: [
						styles.icon,
						styles[`md3Icon${compact ? 'Compact' : ''}`],
						isMode('text') &&
							styles[`md3IconTextMode${compact ? 'Compact' : ''}`],
					]

		return (
			<Surface
				style={[
					styles.surface,
					{
						borderRadius,
						backgroundColor,
						borderColor,
						borderWidth,
					},
					hasElevation &&
						!disabled && { elevation: isMode('elevated') ? 1 : 2 },
					style,
				]}
				elevation={hasElevation && !disabled ? (isMode('elevated') ? 1 : 2) : 0}
			>
				<BaseButton
					ref={ref}
					onPress={onPress}
					enabled={!disabled}
					rippleColor={rippleColor}
					style={[
						styles.button,
						compact && styles.compact,
						contentStyle,
						{ borderRadius },
					]}
					testID={testID}
					{...rest}
				>
					<View style={[styles.content]}>
						{loading ? (
							<ActivityIndicator
								size={18}
								color={textColor}
								style={iconStyle}
							/>
						) : icon ? (
							<View style={iconStyle}>
								<Icon
									source={icon}
									size={18}
									color={textColor}
								/>
							</View>
						) : null}
						<Text
							role='button'
							variant='labelLarge'
							numberOfLines={1}
							style={[
								styles.label,
								{ color: textColor },
								font,
								isMode('text')
									? icon || loading
										? styles.md3LabelTextAddons
										: styles.md3LabelText
									: styles.md3Label,
								compact && styles.compactLabel,
								labelStyle,
							]}
						>
							{children}
						</Text>
					</View>
				</BaseButton>
			</Surface>
		)
	},
)

Button.displayName = 'Button'

const styles = StyleSheet.create({
	surface: {
		minWidth: 64,
		borderStyle: 'solid',
	},
	button: {
		minWidth: 64,
		borderStyle: 'solid',
		overflow: 'hidden',
	},
	compact: {
		minWidth: 'auto',
	},
	content: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
	},
	icon: {
		marginLeft: 12,
		marginRight: -4,
	},
	iconReverse: {
		marginRight: 12,
		marginLeft: -4,
	},
	md3Icon: {
		marginLeft: 16,
		marginRight: -16,
	},
	md3IconCompact: {
		marginLeft: 8,
		marginRight: 0,
	},
	md3IconReverse: {
		marginLeft: -16,
		marginRight: 16,
	},
	md3IconReverseCompact: {
		marginLeft: 0,
		marginRight: 8,
	},
	md3IconTextMode: {
		marginLeft: 12,
		marginRight: -8,
	},
	md3IconTextModeCompact: {
		marginLeft: 6,
		marginRight: 0,
	},
	md3IconReverseTextMode: {
		marginLeft: -8,
		marginRight: 12,
	},
	md3IconReverseTextModeCompact: {
		marginLeft: 0,
		marginRight: 6,
	},
	label: {
		textAlign: 'center',
		letterSpacing: 0.1,
		lineHeight: 20,
		marginVertical: 9,
		marginHorizontal: 16,
	},
	compactLabel: {
		marginHorizontal: 8,
	},
	md3Label: {
		marginVertical: 10,
		marginHorizontal: 24,
	},
	md3LabelText: {
		marginHorizontal: 12,
	},
	md3LabelTextAddons: {
		marginHorizontal: 16,
	},
})

export default Button
