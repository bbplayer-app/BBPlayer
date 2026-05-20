import { CircularWavyProgressIndicator, Host } from '@expo/ui/jetpack-compose'
import { memo } from 'react'
import {
	ActivityIndicator as RNActivityIndicator,
	Platform,
	type StyleProp,
	type ViewStyle,
} from 'react-native'
import { useTheme } from 'react-native-paper'

export type ActivityIndicatorProps = {
	animating?: boolean
	color?: string
	size?: 'small' | 'large' | number
	style?: StyleProp<ViewStyle>
	hidesWhenStopped?: boolean
}

export const ActivityIndicator = memo(function ActivityIndicator({
	animating = true,
	color,
	hidesWhenStopped = true,
	size = 'small',
	style,
}: ActivityIndicatorProps) {
	const { colors } = useTheme()

	if (!animating && hidesWhenStopped) {
		return null
	}

	if (Platform.OS === 'android') {
		const indicatorSize =
			size === 'small'
				? 24
				: size === 'large'
					? 48
					: typeof size === 'number'
						? size
						: 36

		// Use colors.primary if no explicit color is provided
		const resolvedColor = color || colors.primary

		return (
			<Host
				matchContents
				style={[
					{
						width: indicatorSize,
						height: indicatorSize,
						justifyContent: 'center',
						alignItems: 'center',
					},
					style,
				]}
			>
				<CircularWavyProgressIndicator color={resolvedColor} />
			</Host>
		)
	}

	const resolvedColor = color || colors.primary

	return (
		<RNActivityIndicator
			animating={animating}
			color={resolvedColor}
			size={typeof size === 'number' ? size : size}
			style={style}
		/>
	)
})

export default ActivityIndicator
