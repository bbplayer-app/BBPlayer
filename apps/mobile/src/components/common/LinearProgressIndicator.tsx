import { Host, LinearWavyProgressIndicator } from '@expo/ui/jetpack-compose'
import { fillMaxWidth, height } from '@expo/ui/jetpack-compose/modifiers'
import { memo } from 'react'
import type { ColorValue, StyleProp, ViewStyle } from 'react-native'
import { Platform, StyleSheet, View } from 'react-native'
import { useTheme } from 'react-native-paper'

type LinearProgressIndicatorProps = {
	progress?: number
	indeterminate?: boolean
	color?: ColorValue
	trackColor?: ColorValue
	visible?: boolean
	style?: StyleProp<ViewStyle>
}

function normalizeProgress(progress?: number, indeterminate?: boolean) {
	if (indeterminate || progress === undefined || Number.isNaN(progress)) {
		return null
	}
	return Math.min(1, Math.max(0, progress))
}

const LinearProgressIndicator = memo(function LinearProgressIndicator({
	color,
	indeterminate,
	progress,
	style,
	trackColor,
	visible = true,
}: LinearProgressIndicatorProps) {
	const { colors } = useTheme()

	if (!visible) return null

	const normalizedProgress = normalizeProgress(progress, indeterminate)
	const resolvedColor = color ?? colors.primary
	const resolvedTrackColor = trackColor ?? colors.surfaceVariant

	if (Platform.OS !== 'android') {
		return (
			<View
				style={[
					styles.container,
					{ backgroundColor: resolvedTrackColor },
					style,
				]}
			>
				{normalizedProgress === null ? null : (
					<View
						style={[
							styles.fallbackBar,
							{
								backgroundColor: resolvedColor,
								width: `${normalizedProgress * 100}%`,
							},
						]}
					/>
				)}
			</View>
		)
	}

	return (
		<View style={[styles.container, style]}>
			<Host style={styles.host}>
				<LinearWavyProgressIndicator
					color={resolvedColor}
					modifiers={[fillMaxWidth(), height(4)]}
					progress={normalizedProgress}
					trackColor={resolvedTrackColor}
				/>
			</Host>
		</View>
	)
})

export default LinearProgressIndicator

const styles = StyleSheet.create({
	container: {
		height: 4,
		width: '100%',
	},
	host: {
		height: 4,
		width: '100%',
	},
	fallbackBar: {
		height: '100%',
	},
})
