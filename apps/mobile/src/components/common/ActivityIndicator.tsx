import { CircularWavyProgressIndicator, Host } from '@expo/ui/jetpack-compose'
import { align } from '@expo/ui/jetpack-compose/modifiers'
import { memo } from 'react'
import { Platform } from 'react-native'
import {
	ActivityIndicator as PaperActivityIndicator,
	type ActivityIndicatorProps as PaperActivityIndicatorProps,
	useTheme,
} from 'react-native-paper'

const SMALL_INDICATOR_SIZE = 24
const LARGE_INDICATOR_SIZE = 48

export type ActivityIndicatorProps = Pick<
	PaperActivityIndicatorProps,
	'color' | 'size' | 'style'
>

const ActivityIndicator = memo(function ActivityIndicator({
	color,
	size = 'small',
	style,
}: ActivityIndicatorProps) {
	const { colors } = useTheme()
	const resolvedColor = color || colors.primary

	if (Platform.OS === 'android') {
		const indicatorSize =
			size === 'small'
				? SMALL_INDICATOR_SIZE
				: size === 'large'
					? LARGE_INDICATOR_SIZE
					: size

		return (
			<Host
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
				<CircularWavyProgressIndicator
					color={resolvedColor}
					modifiers={[align('center')]}
				/>
			</Host>
		)
	}

	return (
		<PaperActivityIndicator
			color={resolvedColor}
			size={size}
			style={style}
		/>
	)
})

export default ActivityIndicator
